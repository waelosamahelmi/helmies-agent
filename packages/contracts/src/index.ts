// Helmies Studio — Shared Contracts
// Core TypeScript types and Zod schemas

import { z } from "zod";

// ============================================================
// Generation & Jobs
// ============================================================

export const GenerationCapability = z.enum([
  "image.generate",
  "image.edit",
  "image.inpaint",
  "image.outpaint",
  "video.generate",
  "video.image_to_video",
  "video.video_to_video",
  "video.extend",
  "audio.tts",
  "audio.music",
  "audio.transcribe",
  "lipsync",
  "recast",
  "vision.analyze",
  "vision.compare",
  "vision.ocr",
  "llm.chat",
  "llm.prompt",
]);

export type GenerationCapability = z.infer<typeof GenerationCapability>;

export const JobStatus = z.enum([
  "created",
  "quoted",
  "awaiting_confirmation",
  "reserved",
  "queued",
  "submitted",
  "processing",
  "downloading",
  "quality_check",
  "completed",
  "failed",
  "cancelled",
  "refunded",
]);

export type JobStatus = z.infer<typeof JobStatus>;

// ============================================================
// Pricing
// ============================================================

export const PricingStrategy = z.enum([
  "fixed",
  "per_image",
  "per_megapixel",
  "per_second",
  "per_character",
  "per_audio_second",
  "per_input_token",
  "per_output_token",
  "tiered_duration",
  "formula",
]);

export type PricingStrategy = z.infer<typeof PricingStrategy>;

export const CostMode = z.enum(["best_quality", "balanced", "economy", "manual"]);
export type CostMode = z.infer<typeof CostMode>;

export const QuoteRequest = z.object({
  userId: z.string(),
  modelId: z.string().optional(),
  capability: GenerationCapability,
  routeKey: z.string().optional(),
  costMode: CostMode.default("balanced"),
  params: z.record(z.unknown()),
  promoCode: z.string().optional(),
});

export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteResponse = z.object({
  quoteId: z.string(),
  expiresAt: z.string(),
  providerCostEstimated: z.number(),
  platformCostEstimated: z.number(),
  retailBeforeDiscount: z.number(),
  discount: z.number(),
  retailAfterDiscount: z.number(),
  credits: z.number().int(),
  maximumCredits: z.number().int(),
  balance: z.number().int(),
  balanceAfterExpected: z.number().int(),
  balanceAfterMaximum: z.number().int(),
  warnings: z.array(z.string()).default([]),
});

export type QuoteResponse = z.infer<typeof QuoteResponse>;

// ============================================================
// Models & Providers
// ============================================================

export const ModelInputField = z.object({
  key: z.string(),
  type: z.enum([
    "string", "textarea", "integer", "float", "boolean",
    "enum", "multi_enum", "asset", "asset_list", "image",
    "video", "audio", "mask", "aspect_ratio", "resolution",
    "duration", "seed", "color", "slider",
  ]),
  label: z.string(),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  group: z.string().optional(),
  advanced: z.boolean().default(false),
});

export type ModelInputField = z.infer<typeof ModelInputField>;

export const ModelInputSchema = z.object({
  fields: z.array(ModelInputField),
  groups: z.array(z.object({ key: z.string(), label: z.string(), order: z.number() })).optional(),
});

export type ModelInputSchema = z.infer<typeof ModelInputSchema>;

// ============================================================
// Creative Plans (Agent)
// ============================================================

export const CreativePlanStep = z.object({
  id: z.string(),
  kind: z.string(),
  description: z.string(),
  dependsOn: z.array(z.string()).default([]),
  routeKey: z.string().optional(),
  modelId: z.string().optional(),
  params: z.record(z.unknown()).default({}),
  estimatedCredits: z.number().int().optional(),
});

export type CreativePlanStep = z.infer<typeof CreativePlanStep>;

export const CreativePlan = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  projectId: z.string().optional(),
  steps: z.array(CreativePlanStep),
  quote: z.object({
    expectedCredits: z.number().int(),
    maximumCredits: z.number().int(),
    balance: z.number().int(),
    balanceAfter: z.number().int(),
    retryAllowance: z.number().int(),
  }).optional(),
});

export type CreativePlan = z.infer<typeof CreativePlan>;

// ============================================================
// Director
// ============================================================

export const DirectorPipelineStatus = z.enum([
  "draft", "planning", "awaiting_approval", "quoted",
  "queued", "generating_images", "generating_video",
  "generating_audio", "quality_check", "assembling",
  "completed", "paused", "failed", "cancelled",
]);

export type DirectorPipelineStatus = z.infer<typeof DirectorPipelineStatus>;

export const ShotCamera = z.object({
  framing: z.string().default("medium shot"),
  angle: z.string().default("eye level"),
  lens: z.string().default("50mm"),
  movement: z.string().default("static"),
  intensity: z.string().default("subtle"),
});

export const ShotImageStrategy = z.object({
  mode: z.enum(["generate", "reference", "reuse_previous_end_frame"]),
  prompt: z.string(),
  references: z.array(z.string()).default([]),
});

export const ShotVideoStrategy = z.object({
  mode: z.enum(["t2v", "i2v", "reference", "extend"]),
  prompt: z.string(),
  modelRoute: z.string(),
  keyframes: z.array(z.string()).optional(),
  windows: z.array(z.string()).optional(),
});

