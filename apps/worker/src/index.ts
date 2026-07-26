// Helmies Studio — Worker Service
// Phase 6: Job queue processor for generation, vision, quality, assembly

import { prisma } from "./lib/prisma";
import { settleReservation, releaseReservation } from "./services/wallet";

// ============================================================
// Job processor interface
// ============================================================

interface ProcessResult {
  success: boolean;
  outputUrl?: string;
  assetId?: string;
  error?: string;
  providerRequestId?: string;
  providerCost?: number;
}

// ============================================================
// Image generation processor
// ============================================================

async function processImageGeneration(jobId: string): Promise<ProcessResult> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return { success: false, error: "Job not found" };

  // Update status
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date() },
  });

  await addJobEvent(jobId, "processing_started", "generating");

  try {
    // Resolve model and provider
    const model = job.modelId
      ? await prisma.aiModel.findUnique({
          where: { id: job.modelId },
          include: { provider: true },
        })
      : null;

    if (!model) {
      return { success: false, error: "Model not found" };
    }

    const params = job.normalizedRequest as Record<string, unknown>;

    // Build provider-specific request
    const providerRequest = buildProviderRequest(model.provider.key, model.modelKey, params);

    // Call provider API
    const result = await callProvider(model.provider, model.modelKey, providerRequest);

    // Store result
    if (result.outputUrl) {
      // Download and store media
      const asset = await prisma.asset.create({
        data: {
          userId: job.userId,
          projectId: job.projectId,
          type: model.capability.startsWith("video") ? "video" : "image",
          source: "generation",
          storageKey: `jobs/${jobId}/output`,
          mimeType: model.capability.startsWith("video") ? "video/mp4" : "image/png",
          generationJobId: job.id,
          metadata: {
            model: model.displayName,
            provider: model.provider.name,
            requestId: result.requestId,
          },
        },
      });

      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completedAt: new Date(),
          providerRequestId: result.requestId,
          providerCost: result.providerCost || 0,
          actualCredits: job.estimatedCredits,
          providerResponse: { outputUrl: result.outputUrl },
        },
      });

      await addJobEvent(jobId, "completed", "completed");

      return { success: true, outputUrl: result.outputUrl, assetId: asset.id, providerRequestId: result.requestId };
    }

    return { success: false, error: "No output URL from provider" };
  } catch (error: any) {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        safeError: error.message?.slice(0, 500),
        errorCode: "provider_error",
      },
    });

    await addJobEvent(jobId, "failed", undefined, error.message);

    return { success: false, error: error.message };
  }
}

// ============================================================
// Provider adapter integration (Sections 60, 126-129)
// ============================================================

import { getAdapter, type NormalizedGenerationRequest, type ProviderRequest } from "@helmies/model-registry/adapters";
import { recordSuccess, recordFailure, isCircuitOpen } from "@helmies/model-registry/circuit-breaker";
import { decideRetry, classifyError } from "@helmies/shared-config/security";
import { fetchFromProvider, ingestProviderMedia } from "@helmies/storage/ingestion-pipeline";
import { evaluateQuality, shouldAutoRetry } from "@helmies/model-registry/quality-engine";
import { recordProviderCost, logGenerationCompleted, logGenerationFailed } from "@helmies/telemetry";

function buildNormalizedRequest(
  params: Record<string, unknown>,
): NormalizedGenerationRequest {
  return {
    prompt: (params.prompt as string) || "",
    negativePrompt: params.negativePrompt as string | undefined,
    references: (params.references as string[]) || [],
    aspectRatio: (params.aspectRatio as string) || "1:1",
    resolution: params.resolution as string | undefined,
    durationSec: params.durationSec as number | undefined,
    seed: params.seed as number | undefined,
    width: params.width as number | undefined,
    height: params.height as number | undefined,
    imageCount: params.imageCount as number | undefined,
    audioSource: params.audioSource as string | undefined,
    videoSource: params.videoSource as string | undefined,
    maskSource: params.maskSource as string | undefined,
    firstFrameSource: params.firstFrameSource as string | undefined,
    lastFrameSource: params.lastFrameSource as string | undefined,
    voice: params.voice as string | undefined,
    speed: params.speed as number | undefined,
  };
}

