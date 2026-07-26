// Helmies Studio — Public API Routes
// Unauthenticated endpoints for landing page, pricing, CMS, announcements

import { Router } from "express";
import { prisma } from "../lib/prisma";

export const publicRouter = Router();

/**
 * GET /api/public/plans
 * Public pricing plans for landing page and checkout.
 */
publicRouter.get("/plans", async (_req, res) => {
  try {
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

    const formatted = plans.map((plan) => {
      const monthly = plan.prices.find((p) => p.billingPeriod === "monthly");
      const yearly = plan.prices.find((p) => p.billingPeriod === "yearly");

      return {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        popular: plan.popular,
        credits: plan.monthlyCredits,
        features: plan.featureConfig,
        monthly: monthly
          ? {
              price: Number(monthly.amount),
              currency: monthly.currency,
              stripePriceId: monthly.stripePriceId,
            }
          : null,
        yearly: yearly
          ? {
              displayMonthly: Math.round(Number(yearly.amount) / 12),
              billedYearly: Number(yearly.amount),
              currency: yearly.currency,
              stripePriceId: yearly.stripePriceId,
            }
          : null,
      };
    });

    res.json({ plans: formatted });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

/**
 * GET /api/public/stats
 * Public stats (model counts, generation counts).
 */
publicRouter.get("/stats", async (_req, res) => {
  try {
    const modelCount = await prisma.aiModel.count({
      where: { enabled: true, hidden: false },
    });

    const imageModels = await prisma.aiModel.count({
      where: { enabled: true, hidden: false, capability: { startsWith: "image" } },
    });

    const videoModels = await prisma.aiModel.count({
      where: { enabled: true, hidden: false, capability: { startsWith: "video" } },
    });

    res.json({
      totalModels: modelCount,
      imageModels,
      videoModels,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * GET /api/public/cms
 * CMS content for landing page.
 */
publicRouter.get("/cms", async (req, res) => {
  try {
    const namespace = (req.query.namespace as string) || "landing";
    const locale = (req.query.locale as string) || "en";

    const entries = await prisma.cmsEntry.findMany({
      where: { namespace, locale, published: true },
    });

    const content: Record<string, unknown> = {};
    for (const entry of entries) {
      content[entry.key] = entry.value;
    }

    res.json({ namespace, locale, content });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CMS content" });
  }
});

/**
 * GET /api/public/announcements
 * Active site announcements.
 */
publicRouter.get("/announcements", async (_req, res) => {
  try {
    const now = new Date();
    const announcements = await prisma.siteAnnouncement.findMany({
      where: {
        enabled: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
        ...({
          OR: [
            { endsAt: null },
            { endsAt: { gte: now } },
          ],
        } as any),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});
