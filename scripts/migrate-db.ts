// Helmies Studio — DB Migration Scripts
// Sections 90, 92-93: Wallet migration, provider secret migration, ProjectMemory migration.
// Rules: additive before destructive, preserve existing data, keep rollback options.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// Migration 1: Wallet V2 (Section 92)
// ============================================================

async function migrateWalletV2() {
  console.log("🔄 Migrating User.credits → CreditWallet...");

  const users = await prisma.user.findMany({
    select: { id: true, credits: true },
    where: { wallet: null },
  });

  let migrated = 0;
  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      // Create wallet
      await tx.creditWallet.create({
        data: {
          userId: user.id,
          available: user.credits,
          reserved: 0,
          lifetimeCredited: BigInt(user.credits),
          lifetimeDebited: BigInt(0),
        },
      });

      // Create opening ledger
      await tx.creditLedger.create({
        data: {
          userId: user.id,
          delta: user.credits,
          balanceAfter: user.credits,
          reservedAfter: 0,
          type: "migration_opening_balance",
          description: "Wallet V2 migration — opening balance from User.credits",
        },
      });

      migrated++;
    });
  }

  console.log(`✅ Migrated ${migrated} users to CreditWallet`);
  return migrated;
}

// ============================================================
// Migration 2: Provider Secrets (Rule 19-20)
// ============================================================

async function migrateProviderSecrets() {
  console.log("🔄 Migrating plaintext ProviderConfig.apiKey → secretRef...");

  const configs = await prisma.providerConfig.findMany({
    where: { apiKey: { not: "" } },
  });

  let migrated = 0;
  for (const config of configs) {
    if (!config.apiKey || config.apiKey.length < 5) continue;

    // Create AiProvider with secretRef
    const key = config.name.toLowerCase().replace(/\s+/g, "-");
    await prisma.aiProvider.upsert({
      where: { key },
      update: {
        secretRef: `\${${config.name.toUpperCase().replace(/\s+/g, "_")}_KEY}`,
        baseUrl: config.baseUrl || undefined,
        defaultMarkup: config.markup || 2.5,
      },
      create: {
        key,
        name: config.name,
        enabled: config.isActive,
        baseUrl: config.baseUrl || undefined,
        secretRef: `\${${config.name.toUpperCase().replace(/\s+/g, "_")}_KEY}`,
        defaultMarkup: config.markup || 2.5,
      },
    });

    migrated++;
  }

  console.log(`✅ Migrated ${migrated} provider configs to secretRef model`);
  console.log("⚠️  Remember to set actual API keys via environment variables or Docker secrets");
  console.log("⚠️  The old ProviderConfig.apiKey values should be deleted AFTER verifying new setup");
  return migrated;
}

// ============================================================
// Migration 3: ProjectMemory → BrandKit, Asset, StylePreset (Section 162)
// ============================================================

async function migrateProjectMemory() {
  console.log("🔄 Migrating ProjectMemory → BrandKit / Asset / StylePreset...");

  const memories = await prisma.projectMemory.findMany();
  let brandsMigrated = 0;
  let assetsMigrated = 0;
  let stylesMigrated = 0;

  for (const memory of memories) {
    const data = memory.data as Record<string, unknown>;

    switch (memory.type) {
      case "brand": {
        await prisma.brandKit.create({
          data: {
            userId: memory.userId,
            name: memory.name,
            description: `Migrated from ProjectMemory: ${memory.name}`,
            config: data,
            enforcementMode: "suggest",
          },
        });
        brandsMigrated++;
        break;
      }
      case "asset": {
        const assetData = data as any;
        await prisma.asset.create({
          data: {
            userId: memory.userId,
            type: assetData.type || "image",
            source: "migration",
            storageKey: assetData.storageKey || `migration/${memory.id}`,
            mimeType: assetData.mimeType || "image/png",
            metadata: {
              migratedFrom: "ProjectMemory",
              originalType: memory.type,
              originalName: memory.name,
            },
          },
        });
        assetsMigrated++;
        break;
      }
      case "character":
      case "style": {
        await prisma.stylePreset.create({
          data: {
            userId: memory.userId,
            name: memory.name,
            type: memory.type,
            data,
          },
        });
        stylesMigrated++;
        break;
      }
    }
  }

  console.log(`✅ Migrated: ${brandsMigrated} brands, ${assetsMigrated} assets, ${stylesMigrated} styles`);
  return { brandsMigrated, assetsMigrated, stylesMigrated };
}

// ============================================================
// Migration 4: ModelPricing → AiModelPrice (Section 90.18-19)
// ============================================================

