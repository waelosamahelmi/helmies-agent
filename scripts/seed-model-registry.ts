// Helmies Studio — Model Registry Seed
// Seeds AiProvider, AiModel, and AiModelPrice from the existing models.js catalog

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Model catalog from helmies-studio/src/lib/models.js
const IMAGE_MODELS = [
  { id: "nano-banana", name: "Nano Banana", provider: "Google", aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"], category: "image" },
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "Google", aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"], resolutions: ["1k", "2k", "4k"], category: "image" },
  { id: "flux-dev", name: "Flux Dev", provider: "Black Forest Labs", category: "image" },
  { id: "flux-schnell", name: "Flux Schnell", provider: "Black Forest Labs", category: "image" },
  { id: "flux-2-dev", name: "Flux 2 Dev", provider: "Black Forest Labs", category: "image" },
  { id: "flux-kontext-dev-t2i", name: "Flux Kontext Dev", provider: "Black Forest Labs", category: "image" },
  { id: "flux-kontext-pro-t2i", name: "Flux Kontext Pro", provider: "Black Forest Labs", category: "image" },
  { id: "midjourney-v7-text-to-image", name: "Midjourney v7", provider: "Midjourney", category: "image" },
  { id: "gpt4o-text-to-image", name: "GPT-4o", provider: "OpenAI", category: "image" },
  { id: "google-imagen4", name: "Imagen 4", provider: "Google", category: "image" },
  { id: "google-imagen4-ultra", name: "Imagen 4 Ultra", provider: "Google", category: "image" },
  { id: "bytedance-seedream-v4", name: "Seedream v4", provider: "ByteDance", category: "image" },
  { id: "qwen-image", name: "Qwen Image", provider: "Alibaba", category: "image" },
  { id: "sdxl-image", name: "SDXL", provider: "Stability AI", category: "image" },
  { id: "ideogram-v3-t2i", name: "Ideogram v3", provider: "Ideogram", category: "image" },
  { id: "grok-imagine-text-to-image", name: "Grok Imagine", provider: "xAI", category: "image" },
  { id: "hunyuan-image-3.0", name: "Hunyuan 3.0", provider: "Hunyuan", category: "image" },
  { id: "wan2.5-text-to-image", name: "Wan 2.5", provider: "Alibaba", category: "image" },
  { id: "kling-o1-text-to-image", name: "Kling O1", provider: "Kling AI", category: "image" },
  { id: "leonardoai-phoenix-1.0", name: "Phoenix 1.0", provider: "Leonardo AI", category: "image" },
];

const VIDEO_MODELS = [
  { id: "kling-v3", name: "Kling v3", provider: "Kling AI", category: "video", durations: [5, 10] },
  { id: "sora-2", name: "Sora 2", provider: "OpenAI", category: "video", durations: [5, 10, 15] },
  { id: "veo-3", name: "Veo 3", provider: "Google", category: "video", durations: [5, 8] },
  { id: "veo-3-fast", name: "Veo 3 Fast", provider: "Google", category: "video", durations: [5, 8] },
  { id: "wan-2.6", name: "Wan 2.6", provider: "Alibaba", category: "video", durations: [5, 10] },
  { id: "seedance-2.0", name: "Seedance 2.0", provider: "ByteDance", category: "video", durations: [5, 10, 15] },
  { id: "hailuo-02", name: "Hailuo 02", provider: "MiniMax", category: "video", durations: [6, 10] },
  { id: "runway-gen-3", name: "Runway Gen-3", provider: "Runway", category: "video", durations: [5, 10] },
  { id: "grok-imagine-t2v", name: "Grok Imagine T2V", provider: "xAI", category: "video", durations: [6, 10, 15] },
];

const I2V_MODELS = [
  { id: "kling-v2.1-i2v", name: "Kling v2.1 I2V", provider: "Kling AI", category: "video_i2v" },
  { id: "seedance-2.0-i2v", name: "Seedance 2.0 I2V", provider: "ByteDance", category: "video_i2v" },
  { id: "veo-3-i2v", name: "Veo 3 I2V", provider: "Google", category: "video_i2v" },
  { id: "wan-2.2-i2v", name: "Wan 2.2 I2V", provider: "Alibaba", category: "video_i2v" },
  { id: "hailuo-02-i2v", name: "Hailuo 02 I2V", provider: "MiniMax", category: "video_i2v" },
  { id: "runway-gen-3-i2v", name: "Runway Gen-3 I2V", provider: "Runway", category: "video_i2v" },
  { id: "kling-v3-i2v", name: "Kling v3 I2V", provider: "Kling AI", category: "video_i2v" },
];

const LIPSYNC_MODELS = [
  { id: "infinitetalk-image-to-video", name: "Infinite Talk", provider: "Helmies", category: "lipsync" },
  { id: "wan2.2-speech-to-video", name: "Wan 2.2 Speech", provider: "Alibaba", category: "lipsync" },
  { id: "ltx-2.3-lipsync", name: "LTX 2.3 Lipsync", provider: "LTX", category: "lipsync" },
  { id: "ltx-2-19b-lipsync", name: "LTX 2 19B", provider: "LTX", category: "lipsync" },
  { id: "sync-lipsync", name: "Sync Lipsync", provider: "Sync", category: "lipsync" },
  { id: "latentsync-video", name: "LatentSync", provider: "LatentSync", category: "lipsync" },
  { id: "creatify-lipsync", name: "Creatify", provider: "Creatify", category: "lipsync" },
  { id: "veed-lipsync", name: "Veed Lipsync", provider: "Veed", category: "lipsync" },
];

// Map category to capability
function getCapability(category: string): string {
  switch (category) {
    case "image": return "image.generate";
    case "video": return "video.generate";
    case "video_i2v": return "video.image_to_video";
    case "lipsync": return "lipsync";
    default: return "image.generate";
  }
}

// Map category to route key
function getRouteKey(category: string, quality: string = "standard"): string {
  switch (category) {
    case "image": return `image.${quality}`;
    case "video": return `video.${quality}`;
    case "video_i2v": return `video.${quality}`;
    case "lipsync": return "lipsync";
    default: return "image.standard";
  }
}

// Default pricing per category
function getDefaultPricing(category: string) {
  switch (category) {
    case "image": return { strategy: "per_image", unitCost: 0.035, creditsPerUnit: 100 };
    case "video": return { strategy: "per_second", unitCost: 0.075, tiers: { "720p": 0.05, "1080p": 0.075 } };
    case "video_i2v": return { strategy: "per_second", unitCost: 0.065, tiers: { "720p": 0.04, "1080p": 0.065 } };
    case "lipsync": return { strategy: "per_second", unitCost: 0.04 };
    default: return { strategy: "per_image", unitCost: 0.03 };
  }
}

async function seed() {
  console.log("🌱 Seeding model registry...");

  const allModels = [
    ...IMAGE_MODELS.map(m => ({ ...m, cat: "image" })),
    ...VIDEO_MODELS.map(m => ({ ...m, cat: "video" })),
    ...I2V_MODELS.map(m => ({ ...m, cat: "video_i2v" })),
    ...LIPSYNC_MODELS.map(m => ({ ...m, cat: "lipsync" })),
  ];

  // Collect unique providers
  const providerNames = [...new Set(allModels.map(m => m.provider))];

  // Create providers
  for (const name of providerNames) {
    const key = name.toLowerCase().replace(/\s+/g, "-");
    await prisma.aiProvider.upsert({
      where: { key },
      update: { name },
      create: {
        key,
        name,
        enabled: true,
        defaultMarkup: 2.5,
        defaultTargetMargin: 0.6,
        secretRef: `\${${key.toUpperCase().replace(/-/g, "_")}_KEY}`,
      },
    });
    console.log(`  ✅ Provider: ${name}`);
  }

  // Create models
  for (const model of allModels) {
    const providerKey = model.provider.toLowerCase().replace(/\s+/g, "-");
    const provider = await prisma.aiProvider.findUnique({ where: { key: providerKey } });
    if (!provider) continue;

    const capability = getCapability(model.cat);
    const pricing = getDefaultPricing(model.cat);

    const aiModel = await prisma.aiModel.upsert({
      where: {
        providerId_modelKey_capability: {
          providerId: provider.id,
          modelKey: model.id,
          capability,
        },
      },
      update: {
        displayName: model.name,
        category: model.cat,
        enabled: true,
      },
      create: {
        providerId: provider.id,
        modelKey: model.id,
        displayName: model.name,
        capability,
        category: model.cat,
        enabled: true,
        priority: 100,
        qualityScore: model.cat === "image" ? 0.85 : 0.75,
        speedScore: 0.7,
        reliabilityScore: 0.9,
        inputSchema: {
          fields: [
            { key: "prompt", type: "textarea", label: "Prompt", required: true, group: "Input" },
            { key: "aspectRatio", type: "aspect_ratio", label: "Aspect Ratio", group: "Output" },
            { key: "negativePrompt", type: "textarea", label: "Negative Prompt", group: "Advanced", advanced: true },
            { key: "seed", type: "seed", label: "Seed", group: "Advanced", advanced: true },
          ],
        },
        metadata: {
          provider: model.provider,
          aspectRatios: (model as any).aspectRatios || undefined,
          durations: (model as any).durations || undefined,
          resolutions: (model as any).resolutions || undefined,
        },
      },
    });

    // Create default price
    await prisma.aiModelPrice.upsert({
      where: {
        id: `price_${aiModel.id}_default`,
      },
      update: {
        strategy: pricing.strategy,
        params: pricing.strategy === "per_second"
          ? { unitCost: pricing.unitCost, tiers: (pricing as any).tiers }
          : { unitCost: pricing.unitCost, unit: model.cat === "image" ? "image" : "second" },
      },
      create: {
        id: `price_${aiModel.id}_default`,
        modelId: aiModel.id,
        strategy: pricing.strategy,
        currency: "USD",
        params: pricing.strategy === "per_second"
          ? { unitCost: pricing.unitCost, tiers: (pricing as any).tiers }
          : { unitCost: pricing.unitCost, unit: model.cat === "image" ? "image" : "second" },
        source: "seed-script",
        notes: `Default pricing for ${model.name}`,
      },
    });

    // Create route entries
    const routeKeys = ["fast", "standard", "premium"];
    for (const quality of routeKeys) {
      await prisma.modelRoute.upsert({
        where: {
          routeKey_modelId: {
            routeKey: getRouteKey(model.cat, quality),
            modelId: aiModel.id,
          },
        },
        update: { enabled: quality === "standard" },
        create: {
          routeKey: getRouteKey(model.cat, quality),
          modelId: aiModel.id,
          enabled: quality === "standard",
          priority: quality === "fast" ? 10 : quality === "standard" ? 20 : 30,
          conditions: { quality },
        },
      });
    }

    console.log(`  ✅ Model: ${model.name} (${capability})`);
  }

  // Seed default pricing plans
  const plans = [
    { slug: "free", name: "Free", monthlyCredits: 100, popular: false, sortOrder: 0 },
    { slug: "starter", name: "Starter", monthlyCredits: 1000, popular: false, sortOrder: 1 },
    { slug: "studio", name: "Studio", monthlyCredits: 3000, popular: true, sortOrder: 2 },
    { slug: "pro", name: "Pro", monthlyCredits: 10000, popular: false, sortOrder: 3 },
  ];

  for (const plan of plans) {
    await prisma.pricingPlan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name, monthlyCredits: plan.monthlyCredits, popular: plan.popular },
      create: {
        id: plan.slug,
        slug: plan.slug,
        name: plan.name,
        description: `${plan.name} plan with ${plan.monthlyCredits} monthly credits`,
        monthlyCredits: plan.monthlyCredits,
        popular: plan.popular,
        sortOrder: plan.sortOrder,
        featureConfig: { features: [`${plan.monthlyCredits} credits/month`, "Access to all models"] },
        limits: { maxConcurrency: plan.slug === "pro" ? 10 : plan.slug === "studio" ? 5 : 2 },
      },
    });
    console.log(`  ✅ Plan: ${plan.name}`);
  }

  // Seed feature flags
  const flags = [
    "new_studio_shell", "model_gateway_v2", "pricing_preflight", "wallet_v2",
    "image_studio_v2", "image_canvas", "visual_intelligence", "brand_kits",
    "agent_creative_tools", "director", "admin_v2", "promo_codes", "cms_content", "admin_advisor",
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag },
      update: {},
      create: {
        key: flag,
        name: flag.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        enabled: flag === "model_gateway_v2" || flag === "wallet_v2",
      },
    });
  }
  console.log(`  ✅ Feature flags: ${flags.length} seeded`);

  console.log("\n🎉 Seed complete!");
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