export const ShotPlan = z.object({
  id: z.string(),
  index: z.number().int(),
  title: z.string(),
  durationSec: z.number(),
  narrativeRole: z.string(),
  sceneGoal: z.string(),
  subjects: z.array(z.unknown()).default([]),
  environment: z.string(),
  spatialSetup: z.string(),
  lighting: z.string(),
  mood: z.string(),
  camera: ShotCamera,
  imageStrategy: ShotImageStrategy,
  videoStrategy: ShotVideoStrategy,
  audio: z.object({
    dialogue: z.string().optional(),
    ambience: z.string().optional(),
    effects: z.array(z.string()).optional(),
  }).optional(),
  continuity: z.array(z.string()).default([]),
});

export type ShotPlan = z.infer<typeof ShotPlan>;

export const ProductionPlan = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["ad", "short_film", "music_video", "social", "product"]),
  durationSec: z.number(),
  globalStyle: z.string(),
  brandKitId: z.string().optional(),
  subjects: z.array(z.unknown()).default([]),
  locations: z.array(z.unknown()).default([]),
  shots: z.array(ShotPlan),
  continuityRules: z.array(z.string()).default([]),
});

export type ProductionPlan = z.infer<typeof ProductionPlan>;

// ============================================================
// Canvas
// ============================================================

export const CanvasObjectType = z.enum([
  "IMAGE", "TEXT", "SHAPE", "FREE_DRAW",
  "MASK_INCLUDE", "MASK_EXCLUDE", "ARROW", "REGION",
  "PROMPT_NOTE", "COLOR_SWATCH", "LOGO", "REFERENCE",
  "GUIDE", "BACKGROUND",
]);

export const CanvasSemanticRole = z.enum([
  "layout_reference", "identity_reference", "style_reference",
  "product_reference", "logo", "background_reference",
  "preserve_exactly", "edit_target", "remove_target",
  "inpaint_region", "outpaint_context", "text_content",
  "color_reference", "composition_anchor",
]);

export const CanvasObject = z.object({
  id: z.string(),
  type: CanvasObjectType,
  role: CanvasSemanticRole.optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().default(0),
  opacity: z.number().default(1),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  zIndex: z.number().int().default(0),
  assetId: z.string().optional(),
  text: z.string().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  promptNote: z.string().optional(),
});

export type CanvasObject = z.infer<typeof CanvasObject>;

export const CanvasDocument = z.object({
  version: z.literal(1),
  width: z.number().int(),
  height: z.number().int(),
  aspectRatio: z.string(),
  background: z.object({
    type: z.enum(["color", "image"]),
    value: z.string(),
  }).optional(),
  objects: z.array(CanvasObject),
  instructions: z.array(z.string()).default([]),
});

export type CanvasDocument = z.infer<typeof CanvasDocument>;

// ============================================================
// Brand
// ============================================================

export const BrandEnforcementMode = z.enum(["off", "suggest", "strong", "locked"]);
export type BrandEnforcementMode = z.infer<typeof BrandEnforcementMode>;

export const BrandFingerprint = z.object({
  palette: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()).default([]),
  }),
  visual: z.object({
    contrast: z.string().optional(),
    lighting: z.string().optional(),
    composition: z.string().optional(),
    texture: z.string().optional(),
  }).optional(),
  typography: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
    case: z.string().optional(),
  }).optional(),
  avoid: z.array(z.string()).default([]),
});

export type BrandFingerprint = z.infer<typeof BrandFingerprint>;

// ============================================================
// Visual Intelligence
// ============================================================

export const VisualAnalysisResult = z.object({
  caption: z.string(),
  background: z.string().optional(),
  palette: z.array(z.string()).default([]),
  composition: z.record(z.unknown()).optional(),
  lighting: z.record(z.unknown()).optional(),
  camera: z.record(z.unknown()).optional(),
  subjects: z.array(z.unknown()).default([]),
  objects: z.array(z.unknown()).default([]),
  textRegions: z.array(z.unknown()).default([]),
  regions: z.array(z.unknown()).default([]),
  style: z.record(z.unknown()).optional(),
  structuredPrompt: z.record(z.unknown()).optional(),
});

export type VisualAnalysisResult = z.infer<typeof VisualAnalysisResult>;

// ============================================================
// Wallet & Credits
// ============================================================

export const LedgerType = z.enum([
  "signup",
  "subscription_grant",
  "topup",
  "promo",
  "reservation",
  "reservation_release",
  "generation",
  "refund",
  "admin_adjustment",
  "migration_opening_balance",
]);

export type LedgerType = z.infer<typeof LedgerType>;

export const ReservationStatus = z.enum(["active", "settled", "released", "expired"]);
export type ReservationStatus = z.infer<typeof ReservationStatus>;

// ============================================================
// Admin / Promo
// ============================================================

export const PromoType = z.enum([
  "percent_discount",
  "fixed_discount",
  "bonus_credits",
  "plan_override",
]);

export type PromoType = z.infer<typeof PromoType>;

export const AdminRole = z.enum([
  "super_admin",
  "finance_admin",
  "support_admin",
  "ai_ops",
  "content_admin",
]);

export type AdminRole = z.infer<typeof AdminRole>;

// ============================================================
// Feature Flags
// ============================================================

export const FeatureFlagKey = z.enum([
  "new_studio_shell",
  "model_gateway_v2",
  "pricing_preflight",
  "wallet_v2",
  "image_studio_v2",
  "image_canvas",
  "visual_intelligence",
  "brand_kits",
  "agent_creative_tools",
  "director",
  "admin_v2",
  "promo_codes",
  "cms_content",
  "admin_advisor",
]);

export type FeatureFlagKey = z.infer<typeof FeatureFlagKey>;
