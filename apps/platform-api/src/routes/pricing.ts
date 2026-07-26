// Helmies Studio — Pricing Routes

import { Router } from "express";
import { generateQuote } from "@helmies/pricing-engine";

export const pricingRouter = Router();

/**
 * POST /api/pricing/quote
 * Generate a price quote for a generation request.
 * Body: { modelId: string, params: object, promoCode?: string }
 */
pricingRouter.post("/quote", async (req, res) => {
  try {
    const { modelId, params, promoCode } = req.body;
    if (!modelId || !params) {
      return res.status(400).json({ error: "modelId and params are required" });
    }

    const quote = await generateQuote(
      req.userContext!.platformUserId,
      modelId,
      params,
      promoCode,
    );

    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to generate quote" });
  }
});

/**
 * GET /api/pricing/plans
 * Returns available pricing plans.
 */
pricingRouter.get("/plans", async (_req, res) => {
  try {
    const { prisma } = await import("../lib/prisma");
    const plans = await prisma.pricingPlan.findMany({
      where: { active: true, public: true },
      include: {
        prices: {
          where: { active: true },
          orderBy: { effectiveFrom: "desc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/**
 * GET /api/pricing/credit-packs
 * Returns available credit packs.
 */
pricingRouter.get("/credit-packs", async (_req, res) => {
  try {
    const { prisma } = await import("../lib/prisma");
    const packs = await prisma.creditPack.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });

    res.json({ packs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch credit packs" });
  }
});
