// Helmies Studio — Prompt Guide Seed
// Section 34: Seeds the PromptGuide registry with default guides per model category.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GUIDES = [
  {
    key: "image/base",
    name: "Image Generation — Base",
    category: "image",
    content: `Create a high-quality, detailed image. Describe the subject, setting, lighting, composition, and mood. Use descriptive prose. Include technical quality keywords: sharp focus, high resolution, professional photography.`,
  },
  {
    key: "image/product",
    name: "Image Generation — Product",
    category: "image",
    content: `Product photography style. Clean commercial lighting, studio background, sharp focus on product. Show product details clearly. Professional e-commerce quality. White/neutral background preferred unless specified otherwise.`,
  },
  {
    key: "image/portrait",
    name: "Image Generation — Portrait",
    category: "image",
    content: `Professional portrait photography. Flattering lighting, shallow depth of field, focus on subject's face and expression. Natural skin texture, authentic look. Environmental or studio setting as specified.`,
  },
  {
    key: "image/poster",
    name: "Image Generation — Poster",
    category: "image",
    content: `Bold poster design. Strong visual hierarchy, eye-catching composition. Clean typography area. High contrast. Memorable visual impact. Professional graphic design quality.`,
  },
  {
    key: "image/brand",
    name: "Image Generation — Brand",
    category: "image",
    content: `On-brand commercial imagery. Use brand colors and visual style. Consistent with brand identity. Professional marketing quality. Maintain brand logo placement and proportions.`,
  },
  {
    key: "video/base",
    name: "Video Generation — Base",
    category: "video",
    content: `Create a high-quality video clip. Describe the action, camera movement, environment, lighting, and mood. Specify duration and pacing. Smooth motion, professional cinematography.`,
  },
  {
    key: "video/cinematic",
    name: "Video Generation — Cinematic",
    category: "video",
    content: `Cinematic video style. Film-like quality, widescreen composition, cinematic lighting. Slow, deliberate camera movement. Rich color grading. Professional film aesthetic.`,
  },
  {
    key: "video/ugc",
    name: "Video Generation — UGC",
    category: "video",
    content: `User-generated content style. Natural, authentic feel. Handheld camera look, natural lighting. Casual, relatable tone. Social media vertical format. Genuine, unscripted appearance.`,
  },
  {
    key: "video/music-video",
    name: "Video Generation — Music Video",
    category: "video",
    content: `Music video style. Dynamic camera movement, rhythmic editing pace. Creative visual transitions. Synchronized to music timing. Artistic, expressive visual style.`,
  },
  {
    key: "video/dialogue",
    name: "Video Generation — Dialogue",
    category: "video",
    content: `Dialogue scene. Focus on speaker. Clear lip visibility for sync. Appropriate framing for conversation. Natural ambient lighting. Subtle background activity.`,
  },
  {
    key: "audio/tts",
    name: "TTS — Text to Speech",
    category: "audio",
    content: `Natural, expressive text-to-speech. Clear pronunciation, appropriate pacing, natural intonation. Match the specified voice character and emotion. High clarity, no artifacts.`,
  },
  {
    key: "audio/music",
    name: "Music Generation",
    category: "audio",
    content: `Professional music generation. Clear instrumentation, appropriate genre conventions. Well-structured composition with intro, development, and outro. High-quality audio production.`,
  },
  {
    key: "model/flux-dev",
    name: "Flux Dev — Model Guide",
    category: "model",
    content: `Use descriptive natural language. Describe the full scene including subject, environment, lighting, and style. Flux responds well to detailed atmospheric descriptions. Avoid overly terse prompts. Include quality keywords: masterpiece, best quality, highly detailed.`,
  },
];

async function seedPromptGuides() {
  console.log("🌱 Seeding Prompt Guides...");

  for (const guide of GUIDES) {
    const existing = await prisma.promptGuide.findUnique({
      where: { key: guide.key },
    });

    if (!existing) {
      const created = await prisma.promptGuide.create({
        data: {
          key: guide.key,
          name: guide.name,
          category: guide.category,
        },
      });

      await prisma.promptGuideVersion.create({
        data: {
          guideId: created.id,
          version: 1,
          content: guide.content,
          createdBy: "system",
        },
      });

      await prisma.promptGuide.update({
        where: { id: created.id },
        data: { activeVersion: 1 },
      });

      console.log(`  ✅ ${guide.key}`);
    } else {
      console.log(`  ⏭️  ${guide.key} (exists)`);
    }
  }

  console.log(`\n🎉 Seeded ${GUIDES.length} prompt guides`);
}

seedPromptGuides()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
