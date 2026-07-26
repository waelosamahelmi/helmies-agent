// Helmies Studio — Admin Routes (Phase 15 foundation)

import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(requireAdmin());

/**
 * GET /api/admin/overview
 * Dashboard overview cards.
 */
adminRouter.get("/overview", async (_req, res) => {
  try {
    const [userCount, paidUserCount, totalGenerations, activeJobs] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { plan: { not: "free" }, status: "active" } }),
      prisma.generationJob.count(),
      prisma.generationJob.count({ where: { status: { in: ["queued", "submitted", "processing"] } } }),
    ]);

    res.json({
      users: userCount,
      paidUsers: paidUserCount,
      totalGenerations,
      activeJobs,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get overview" });
  }
});

/**
 * GET /api/admin/users
 * List users (search, paginate).
 */
adminRouter.get("/users", async (req, res) => {
  try {
    const search = req.query.search as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const users = await prisma.user.findMany({
      where: search
        ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] }
        : {},
      include: {
        wallet: true,
        subscriptions: { take: 1, orderBy: { createdAt: "desc" } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.user.count();

    res.json({ users, total });
  } catch (error) {
    res.status(500).json({ error: "Failed to list users" });
  }
});

/**
 * GET /api/admin/models
 * List all AI models.
 */
adminRouter.get("/models", async (_req, res) => {
  try {
    const models = await prisma.aiModel.findMany({
      include: {
        provider: true,
        prices: { take: 1, orderBy: { effectiveFrom: "desc" } },
        routes: true,
      },
      orderBy: [{ category: "asc" }, { priority: "asc" }],
    });

    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: "Failed to list models" });
  }
});

/**
 * GET /api/admin/providers
 * List all AI providers.
 */
adminRouter.get("/providers", async (_req, res) => {
  try {
    const providers = await prisma.aiProvider.findMany({
      include: { models: true },
    });

    // Never expose secret references
    const safe = providers.map((p) => ({
      ...p,
      secretRef: p.secretRef ? "***configured***" : null,
    }));

    res.json({ providers: safe });
  } catch (error) {
    res.status(500).json({ error: "Failed to list providers" });
  }
});

/**
 * GET /api/admin/audit
 * Audit log viewer.
 */
