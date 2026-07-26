// Helmies Studio — Generation Routes (Model Gateway)

import { Router } from "express";
import { generateQuote } from "@helmies/pricing-engine";
import { getEligibleModels, autoSelectModel } from "@helmies/model-registry";
import { reserveCredits, settleReservation, releaseReservation } from "../services/wallet";
import { prisma } from "../lib/prisma";

export const generationRouter = Router();

/**
 * GET /api/generate/models
 * List eligible models for a capability.
 */
generationRouter.get("/models", async (req, res) => {
  try {
    const capability = req.query.capability as string;
    const costMode = (req.query.costMode as string) || "balanced";

    if (!capability) {
      return res.status(400).json({ error: "capability query parameter is required" });
    }

    const models = await getEligibleModels(
      capability as any,
      req.userContext!.platformUserId,
      costMode as any,
    );

    res.json({ models });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/generate/quote
 * Get a quote for a specific generation.
 */
generationRouter.post("/quote", async (req, res) => {
  try {
    const { modelId, params, promoCode } = req.body;
    if (!modelId || !params) {
      return res.status(400).json({ error: "modelId and params are required" });
    }
    const quote = await generateQuote(req.userContext!.platformUserId, modelId, params, promoCode);
    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/generate/create
 * Create a generation job (reserves credits, enqueues for worker).
 */
generationRouter.post("/create", async (req, res) => {
  try {
    const { quoteId, modelId, capability, params, routeKey, projectId } = req.body;
    const userId = req.userContext!.platformUserId;

    // Validate quote
    const quote = await generateQuote(userId, modelId, params);
    if (quote.balanceAfterExpected < 0) {
      return res.status(402).json({
        error: "Insufficient credits",
        required: quote.credits,
        balance: quote.balance,
      });
    }

    // Create idempotency key
    const idempotencyKey = `${userId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Create job in DB
    const job = await prisma.generationJob.create({
      data: {
        userId,
        capability: capability || "image.generate",
        routeKey: routeKey || "image.standard",
        modelId,
        projectId: projectId || null,
        status: "created",
        idempotencyKey,
        normalizedRequest: params,
        quoteSnapshot: quote,
        estimatedCredits: quote.credits,
        reservedCredits: quote.maximumCredits,
      },
    });

    // Reserve credits
    const reserveResult = await reserveCredits(userId, quote.maximumCredits, job.id);
    if (!reserveResult.success) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "failed", safeError: reserveResult.error },
      });
      return res.status(402).json({ error: reserveResult.error });
    }

    // Mark as reserved and enqueue to worker
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "queued", queuedAt: new Date() },
    });

    // Enqueue to worker via Redis/BullMQ (direct HTTP call to worker as fallback)
    try {
      const workerUrl = process.env.WORKER_URL || "http://localhost:3005";
      fetch(`${workerUrl}/process/${job.id}`, { method: "POST" }).catch(() => {
        // Worker will pick up queued jobs on its next poll cycle
        console.log(`[gateway] Job ${job.id} queued — worker will process`);
      });
    } catch {
      // Fire-and-forget: worker polls for queued jobs
    }

    res.json({
      jobId: job.id,
      status: "queued",
      quote,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/generate/job/:id
 * Get job status.
 */
generationRouter.get("/job/:id", async (req, res) => {
  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: req.params.id },
      include: { events: { orderBy: { createdAt: "desc" }, take: 20 }, assets: true },
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.userId !== req.userContext!.platformUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: "Failed to get job" });
  }
});

// ============================================================
// Low Balance UX (Section 211) — Suggest cheaper alternatives
// ============================================================

generationRouter.post("/low-balance-alternatives", async (req, res) => {
  try {
    const { capability, requiredCredits, currentBalance } = req.body;
    const userId = req.userContext!.platformUserId;

    if (currentBalance >= requiredCredits) {
      return res.json({ alternatives: [], message: "You have sufficient credits" });
    }

    const shortage = requiredCredits - currentBalance;
    const alternatives: Array<{ label: string; action: string; estimatedCredits?: number }> = [];

    // Option 1: Economy model
    if (capability === "image.generate" || capability === "video.generate") {
      alternatives.push({
        label: `Use Economy model (~${Math.ceil(requiredCredits * 0.35)} credits)`,
        action: "switch_economy",
        estimatedCredits: Math.ceil(requiredCredits * 0.35),
      });
    }

    // Option 2: Reduce duration (video)
    if (capability === "video.generate") {
      alternatives.push({
        label: `Reduce duration to 3 seconds (~${Math.ceil(requiredCredits * 0.6)} credits)`,
        action: "reduce_duration",
        estimatedCredits: Math.ceil(requiredCredits * 0.6),
      });
    }

    // Option 3: Lower resolution
    alternatives.push({
      label: "Lower resolution to 720p",
      action: "lower_resolution",
      estimatedCredits: Math.ceil(requiredCredits * 0.7),
    });

    // Option 4: Add credits
    alternatives.push({
      label: `Add credits (need ${shortage} more)`,
      action: "add_credits",
    });

    res.json({
      message: `You need ${requiredCredits} credits but have ${currentBalance}.`,
      shortage,
      alternatives,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// Friendly Error Messages (Section 212)
// ============================================================

const FRIENDLY_ERRORS: Record<string, string> = {
  "invalid_image_list": "This model supports a maximum of {max} reference images, but {actual} were selected.",
  "rate_limit": "Too many requests. Please wait a moment and try again.",
  "invalid_api_key": "Provider authentication failed. Our team has been notified.",
  "model_not_found": "This model is temporarily unavailable. Please try another model.",
  "timeout": "The request took too long. Please try again or use a different model.",
  "content_filter": "The request was blocked by safety filters. Try adjusting your prompt.",
  "insufficient_balance": "Provider balance is low. Please contact support.",
  "server_error": "Something went wrong on our end. Please try again.",
};

generationRouter.post("/friendly-error", async (req, res) => {
  try {
    const { errorCode, errorMessage, context } = req.body;

    let friendlyMessage = FRIENDLY_ERRORS[errorCode] || FRIENDLY_ERRORS["server_error"];

    // Substitute context variables
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        friendlyMessage = friendlyMessage.replace(`{${key}}`, String(value));
      }
    }

    res.json({
      friendlyMessage,
      originalCode: errorCode,
      actions: getSuggestedActions(errorCode, context),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

function getSuggestedActions(errorCode: string, _context?: Record<string, unknown>): string[] {
  const actions: Record<string, string[]> = {
    "invalid_image_list": ["keep_first_references", "switch_compatible_model"],
    "rate_limit": ["wait_and_retry"],
    "timeout": ["retry", "switch_faster_model"],
    "content_filter": ["edit_prompt"],
  };
  return actions[errorCode] || ["contact_support"];
}
