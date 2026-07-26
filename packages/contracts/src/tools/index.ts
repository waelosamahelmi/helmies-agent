// Helmies Studio — First-Party Agent Tools
// Phase 11: Tools exposed to the Master Agent and subagents.
// Every tool validates ownership, uses Model Gateway, and never reveals provider secrets.

import { z } from "zod";

// ============================================================
// Tool Definitions
// ============================================================

export const HelmiesToolNames = [
  "helmies.list_models",
  "helmies.get_model_schema",
  "helmies.quote_generation",
  "helmies.generate_image",
  "helmies.edit_image",
  "helmies.generate_video",
  "helmies.generate_audio",
  "helmies.generate_tts",
  "helmies.transcribe_audio",
  "helmies.lipsync",
  "helmies.recast",
  "helmies.analyze_image",
  "helmies.search_assets",
  "helmies.get_asset",
  "helmies.get_brand_kit",
  "helmies.create_canvas_render",
  "helmies.create_project",
  "helmies.add_project_asset",
  "helmies.create_director_plan",
  "helmies.quote_director_plan",
  "helmies.run_director_pipeline",
  "helmies.get_job",
  "helmies.retry_job",
  "helmies.create_workflow",
] as const;

export type HelmiesToolName = (typeof HelmiesToolNames)[number];

// ============================================================
// Tool parameter schemas
// ============================================================

export const ListModelsParams = z.object({
  capability: z.enum(["image.generate", "image.edit", "video.generate", "video.image_to_video", "audio.tts", "lipsync", "recast"]).optional(),
  costMode: z.enum(["best_quality", "balanced", "economy"]).default("balanced"),
});

export const QuoteGenerationParams = z.object({
  modelId: z.string(),
  capability: z.string(),
  params: z.record(z.unknown()),
  promoCode: z.string().optional(),
});

export const GenerateImageParams = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(1000).optional(),
  aspectRatio: z.string().default("1:1"),
  resolution: z.string().optional(),
  seed: z.number().int().optional(),
  referenceAssetIds: z.array(z.string()).max(10).optional(),
  brandKitId: z.string().optional(),
  canvasId: z.string().optional(),
  costMode: z.enum(["best_quality", "balanced", "economy"]).default("balanced"),
  projectId: z.string().optional(),
});

export const EditImageParams = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(4000),
  sourceAssetId: z.string(),
  maskAssetId: z.string().optional(),
  aspectRatio: z.string().optional(),
  costMode: z.enum(["best_quality", "balanced", "economy"]).default("balanced"),
});

export const GenerateVideoParams = z.object({
  modelId: z.string().optional(),
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(1000).optional(),
  durationSec: z.number().int().min(1).max(60),
  aspectRatio: z.string().default("16:9"),
  resolution: z.string().default("720p"),
  firstFrameAssetId: z.string().optional(),
  lastFrameAssetId: z.string().optional(),
  referenceAssetIds: z.array(z.string()).max(5).optional(),
  costMode: z.enum(["best_quality", "balanced", "economy"]).default("balanced"),
  projectId: z.string().optional(),
});

export const GenerateAudioParams = z.object({
  modelId: z.string().optional(),
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  costMode: z.enum(["best_quality", "balanced", "economy"]).default("balanced"),
});

export const AnalyzeImageParams = z.object({
  assetId: z.string(),
  analysisTypes: z.array(z.enum(["caption", "palette", "objects", "ocr", "style"])).default(["caption", "palette"]),
});

export const SearchAssetsParams = z.object({
  query: z.string().optional(),
  type: z.enum(["image", "video", "audio"]).optional(),
  projectId: z.string().optional(),
  favorite: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const GetBrandKitParams = z.object({
  brandKitId: z.string(),
  contextType: z.enum(["full", "compact", "palette_only"]).default("compact"),
});

export const CreateProjectParams = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  brandKitId: z.string().optional(),
});

export const CreateDirectorPlanParams = z.object({
  creativeBrief: z.string().min(1).max(2000),
  targetDurationSec: z.number().int().min(5).max(120),
  platform: z.enum(["instagram", "youtube", "tiktok", "web"]).default("instagram"),
  aspect: z.string().default("9:16"),
  brandKitId: z.string().optional(),
  budgetMode: z.enum(["economy", "balanced", "premium"]).default("balanced"),
});

export const QuoteDirectorPlanParams = z.object({
  planId: z.string(),
});

export const RunDirectorPipelineParams = z.object({
  planId: z.string(),
  maxBudgetCredits: z.number().int(),
  projectId: z.string().optional(),
});

export const GetJobParams = z.object({
  jobId: z.string(),
});

export const RetryJobParams = z.object({
  jobId: z.string(),
});

export const CreateWorkflowParams = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  steps: z.array(z.object({
    type: z.string(),
    config: z.record(z.unknown()),
  })),
});

// ============================================================
// Tool result types
// ============================================================

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  creditsUsed?: number;
  jobId?: string;
  assets?: Array<{
    id: string;
    type: string;
    thumbnailUrl?: string;
    url?: string;
  }>;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  capability: string;
  provider: string;
  eligible: boolean;
  estimatedCredits: number;
  qualityScore: number;
  speedScore: number;
}

export interface QuoteResult {
  quoteId: string;
  credits: number;
  maximumCredits: number;
  balance: number;
  balanceAfter: number;
  expiresAt: string;
}

export interface JobResult {
  jobId: string;
  status: string;
  progress?: number;
  stage?: string;
  creditsUsed: number;
  assets: Array<{ id: string; type: string; url?: string }>;
}

export interface VisualAnalysisResult {
  caption: string;
  palette: string[];
  objects: Array<{ label: string; confidence: number }>;
  textRegions: Array<{ text: string; boundingBox: unknown }>;
  style: Record<string, unknown>;
}

// ============================================================
// Tool execution context (server-side)
// ============================================================

export interface HelmiesToolContext {
  platformUserId: string;
  agentUserId?: string;
  plan: string;
  walletAvailable: number;
  walletReserved: number;
  features: Record<string, boolean>;
  brandKitId?: string;
  projectId?: string;
}
