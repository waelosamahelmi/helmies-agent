// Helmies Studio — Pricing Engine
// Phase 5: Quote calculation, credit computation, margin engine, promo discounts

import { prisma } from "./prisma";
import { CONSTANTS, PLAN_DEFAULTS } from "@helmies/shared-config";
import type { PricingStrategy, QuoteResponse } from "@helmies/contracts";

// ============================================================
// Provider cost calculation
// ============================================================

export async function calculateProviderCost(
  modelId: string,
  params: Record<string, unknown>,
): Promise<number> {
  const price = await prisma.aiModelPrice.findFirst({
    where: {
      modelId,
      effectiveFrom: { lte: new Date() },
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gte: new Date() } },
      ],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!price) {
    throw new Error(`No active price found for model ${modelId}`);
  }

  const strategy = price.strategy as PricingStrategy;
  const priceParams = price.params as Record<string, unknown>;

  switch (strategy) {
    case "fixed":
      return (priceParams.unitCost as number) || 0;

    case "per_image":
      return ((priceParams.unitCost as number) || 0) * ((params.imageCount as number) || 1);

    case "per_second": {
      const duration = (params.durationSec as number) || 5;
      const resolution = (params.resolution as string) || "720p";
      const tiers = (priceParams.tiers as Record<string, number>) || {};
      const rate = tiers[resolution] || (priceParams.unitCost as number) || 0.05;
      return rate * duration;
    }

    case "per_megapixel": {
      const width = (params.width as number) || 1024;
      const height = (params.height as number) || 1024;
      const megapixels = (width * height) / 1_000_000;
      return ((priceParams.unitCost as number) || 0.01) * megapixels;
    }

    case "per_character":
      return ((priceParams.unitCost as number) || 0.001) * ((params.characters as number) || 100);

    case "per_audio_second":
      return ((priceParams.unitCost as number) || 0.01) * ((params.durationSec as number) || 10);

    case "per_input_token":
      return ((priceParams.unitCost as number) || 0.000001) * ((params.inputTokens as number) || 1000);

    case "per_output_token":
      return ((priceParams.unitCost as number) || 0.000002) * ((params.outputTokens as number) || 1000);

    case "tiered_duration": {
      const duration = (params.durationSec as number) || 5;
      const tiers = (priceParams.tiers as Record<string, number>) || {};
      // Find closest tier
      const keys = Object.keys(tiers).map(Number).sort((a, b) => a - b);
      let rate = tiers[keys[0]?.toString() || "5"] || 0;
      for (const key of keys) {
        if (duration <= key) {
          rate = tiers[key.toString()];
          break;
        }
      }
      return rate * duration;
    }

    case "formula":
      // Safe formula evaluation using pre-defined operations only
      throw new Error("Formula pricing not yet implemented — use structured strategies");

    default:
      throw new Error(`Unknown pricing strategy: ${strategy}`);
  }
}

// ============================================================
// Overhead / infrastructure reserve
// ============================================================

export function applyOverhead(providerCost: number, capability: string): number {
  const reserveMap: Record<string, number> = {
    "image.generate": CONSTANTS.INFRA_RESERVE_IMAGE,
    "image.edit": CONSTANTS.INFRA_RESERVE_IMAGE,
    "video.generate": CONSTANTS.INFRA_RESERVE_VIDEO,
    "video.image_to_video": CONSTANTS.INFRA_RESERVE_VIDEO,
    "video.video_to_video": CONSTANTS.INFRA_RESERVE_VIDEO,
    "audio.tts": CONSTANTS.INFRA_RESERVE_LLM,
    "audio.music": CONSTANTS.INFRA_RESERVE_LLM,
    "llm.chat": CONSTANTS.INFRA_RESERVE_LLM,
    "llm.prompt": CONSTANTS.INFRA_RESERVE_LLM,
  };

  const reserve = reserveMap[capability] || CONSTANTS.INFRA_RESERVE_IMAGE;
  return providerCost + providerCost * reserve;
}

// ============================================================
// Retail calculation with margin
// ============================================================

export async function calculateRetail(
  adjustedCost: number,
  modelId: string,
): Promise<number> {
  const model = await prisma.aiModel.findUnique({
    where: { id: modelId },
    include: { provider: true },
  });

  const targetMargin =
    Number(model?.provider?.defaultTargetMargin) || CONSTANTS.DEFAULT_TARGET_MARGIN;

  // retail = adjustedCost / (1 - targetMargin)
  if (targetMargin >= 1) {
    throw new Error("Target margin must be less than 100%");
  }

  return adjustedCost / (1 - targetMargin);
}

// ============================================================
// Convert retail value to credits
// ============================================================

export function toCredits(retailValue: number, creditValueCents = 1): number {
  // 1 credit = creditValueCents cents (default $0.01 = 1 credit)
  const credits = retailValue / creditValueCents;
  return Math.ceil(credits); // Round up to nearest integer
}

// ============================================================
// Promo discount calculation
// ============================================================

