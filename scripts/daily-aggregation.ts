// Helmies Studio — Daily Aggregation Jobs (Section 151)
// Aggregates provider_model_daily, capability_daily, plan_daily for admin dashboards.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function runDailyAggregation(date?: Date) {
  const targetDate = date || new Date();
  targetDate.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate.getTime() + 86400000);

  console.log(`📊 Running daily aggregation for ${targetDate.toISOString().slice(0, 10)}`);

  // 1. Provider-Model daily
  const jobs = await prisma.generationJob.findMany({
    where: {
      createdAt: { gte: targetDate, lt: dayEnd },
      modelId: { not: null },
      providerId: { not: null },
    },
    select: {
      providerId: true,
      modelId: true,
      status: true,
      providerCost: true,
      retailValue: true,
      actualCredits: true,
    },
  });

  const grouped = new Map<string, {
    providerId: string;
    modelId: string;
    jobs: number;
    success: number;
    failed: number;
    providerCost: number;
    retailValue: number;
    credits: number;
  }>();

  for (const job of jobs) {
    const key = `${job.providerId}:${job.modelId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        providerId: job.providerId!,
        modelId: job.modelId!,
        jobs: 0, success: 0, failed: 0,
        providerCost: 0, retailValue: 0, credits: 0,
      });
    }
    const entry = grouped.get(key)!;
    entry.jobs++;
    if (job.status === "completed") entry.success++;
    if (job.status === "failed") entry.failed++;
    entry.providerCost += Number(job.providerCost || 0);
    entry.retailValue += Number(job.retailValue || 0);
    entry.credits += job.actualCredits || 0;
  }

  for (const [, entry] of grouped) {
    await prisma.providerModelDaily.upsert({
      where: {
        date_providerId_modelId: {
          date: targetDate,
          providerId: entry.providerId,
          modelId: entry.modelId,
        },
      },
      update: {
        jobs: entry.jobs,
        success: entry.success,
        failed: entry.failed,
        providerCost: entry.providerCost,
        retailValue: entry.retailValue,
        credits: entry.credits,
      },
      create: {
        date: targetDate,
        providerId: entry.providerId,
        modelId: entry.modelId,
        jobs: entry.jobs,
        success: entry.success,
        failed: entry.failed,
        providerCost: entry.providerCost,
        retailValue: entry.retailValue,
        credits: entry.credits,
      },
    });
  }

  console.log(`✅ Aggregated ${grouped.size} provider-model combinations`);

  // 2. Plan daily
  const subscriptions = await prisma.subscription.findMany({
    where: { status: "active" },
    select: { plan: true },
  });

  const planCounts = new Map<string, number>();
  for (const sub of subscriptions) {
    planCounts.set(sub.plan, (planCounts.get(sub.plan) || 0) + 1);
  }

  console.log(`📊 Plan distribution: ${JSON.stringify(Object.fromEntries(planCounts))}`);

  return { providerModels: grouped.size, plans: planCounts.size };
}

// Run if called directly
if (require.main === module) {
  runDailyAggregation()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); process.exit(1); });
}
