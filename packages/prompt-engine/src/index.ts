// Helmies Studio — Prompt Intelligence Engine
// 5-pass prompt pipeline: Intent Normalization → Context Enrichment →
// Creative Expansion → Model Dialect → Deterministic Validation

import type { GenerationCapability } from "@helmies/contracts";

// ============================================================
// Pass 0: Intent Normalization
// ============================================================

export interface NormalizedIntent {
  goal: string;
  subject: string;
  action: string;
  environment: string;
  style: string;
  camera: string;
  mood: string;
  platform: string;
  aspect: string;
  exactText: string[];
  immutableFacts: string[];
  references: string[];
  negativeConstraints: string[];
}

export function normalizeIntent(
  rawPrompt: string,
  capability: GenerationCapability,
  immutableFacts?: string[],
): NormalizedIntent {
  // Basic normalization without LLM — extracts structured fields
  const intent: NormalizedIntent = {
    goal: "",
    subject: "",
    action: "",
    environment: "",
    style: "photorealistic",
    camera: "medium shot",
    mood: "professional",
    platform: "instagram",
    aspect: "1:1",
    exactText: [],
    immutableFacts: immutableFacts || [],
    references: [],
    negativeConstraints: [],
  };

  // Extract known patterns from the raw prompt
  const lower = rawPrompt.toLowerCase();

  if (lower.includes("ad") || lower.includes("advertisement") || lower.includes("promote")) {
    intent.goal = "advertisement";
  } else if (lower.includes("poster") || lower.includes("banner")) {
    intent.goal = "poster";
  } else if (lower.includes("thumbnail")) {
    intent.goal = "thumbnail";
  } else {
    intent.goal = "image_generation";
  }

  // Detect style
  if (lower.includes("photorealistic") || lower.includes("realistic") || lower.includes("photo")) {
    intent.style = "photorealistic";
  } else if (lower.includes("cinematic") || lower.includes("film")) {
    intent.style = "cinematic";
  } else if (lower.includes("illustration") || lower.includes("cartoon")) {
    intent.style = "illustration";
  } else if (lower.includes("3d") || lower.includes("render")) {
    intent.style = "3d_render";
  } else if (lower.includes("anime") || lower.includes("manga")) {
    intent.style = "anime";
  }

  // Detect platform/aspect
  if (lower.includes("instagram") || lower.includes("reel")) {
    intent.platform = "instagram";
    intent.aspect = "9:16";
  } else if (lower.includes("youtube")) {
    intent.platform = "youtube";
    intent.aspect = "16:9";
  } else if (lower.includes("tiktok")) {
    intent.platform = "tiktok";
    intent.aspect = "9:16";
  } else if (lower.includes("story")) {
    intent.aspect = "9:16";
  }

  // Detect camera
  if (lower.includes("close-up") || lower.includes("closeup")) {
    intent.camera = "close-up";
  } else if (lower.includes("wide shot") || lower.includes("wide angle")) {
    intent.camera = "wide shot";
  }

  // Detect mood
  if (lower.includes("dark") || lower.includes("moody")) {
    intent.mood = "dark_moody";
  } else if (lower.includes("bright") || lower.includes("sunny")) {
    intent.mood = "bright_cheerful";
  } else if (lower.includes("luxury") || lower.includes("premium") || lower.includes("elegant")) {
    intent.mood = "luxury_premium";
  } else if (lower.includes("energetic") || lower.includes("dynamic")) {
    intent.mood = "energetic";
  }

  intent.subject = rawPrompt;

  return intent;
}

// ============================================================
// Pass 1: Context Enrichment
// ============================================================

export interface BrandContext {
  palette?: { primary: string[]; secondary: string[] };
  typography?: { heading?: string; body?: string };
  visualStyle?: Record<string, unknown>;
  logoRules?: string[];
  tone?: string;
}

export interface PromptContext {
  brand?: BrandContext;
  project?: { name: string; description?: string };
  canvas?: { instructions: string[] };
  references?: { caption: string; palette: string[] }[];
}

export function enrichWithContext(
  intent: NormalizedIntent,
  context: PromptContext,
): NormalizedIntent {
  const enriched = { ...intent, negativeConstraints: [...intent.negativeConstraints] };

  // Add brand constraints
  if (context.brand) {
    if (context.brand.visualStyle) {
      enriched.style = enriched.style || "brand_default";
    }
    if (context.brand.logoRules?.length) {
      enriched.immutableFacts = [...enriched.immutableFacts, ...context.brand.logoRules];
    }
    if (context.brand.tone) {
      enriched.mood = enriched.mood || context.brand.tone;
    }
    // Add brand palette to avoid conflicting colors
    if (context.brand.palette) {
      enriched.negativeConstraints.push(
        ...context.brand.palette.primary.map((c) => `avoid non-brand colors, use ${c}`),
      );
    }
  }

  // Add canvas instructions
  if (context.canvas?.instructions?.length) {
    enriched.immutableFacts = [...enriched.immutableFacts, ...context.canvas.instructions];
  }

  return enriched;
}

// ============================================================
// Pass 2: Creative Expansion
// ============================================================

export function creativeExpand(intent: NormalizedIntent, capability: GenerationCapability): string {
  let prompt = "";

  if (capability.startsWith("image")) {
    prompt = buildImagePrompt(intent);
  } else if (capability.startsWith("video")) {
    prompt = buildVideoPrompt(intent);
  } else if (capability.startsWith("audio")) {
    prompt = buildAudioPrompt(intent);
  } else {
    prompt = intent.subject;
  }

  return prompt;
}