adminRouter.get("/audit", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

// ============================================================
// Admin Advisor (Sections 111-114, 208)
// ============================================================

import {
  calculatePlanMargin,
  simulatePromo,
  compareModelProfitability,
  calculateBreakEven,
  calculateCreditPackMargin,
  detectCostAnomaly,
} from "@helmies/pricing-engine/advisor-calculators";

/**
 * POST /api/admin/advisor/plan-margin
 * Calculate margin for a pricing plan.
 */
adminRouter.post("/advisor/plan-margin", async (req, res) => {
  try {
    const result = calculatePlanMargin(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/advisor/simulate-promo
 * Simulate promo code financial impact (Section 98, 208).
 */
adminRouter.post("/advisor/simulate-promo", async (req, res) => {
  try {
    const result = simulatePromo(req.body);

    // Store scenario for audit
    await prisma.adminAdvisorScenario.create({
      data: {
        adminId: req.userContext!.platformUserId,
        question: `Simulate promo: ${req.body.promoType} ${req.body.promoValue}`,
        inputAssumptions: req.body,
        calculatorOutput: result,
      },
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/advisor/model-profitability
 * Compare profitability across models.
 */
adminRouter.post("/advisor/model-profitability", async (req, res) => {
  try {
    const result = compareModelProfitability(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/advisor/break-even
 * Calculate break-even point.
 */
adminRouter.post("/advisor/break-even", async (req, res) => {
  try {
    const result = calculateBreakEven(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/advisor/credit-pack-margin
 * Calculate credit pack margins.
 */
adminRouter.post("/advisor/credit-pack-margin", async (req, res) => {
  try {
    const result = calculateCreditPackMargin(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/advisor/cost-anomaly
 * Detect cost anomalies for a model.
 */
adminRouter.post("/advisor/cost-anomaly", async (req, res) => {
  try {
    const result = detectCostAnomaly(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// Promo Codes CRUD (Sections 97-98, 208)
// ============================================================

/**
 * GET /api/admin/promos
 */
adminRouter.get("/promos", async (_req, res) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { redemptions: { select: { id: true } } },
    });
    res.json({ promos });
  } catch (error) {
    res.status(500).json({ error: "Failed to list promos" });
  }
});

/**
 * POST /api/admin/promos — Create with guardrail check (Section 98)
 */
adminRouter.post("/promos", async (req, res) => {
  try {
    const { code, type, value, appliesToPlans, maxRedemptions } = req.body;

    // Run guardrail: simulate financial impact
    let guardrailWarning = null;
    if (type === "percent_discount" && value > 40) {
      guardrailWarning = {
        level: "high_risk",
        message: `Discount of ${value}% exceeds 40% maximum recommended`,
      };
    }

    const promo = await prisma.promoCode.create({
      data: {
        code,
        type,
        value,
        appliesToPlans: appliesToPlans || undefined,
        maxRedemptions: maxRedemptions || undefined,
        active: false, // Must be explicitly activated after review
      },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        userId: req.userContext!.platformUserId,
        action: "promo_created",
        resource: "promo_code",
        resourceId: promo.id,
        metadata: { code, type, value: value.toString(), guardrailWarning },
      },
    });

    res.json({ promo, guardrailWarning });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/promos/:id — Activate/deactivate
 */
adminRouter.patch("/promos/:id", async (req, res) => {
  try {
    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: {
        active: req.body.active,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userContext!.platformUserId,
        action: req.body.active ? "promo_activated" : "promo_deactivated",
        resource: "promo_code",
        resourceId: promo.id,
      },
    });

    res.json({ promo });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// CMS (Sections 108-109, 158-159, 209)
// ============================================================

/**
 * GET /api/admin/cms
 */
adminRouter.get("/cms", async (req, res) => {
  try {
    const namespace = req.query.namespace as string || "landing";
    const entries = await prisma.cmsEntry.findMany({
      where: { namespace },
      orderBy: { key: "asc" },
    });
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: "Failed to get CMS entries" });
  }
});

/**
 * PUT /api/admin/cms — Upsert CMS entry
 */
adminRouter.put("/cms", async (req, res) => {
  try {
    const { namespace, key, value, locale } = req.body;
    if (!namespace || !key) {
      return res.status(400).json({ error: "namespace and key required" });
    }

    // Validate: no scripts or HTML injection
    if (typeof value === "string" && /<script|<iframe|javascript:/i.test(value)) {
      return res.status(400).json({ error: "HTML scripts and iframes not allowed in CMS" });
    }

    const entry = await prisma.cmsEntry.upsert({
      where: {
        namespace_key_locale: {
          namespace,
          key,
          locale: locale || "en",
        },
      },
      update: {
        value: value as any,
        updatedBy: req.userContext!.platformUserId,
        version: { increment: 1 },
      },
      create: {
        namespace,
        key,
        locale: locale || "en",
        value: value as any,
        updatedBy: req.userContext!.platformUserId,
      },
    });

    // Create revision
    await prisma.cmsRevision.create({
      data: {
        entryId: entry.id,
        version: entry.version,
        value: value as any,
        updatedBy: req.userContext!.platformUserId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userContext!.platformUserId,
        action: "cms_updated",
        resource: "cms_entry",
        resourceId: entry.id,
        metadata: { namespace, key },
      },
    });

    res.json({ entry });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cms/publish — Publish a CMS entry
 */
adminRouter.post("/cms/publish", async (req, res) => {
  try {
    const { entryId } = req.body;
    const entry = await prisma.cmsEntry.update({
      where: { id: entryId },
      data: { published: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userContext!.platformUserId,
        action: "cms_published",
        resource: "cms_entry",
        resourceId: entryId,
      },
    });

    res.json({ entry });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// Announcements (Sections 110, 91.18)
// ============================================================

/**
 * GET /api/admin/announcements
 */
adminRouter.get("/announcements", async (_req, res) => {
  try {
    const announcements = await prisma.siteAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: "Failed to get announcements" });
  }
});

/**
 * POST /api/admin/announcements
 */
adminRouter.post("/announcements", async (req, res) => {
  try {
    const announcement = await prisma.siteAnnouncement.create({
      data: {
        message: req.body.message,
        style: req.body.style || "info",
        linkLabel: req.body.linkLabel,
        linkUrl: req.body.linkUrl,
        enabled: req.body.enabled || false,
        dismissible: req.body.dismissible !== false,
        startsAt: req.body.startsAt,
        endsAt: req.body.endsAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userContext!.platformUserId,
        action: "announcement_created",
        resource: "site_announcement",
        resourceId: announcement.id,
      },
    });

    res.json({ announcement });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/announcements/:id
 */
adminRouter.patch("/announcements/:id", async (req, res) => {
  try {
    const announcement = await prisma.siteAnnouncement.update({
      where: { id: req.params.id },
      data: {
        enabled: req.body.enabled,
        message: req.body.message,
        endsAt: req.body.endsAt,
      },
    });
    res.json({ announcement });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