export async function calculatePromoDiscount(
  retailValue: number,
  promoCode: string,
  userId: string,
): Promise<{ discountAmount: number; bonusCredits: number }> {
  const promo = await prisma.promoCode.findUnique({
    where: { code: promoCode, active: true },
  });

  if (!promo) return { discountAmount: 0, bonusCredits: 0 };

  // Check validity
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { discountAmount: 0, bonusCredits: 0 };
  if (promo.endsAt && promo.endsAt < now) return { discountAmount: 0, bonusCredits: 0 };

  // Check redemption limits
  if (promo.maxRedemptions) {
    const count = await prisma.promoRedemption.count({
      where: { promoCodeId: promo.id },
    });
    if (count >= promo.maxRedemptions) return { discountAmount: 0, bonusCredits: 0 };
  }

  if (promo.maxPerUser) {
    const userCount = await prisma.promoRedemption.count({
      where: { promoCodeId: promo.id, userId },
    });
    if (userCount >= promo.maxPerUser) return { discountAmount: 0, bonusCredits: 0 };
  }

  // New customers only check
  if (promo.newCustomersOnly) {
    const existingRedemptions = await prisma.promoRedemption.count({
      where: { userId },
    });
    if (existingRedemptions > 0) return { discountAmount: 0, bonusCredits: 0 };
  }

  const value = Number(promo.value);

  switch (promo.type) {
    case "percent_discount":
      return { discountAmount: retailValue * (value / 100), bonusCredits: 0 };
    case "fixed_discount":
      return { discountAmount: Math.min(value, retailValue), bonusCredits: 0 };
    case "bonus_credits":
      return { discountAmount: 0, bonusCredits: Math.round(value) };
    default:
      return { discountAmount: 0, bonusCredits: 0 };
  }
}

// ============================================================
// Full quote pipeline
// ============================================================

export async function generateQuote(
  userId: string,
  modelId: string,
  params: Record<string, unknown>,
  promoCode?: string,
): Promise<QuoteResponse> {
  const providerCost = await calculateProviderCost(modelId, params);

  const model = await prisma.aiModel.findUnique({
    where: { id: modelId },
    include: { provider: true },
  });
  if (!model) throw new Error("Model not found");

  const adjustedCost = applyOverhead(providerCost, model.capability);
  const retail = await calculateRetail(adjustedCost, modelId);

  const promoResult = promoCode
    ? await calculatePromoDiscount(retail, promoCode, userId)
    : { discountAmount: 0, bonusCredits: 0 };

  const retailAfterDiscount = retail - promoResult.discountAmount;
  const credits = toCredits(retailAfterDiscount);

  // Add buffer for variable jobs
  const maxMultiplier = model.capability.startsWith("video") ? 1.15 : 1.05;
  const maximumCredits = Math.ceil(credits * maxMultiplier);

  // Get user wallet
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  const balance = wallet?.available ?? 0;

  const quoteId = `quote_${crypto.randomUUID()}`;

  return {
    quoteId,
    expiresAt: new Date(Date.now() + CONSTANTS.QUOTE_EXPIRY_SEC * 1000).toISOString(),
    providerCostEstimated: Math.round(providerCost * 10000) / 10000,
    platformCostEstimated: Math.round(adjustedCost * 10000) / 10000,
    retailBeforeDiscount: Math.round(retail * 100) / 100,
    discount: Math.round(promoResult.discountAmount * 100) / 100,
    retailAfterDiscount: Math.round(retailAfterDiscount * 100) / 100,
    credits,
    maximumCredits,
    balance,
    balanceAfterExpected: balance - credits,
    balanceAfterMaximum: balance - maximumCredits,
    warnings: balance < credits ? ["Insufficient balance for this operation"] : [],
  };
}

// ============================================================
// Margin analysis (Admin Advisor)
// ============================================================

export function calculateMargin(providerCost: number, retailRevenue: number): number {
  if (retailRevenue === 0) return 0;
  return (retailRevenue - providerCost) / retailRevenue;
}

export function calculateTargetRetail(providerCost: number, targetMargin: number): number {
  if (targetMargin >= 1) throw new Error("Target margin must be less than 100%");
  return providerCost / (1 - targetMargin);
}

export function simulatePlanMargin(
  planCredits: number,
  utilizationRate: number,
  avgProviderCost: number,
  planPrice: number,
  paymentFeePercent = CONSTANTS.PAYMENT_FEE_PERCENT,
  paymentFeeFixed = CONSTANTS.PAYMENT_FEE_FIXED,
): {
  revenueAfterFees: number;
  expectedAiCost: number;
  contribution: number;
  contributionMargin: number;
  worstCaseAiCost: number;
  worstCaseContribution: number;
} {
  const revenueAfterFees = planPrice - (planPrice * paymentFeePercent + paymentFeeFixed);
  const actualCreditsUsed = planCredits * utilizationRate;
  const expectedAiCost = actualCreditsUsed * avgProviderCost;
  const contribution = revenueAfterFees - expectedAiCost;
  const contributionMargin = revenueAfterFees > 0 ? contribution / revenueAfterFees : 0;

  // Worst case: 100% utilization
  const worstCaseAiCost = planCredits * avgProviderCost;
  const worstCaseContribution = revenueAfterFees - worstCaseAiCost;

  return {
    revenueAfterFees,
    expectedAiCost,
    contribution,
    contributionMargin,
    worstCaseAiCost,
    worstCaseContribution,
  };
}
