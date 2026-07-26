// Helmies Studio — Shared Configuration
// Environment variables, constants, feature flags

import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string().optional(),
  REDIS_URI: z.string().default("redis://localhost:6379"),
  MONGO_URI: z.string().default("mongodb://localhost:27017/HelmiesStudio"),
  MEILI_HOST: z.string().default("http://localhost:7700"),
  MEILI_MASTER_KEY: z.string().optional(),

  // Auth
  NEXTAUTH_URL: z.string().default("http://localhost:3003"),
  NEXTAUTH_SECRET: z.string().default("dev-secret-change-in-production"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Provider keys (secret refs in production)
  WAVESPEED_KEY: z.string().optional(),
  ATLAS_KEY: z.string().optional(),
  ALIBABA_KEY: z.string().optional(),
  OPENROUTER_KEY: z.string().optional(),
  KIE_KEY: z.string().optional(),

  // Feature flags
  FEATURE_NEW_STUDIO_SHELL: z.string().default("false"),
  FEATURE_MODEL_GATEWAY_V2: z.string().default("false"),
  FEATURE_PRICING_PREFLIGHT: z.string().default("false"),
  FEATURE_WALLET_V2: z.string().default("false"),
  FEATURE_IMAGE_CANVAS: z.string().default("false"),
  FEATURE_BRAND_KITS: z.string().default("false"),
  FEATURE_AGENT_CREATIVE_TOOLS: z.string().default("false"),
  FEATURE_DIRECTOR: z.string().default("false"),
  FEATURE_ADMIN_V2: z.string().default("false"),
  FEATURE_PROMO_CODES: z.string().default("false"),
  FEATURE_CMS_CONTENT: z.string().default("false"),
  FEATURE_ADMIN_ADVISOR: z.string().default("false"),

  // Object storage
  STORAGE_BACKEND: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_S3_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_SECRET_KEY: z.string().optional(),

  // Limits
  MAX_UPLOAD_SIZE_BYTES: z.string().default("524288000"), // 500MB
  MAX_VIDEO_DURATION_SEC: z.string().default("60"),
  QUOTE_EXPIRY_SEC: z.string().default("300"),
  RESERVATION_EXPIRY_SEC: z.string().default("1800"),

  // Admin
  CRON_SECRET: z.string().optional(),
  ADMIN_PANEL_URL: z.string().optional(),
  ADMIN_PANEL_SESSION_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// ============================================================
// Feature flag helpers
// ============================================================

export function isFeatureEnabled(flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase().replace(/\./g, "_")}`;
  return process.env[envKey] === "true";
}

export const FEATURES = {
  NEW_STUDIO_SHELL: env.FEATURE_NEW_STUDIO_SHELL === "true",
  MODEL_GATEWAY_V2: env.FEATURE_MODEL_GATEWAY_V2 === "true",
  PRICING_PREFLIGHT: env.FEATURE_PRICING_PREFLIGHT === "true",
  WALLET_V2: env.FEATURE_WALLET_V2 === "true",
  IMAGE_CANVAS: env.FEATURE_IMAGE_CANVAS === "true",
  BRAND_KITS: env.FEATURE_BRAND_KITS === "true",
  AGENT_CREATIVE_TOOLS: env.FEATURE_AGENT_CREATIVE_TOOLS === "true",
  DIRECTOR: env.FEATURE_DIRECTOR === "true",
  ADMIN_V2: env.FEATURE_ADMIN_V2 === "true",
  PROMO_CODES: env.FEATURE_PROMO_CODES === "true",
  CMS_CONTENT: env.FEATURE_CMS_CONTENT === "true",
  ADMIN_ADVISOR: env.FEATURE_ADMIN_ADVISOR === "true",
} as const;

// ============================================================
// Constants
// ============================================================

export const CONSTANTS = {
  CREDIT_DECIMAL_PLACES: 0, // Credits are integers
  PRICE_DECIMAL_PLACES: 4,
  FINANCIAL_DECIMAL_PLACES: 8,
  DEFAULT_MARKUP: 2.5,
  DEFAULT_TARGET_MARGIN: 0.6,
  PAYMENT_FEE_PERCENT: 0.029, // 2.9%
  PAYMENT_FEE_FIXED: 0.30, // $0.30
  INFRA_RESERVE_LLM: 0.05,
  INFRA_RESERVE_IMAGE: 0.10,
  INFRA_RESERVE_VIDEO: 0.15,
  MAX_REFERENCE_IMAGES: 10,
  MAX_PROMPT_LENGTH: 4000,
  MIN_PASSWORD_LENGTH: 8,
  DEFAULT_CREDITS_SIGNUP: 100,
} as const;

// ============================================================
// Plan defaults
// ============================================================

export const PLAN_DEFAULTS = {
  free: { credits: 100, maxConcurrency: 1, maxActiveJobs: 2, qualityTiers: ["economy"], storageMB: 100 },
  starter: { credits: 1000, maxConcurrency: 2, maxActiveJobs: 5, qualityTiers: ["economy", "balanced"], storageMB: 500 },
  studio: { credits: 3000, maxConcurrency: 5, maxActiveJobs: 15, qualityTiers: ["economy", "balanced", "best_quality"], storageMB: 2000 },
  pro: { credits: 10000, maxConcurrency: 10, maxActiveJobs: 30, qualityTiers: ["economy", "balanced", "best_quality"], storageMB: 10000 },
} as const;

export type PlanTier = keyof typeof PLAN_DEFAULTS;