function buildImagePrompt(intent: NormalizedIntent): string {
  const parts: string[] = [];

  // Subject first
  parts.push(intent.subject);

  // Style
  parts.push(intent.style);

  // Camera
  if (intent.camera && intent.camera !== "medium shot") {
    parts.push(intent.camera);
  }

  // Lighting
  if (intent.mood === "dark_moody") {
    parts.push("dramatic lighting, deep shadows");
  } else if (intent.mood === "luxury_premium") {
    parts.push("soft premium studio lighting");
  } else if (intent.mood === "bright_cheerful") {
    parts.push("bright natural daylight");
  }

  // Mood
  parts.push(`${intent.mood} atmosphere`);

  // Immutable facts must be preserved verbatim
  for (const fact of intent.immutableFacts) {
    parts.push(fact);
  }

  return parts.join(", ");
}

function buildVideoPrompt(intent: NormalizedIntent): string {
  const parts: string[] = [];

  // Action first for video
  parts.push(intent.subject);

  // Camera movement
  parts.push(intent.camera);

  // Environment
  parts.push(intent.environment || intent.style);

  // Duration hint
  parts.push(`smooth ${intent.mood} motion`);

  for (const fact of intent.immutableFacts) {
    parts.push(fact);
  }

  return parts.join(", ");
}

function buildAudioPrompt(intent: NormalizedIntent): string {
  return intent.subject;
}

// ============================================================
// Pass 3: Model Dialect Compilation
// ============================================================

export interface PromptGuide {
  format: "descriptive_prose" | "concise_tags" | "action_camera_environment";
  prefix?: string;
  suffix?: string;
  maxLength?: number;
}

export function compileModelDialect(
  creativePrompt: string,
  guide: PromptGuide,
): string {
  let compiled = creativePrompt;

  if (guide.prefix) {
    compiled = `${guide.prefix} ${compiled}`;
  }
  if (guide.suffix) {
    compiled = `${compiled} ${guide.suffix}`;
  }
  if (guide.maxLength && compiled.length > guide.maxLength) {
    compiled = compiled.slice(0, guide.maxLength);
  }

  return compiled.trim();
}

// ============================================================
// Pass 4: Deterministic Validation
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePrompt(
  prompt: string,
  constraints: {
    maxLength?: number;
    supportedParams?: string[];
    maxReferences?: number;
    requiredReferences?: number;
  },
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (constraints.maxLength && prompt.length > constraints.maxLength) {
    errors.push(`Prompt too long: ${prompt.length}/${constraints.maxLength} characters`);
  }

  if (prompt.length < 3) {
    errors.push("Prompt too short (minimum 3 characters)");
  }

  // Check for unsupported parameter patterns
  // This is simplified; real implementation would check against model schema

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Full compile pipeline
// ============================================================

export interface CompilePromptInput {
  rawPrompt: string;
  capability: GenerationCapability;
  modelId?: string;
  immutableFacts?: string[];
  brandContext?: BrandContext;
  projectContext?: { name: string; description?: string };
  canvasContext?: { instructions: string[] };
  referenceContext?: { caption: string; palette: string[] }[];
  promptGuide?: PromptGuide;
}

export interface CompilePromptOutput {
  normalizedIntent: NormalizedIntent;
  enrichedIntent: NormalizedIntent;
  creativePrompt: string;
  finalPrompt: string;
  negativePrompt: string;
  validation: ValidationResult;
}

export async function compilePrompt(input: CompilePromptInput): Promise<CompilePromptOutput> {
  // Pass 0: Normalize
  const normalizedIntent = normalizeIntent(
    input.rawPrompt,
    input.capability,
    input.immutableFacts,
  );

  // Pass 1: Enrich with context
  const enrichedIntent = enrichWithContext(normalizedIntent, {
    brand: input.brandContext,
    project: input.projectContext,
    canvas: input.canvasContext,
    references: input.referenceContext,
  });

  // Pass 2: Creative expansion
  const creativePrompt = creativeExpand(enrichedIntent, input.capability);

  // Pass 3: Model dialect
  const finalPrompt = input.promptGuide
    ? compileModelDialect(creativePrompt, input.promptGuide)
    : creativePrompt;

  // Pass 4: Validate
  const validation = validatePrompt(finalPrompt, {});

  // Build negative prompt
  const negativePrompt = buildNegativePrompt(enrichedIntent, input.capability);

  return {
    normalizedIntent,
    enrichedIntent,
    creativePrompt,
    finalPrompt,
    negativePrompt,
    validation,
  };
}

// ============================================================
// Negative prompt builder
// ============================================================

function buildNegativePrompt(intent: NormalizedIntent, capability: GenerationCapability): string {
  const negatives: string[] = [
    "blurry",
    "low quality",
    "distorted",
    "watermark",
    "text artifacts",
  ];

  if (intent.style === "photorealistic") {
    negatives.push("cartoon", "illustration", "3d render", "anime");
  }

  if (intent.style === "illustration") {
    negatives.push("photorealistic", "photo");
  }

  for (const constraint of intent.negativeConstraints) {
    negatives.push(constraint);
  }

  return negatives.join(", ");
}