async function callProvider(
  provider: { key: string; baseUrl: string | null; secretRef: string | null },
  modelKey: string,
  userId: string,
  jobId: string,
  normalizedRequest: Record<string, unknown>,
): Promise<{ outputUrl?: string; requestId?: string; providerCost?: number }> {
  // 1. Check circuit breaker
  if (isCircuitOpen(provider.key, modelKey)) {
    throw new Error(`Provider ${provider.key}/${modelKey} is currently unavailable (circuit open)`);
  }

  // 2. Get adapter
  const adapter = getAdapter(provider.key);

  // 3. Build normalized input
  const normalized = buildNormalizedRequest(normalizedRequest);

  // 4. Resolve API key from secret reference
  const apiKey = resolveSecret(provider.secretRef || `\${${provider.key.toUpperCase()}_KEY}`);
  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${provider.key}`);
  }

  const baseUrl = provider.baseUrl || getDefaultBaseUrl(provider.key);
  if (!baseUrl) {
    throw new Error(`No base URL configured for provider: ${provider.key}`);
  }

  // 5. Build provider-specific request
  const providerReq: ProviderRequest = adapter.buildRequest(modelKey, normalized, apiKey, baseUrl);

  // 6. Execute request with retry
  let lastError: Error | null = null;
  const maxAttempts = providerReq.isAsync ? 1 : 3; // Only retry sync requests

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const startTime = Date.now();

      const response = await fetch(providerReq.url, {
        method: providerReq.method,
        headers: providerReq.headers,
        body: JSON.stringify(providerReq.body),
        signal: AbortSignal.timeout(providerReq.isAsync ? 30000 : 60000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorClass = classifyError(null, response.status);
        const retryDecision = decideRetry(errorClass, attempt, !providerReq.isAsync);

        if (retryDecision.shouldRetry && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, retryDecision.delayMs));
          continue;
        }

        recordFailure(provider.key, modelKey, response.status >= 500 ? "5xx" : response.status === 429 ? "429" : "other");
        throw new Error(`Provider returned HTTP ${response.status}: ${await response.text().catch(() => "unknown")}`);
      }

      const data = await response.json();
      const parsed = adapter.parseResponse(data);

      if (parsed.status === "failed") {
        recordFailure(provider.key, modelKey, "5xx");
        throw new Error(parsed.error || "Provider reported failure");
      }

      // Async job: poll for result
      if (providerReq.isAsync && parsed.status === "processing" && parsed.requestId) {
        const result = await pollForResult(adapter, providerReq, parsed.requestId, apiKey);
        recordSuccess(provider.key, modelKey, latencyMs);
        return { outputUrl: result.outputUrl, requestId: parsed.requestId, providerCost: 0 };
      }

      // Sync result
      recordSuccess(provider.key, modelKey, latencyMs);
      return { outputUrl: parsed.outputUrl, requestId: parsed.requestId, providerCost: 0 };
    } catch (error: any) {
      lastError = error;
      const errorClass = classifyError(error);
      const retryDecision = decideRetry(errorClass, attempt, !providerReq.isAsync);

      if (retryDecision.shouldRetry && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, retryDecision.delayMs));
        continue;
      }
      break;
    }
  }

  recordFailure(provider.key, modelKey, "5xx");
  throw lastError || new Error("All provider attempts failed");
}

async function pollForResult(
  adapter: ReturnType<typeof getAdapter>,
  providerReq: ProviderRequest,
  requestId: string,
  apiKey: string,
): Promise<{ outputUrl?: string }> {
  const pollUrl = providerReq.pollUrl?.replace("{requestId}", requestId) || "";
  const maxAttempts = providerReq.maxPollAttempts || 60;
  const interval = providerReq.pollIntervalMs || 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval));

    const response = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) continue;

    const data = await response.json();
    const parsed = adapter.parsePollResponse(data);

    if (parsed.status === "completed") {
      return { outputUrl: parsed.outputUrl };
    }
    if (parsed.status === "failed") {
      throw new Error(parsed.error || "Provider async job failed");
    }
  }

  throw new Error("Provider async job timed out");
}

function resolveSecret(secretRef: string): string | undefined {
  // Resolves ${ENV_VAR} or Docker secret references
  const envMatch = secretRef.match(/\$\{(.+?)\}/);
  if (envMatch) {
    return process.env[envMatch[1]];
  }
  return process.env[secretRef];
}

function getDefaultBaseUrl(providerKey: string): string | undefined {
  const urls: Record<string, string> = {
    wavespeed: "https://api.wavespeed.ai",
    atlas: "https://api.atlascloud.ai",
    alibaba: "https://dashscope.aliyuncs.com",
    openai: "https://api.openai.com/v1",
    google: "https://generativelanguage.googleapis.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    kie: "https://api.kie.ai/v1",
  };
  return urls[providerKey.toLowerCase()];
}

// ============================================================
// Job event logging
// ============================================================

async function addJobEvent(
  jobId: string,
  event: string,
  stage?: string,
  message?: string,
): Promise<void> {
  await prisma.generationJobEvent.create({
    data: {
      jobId,
      event,
      stage,
      message: message?.slice(0, 500),
    },
  });
}

// ============================================================
// Main job processor (entry point for BullMQ workers)
// ============================================================

export async function processJob(jobId: string): Promise<void> {
  console.log(`[worker] Processing job: ${jobId}`);

  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    console.error(`[worker] Job not found: ${jobId}`);
    return;
  }

  let result: ProcessResult;

  // Route to appropriate processor based on capability
  if (job.capability.startsWith("image")) {
    result = await processImageGeneration(jobId);
  } else if (job.capability.startsWith("video")) {
    result = await processImageGeneration(jobId); // Same pattern for now
  } else if (job.capability.startsWith("audio")) {
    result = await processImageGeneration(jobId); // Same pattern for now
  } else {
    result = { success: false, error: `Unknown capability: ${job.capability}` };
  }

  // Settle or release reservation
  if (result.success) {
    await settleReservation(
      (await prisma.creditReservation.findFirst({ where: { jobId } }))?.id || "",
      job.actualCredits || job.estimatedCredits,
    );
  } else {
    const reservation = await prisma.creditReservation.findFirst({ where: { jobId } });
    if (reservation) {
      await releaseReservation(reservation.id);
    }
  }

  console.log(`[worker] Job ${jobId} completed: ${result.success ? "success" : "failed"}`);
}

// ============================================================
// Worker startup
// ============================================================

async function start() {
  console.log("[worker] Helmies Studio Worker starting...");

  // In production, this would set up BullMQ workers:
  //
  // import { Queue, Worker } from "bullmq";
  // const generationQueue = new Queue("generation", { connection: { host: "redis" } });
  // const worker = new Worker("generation", async (job) => {
  //   await processJob(job.data.jobId);
  // }, { connection: { host: "redis" } });

  console.log("[worker] Ready to process jobs");
}

start();
