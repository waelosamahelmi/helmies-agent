// Helmies Studio — Model Registry
// Phase 4: Provider/model/route management, eligibility, auto-selection

import { prisma } from "./prisma";
import type { GenerationCapability, CostMode } from "@helmies/contracts";

// ============================================================
// Model eligibility
// ============================================================

export interface EligibilityCheck {
  modelId: string;
  eligible: boolean;
  reason?: string;
}

export async function getEligibleModels(
  capability: GenerationCapability,
  userId: string,
  costMode: CostMode = "balanced",
): Promise<EligibilityCheck[]> {
  // Get user plan for access control
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: { where: { status: "active" }, take: 1 },
      wallet: true,
    },
  });

  if (!user) return [];

  const plan = user.subscriptions[0]?.plan ?? "free";
  const balance = user.wallet?.available ?? user.credits;

  // Find all enabled models for this capability
  const models = await prisma.aiModel.findMany({
    where: {
      capability,
      enabled: true,
      hidden: false,
      provider: { enabled: true },
    },
    include: {
      provider: true,
      prices: {
        where: {
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
      routes: {
        where: { enabled: true },
        orderBy: { priority: "asc" },
      },
    },
    orderBy: { priority: "asc" },
  });

  return models.map((model) => {
    // Check plan access
    if (model.metadata && typeof model.metadata === "object") {
      const meta = model.metadata as Record<string, unknown>;
      if (Array.isArray(meta.planAccess) && !meta.planAccess.includes(plan)) {
        return { modelId: model.id, eligible: false, reason: `Requires ${meta.planAccess.join(" or ")} plan` };
      }
    }

    // Check budget
    const price = model.prices[0];
    if (price) {
      const params = price.params as Record<string, unknown>;
      const unitCost = (params?.unitCost as number) || 0;
      // Rough estimate — actual quote uses pricing engine
      const estimatedCredits = Math.ceil(unitCost * 100);
      if (balance < estimatedCredits) {
        return { modelId: model.id, eligible: false, reason: `Insufficient credits (need ~${estimatedCredits})` };
      }
    }

    return { modelId: model.id, eligible: true };
  });
}

// ============================================================
// Model auto-selection
// ============================================================

export interface ModelScore {
  modelId: string;
  displayName: string;
  score: number;
  qualityScore: number;
  speedScore: number;
  costScore: number;
}

export async function autoSelectModel(
  capability: GenerationCapability,
  userId: string,
  costMode: CostMode = "balanced",
): Promise<ModelScore | null> {
  const eligible = await getEligibleModels(capability, userId, costMode);
  const eligibleIds = eligible.filter((e) => e.eligible).map((e) => e.modelId);

  if (eligibleIds.length === 0) return null;

  const models = await prisma.aiModel.findMany({
    where: { id: { in: eligibleIds } },
    include: { prices: { take: 1, orderBy: { effectiveFrom: "desc" } } },
  });

  // Weight configuration
  const weights = {
    best_quality: { quality: 0.6, value: 0.1, speed: 0.15, reliability: 0.15 },
    balanced: { quality: 0.35, value: 0.35, speed: 0.15, reliability: 0.15 },
    economy: { quality: 0.1, value: 0.6, speed: 0.15, reliability: 0.15 },
    manual: { quality: 0.25, value: 0.25, speed: 0.25, reliability: 0.25 },
  };

  const w = weights[costMode];

  const scored: ModelScore[] = models.map((model) => {
    const quality = Number(model.qualityScore) || 0.5;
    const speed = Number(model.speedScore) || 0.5;
    const reliability = Number(model.reliabilityScore) || 0.5;

    // Cost score: cheaper = higher score
    const price = model.prices[0];
    let costScore = 0.5;
    if (price) {
      const params = price.params as Record<string, unknown>;
      const unitCost = (params?.unitCost as number) || 0.01;
      // Inverse: lower cost = higher score (capped)
      costScore = Math.max(0, Math.min(1, 1 - unitCost * 10));
    }

    const score =
      w.quality * quality +
      w.value * costScore +
      w.speed * speed +
      w.reliability * reliability;

    return {
      modelId: model.id,
      displayName: model.displayName,
      score: Math.round(score * 1000) / 1000,
      qualityScore: quality,
      speedScore: speed,
      costScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

// ============================================================
// Model lookup
// ============================================================

export async function getModel(modelId: string) {
  return prisma.aiModel.findUnique({
    where: { id: modelId },
    include: {
      provider: true,
      prices: { take: 1, orderBy: { effectiveFrom: "desc" } },
      routes: { where: { enabled: true }, orderBy: { priority: "asc" } },
    },
  });
}

export async function getModelByKey(providerId: string, modelKey: string, capability: string) {
  return prisma.aiModel.findUnique({
    where: {
      providerId_modelKey_capability: {
        providerId,
        modelKey,
        capability,
      },
    },
    include: {
      provider: true,
      prices: { take: 1, orderBy: { effectiveFrom: "desc" } },
    },
  });
}

export async function listModels(capability?: string) {
  return prisma.aiModel.findMany({
    where: {
      enabled: true,
      hidden: false,
      ...(capability ? { capability } : {}),
      provider: { enabled: true },
    },
    include: {
      provider: { select: { name: true, key: true } },
      prices: { take: 1, orderBy: { effectiveFrom: "desc" } },
    },
    orderBy: [{ category: "asc" }, { priority: "asc" }],
  });
}

// ============================================================
// Provider adapter resolution
// ============================================================

export async function getProviderForModel(modelId: string) {
  const model = await prisma.aiModel.findUnique({
    where: { id: modelId },
    include: { provider: true },
  });
  if (!model) throw new Error(`Model ${modelId} not found`);
  return model.provider;
}

// ============================================================
// Route resolution
// ============================================================

export async function resolveRoute(
  routeKey: string,
  capability: string,
): Promise<string | null> {
  const route = await prisma.modelRoute.findFirst({
    where: {
      routeKey,
      enabled: true,
      model: {
        capability,
        enabled: true,
        provider: { enabled: true },
      },
    },
    orderBy: { priority: "asc" },
  });

  return route?.modelId ?? null;
}