async function migrateModelPricing() {
  console.log("🔄 Migrating ModelPricing → AiModelPrice...");

  const prices = await prisma.modelPricing.findMany({
    where: { isActive: true },
  });

  let migrated = 0;
  for (const price of prices) {
    // Find or create AiModel
    const providerKey = price.providerName.toLowerCase().replace(/\s+/g, "-");
    const provider = await prisma.aiProvider.findUnique({ where: { key: providerKey } });

    if (!provider) {
      console.warn(`  ⚠️  Provider not found: ${price.providerName}, skipping model ${price.modelId}`);
      continue;
    }

    const model = await prisma.aiModel.upsert({
      where: {
        providerId_modelKey_capability: {
          providerId: provider.id,
          modelKey: price.modelId,
          capability: price.modelType || "image.generate",
        },
      },
      update: { displayName: price.modelId },
      create: {
        providerId: provider.id,
        modelKey: price.modelId,
        displayName: price.modelId,
        capability: price.modelType || "image.generate",
        category: price.modelType || "image",
        enabled: true,
        inputSchema: { fields: [] },
        priority: 100,
      },
    });

    // Create price record
    await prisma.aiModelPrice.create({
      data: {
        modelId: model.id,
        strategy: "fixed",
        currency: "USD",
        params: {
          unitCost: price.providerCost || 0.01,
          creditsCost: price.creditsCost || 1,
        },
        source: "migration",
        notes: `Migrated from ModelPricing: ${price.modelId}`,
      },
    });

    migrated++;
  }

  console.log(`✅ Migrated ${migrated} model prices`);
  console.log("⚠️  Review and enhance pricing strategies (per_second, tiered_duration, etc.)");
  return migrated;
}

// ============================================================
// Migration 5: Generation → GenerationJob (Section 161)
// ============================================================

async function migrateGenerationsToJobs() {
  console.log("🔄 Migrating historical Generation records → GenerationJob...");

  const generations = await prisma.generation.findMany({
    where: { status: { not: "pending" } },
    take: 10000,
  });

  let migrated = 0;
  for (const gen of generations) {
    const job = await prisma.generationJob.findFirst({
      where: { userId: gen.userId, idempotencyKey: `migrated_${gen.id}` },
    });

    if (job) continue; // Already migrated

    const status = mapGenerationStatus(gen.status);

    await prisma.generationJob.create({
      data: {
        userId: gen.userId,
        capability: mapToolToCapability(gen.tool),
        modelId: gen.model,
        status,
        idempotencyKey: `migrated_${gen.id}`,
        normalizedRequest: (gen.params as Record<string, unknown>) || { prompt: gen.prompt },
        quoteSnapshot: {
          credits: gen.creditsUsed,
          providerCost: gen.providerCost || 0,
        },
        estimatedCredits: gen.creditsUsed,
        actualCredits: gen.creditsUsed,
        providerCost: gen.providerCost || 0,
        safeError: gen.error || undefined,
        completedAt: gen.createdAt,
        createdAt: gen.createdAt,
      },
    });

    migrated++;
    if (migrated % 1000 === 0) {
      console.log(`  ... migrated ${migrated} generations`);
    }
  }

  console.log(`✅ Migrated ${migrated} generation records to GenerationJob`);
  return migrated;
}

function mapGenerationStatus(status: string): string {
  const map: Record<string, string> = {
    completed: "completed",
    failed: "failed",
    pending: "reserved",
    processing: "processing",
    cancelled: "cancelled",
  };
  return map[status] || "completed";
}

function mapToolToCapability(tool: string): string {
  const map: Record<string, string> = {
    image: "image.generate",
    i2i: "image.edit",
    video: "video.generate",
    i2v: "video.image_to_video",
    v2v: "video.video_to_video",
    audio: "audio.tts",
    lipsync: "lipsync",
    recast: "recast",
    cinema: "video.generate",
    marketing: "video.generate",
    clipping: "video.video_to_video",
    influencer: "image.generate",
    motion: "video.generate",
  };
  return map[tool] || "image.generate";
}

// ============================================================
// Run all migrations
// ============================================================

async function runAllMigrations() {
  console.log("🚀 Helmies Studio — Database Migration Runner\n");

  try {
    await migrateWalletV2();
    console.log();
    await migrateProviderSecrets();
    console.log();
    await migrateProjectMemory();
    console.log();
    await migrateModelPricing();
    console.log();
    await migrateGenerationsToJobs();
    console.log();

    console.log("🎉 All migrations complete!");
    console.log("\n⚠️  Post-migration checklist:");
    console.log("  1. Verify CreditWallet balances match User.credits");
    console.log("  2. Set provider API keys via environment variables");
    console.log("  3. Review AiModelPrice strategies (upgrade from fixed to per_second/etc.)");
    console.log("  4. Run validation script to check data integrity");
    console.log("  5. Keep old tables as compatibility mirror until verified");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAllMigrations();
