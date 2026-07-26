// Helmies Studio — Retry Policy, Rate Limiting, SSRF Protection, Security
// Sections 127, 138, 175, 177, 179: Production safety infrastructure

import crypto from "crypto";

// ============================================================
// RETRY POLICY (Section 127)
// ============================================================

export type ErrorClass = "validation" | "auth" | "rate_limit" | "server_error" | "timeout" | "unknown";

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
}

export function classifyError(error: any, httpStatus?: number): ErrorClass {
  if (httpStatus === 400 || httpStatus === 422) return "validation";
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus === 429) return "rate_limit";
  if (httpStatus === 408 || error?.message?.includes("timeout")) return "timeout";
  if (httpStatus && httpStatus >= 500) return "server_error";
  return "unknown";
}

export function decideRetry(
  errorClass: ErrorClass,
  attemptNumber: number,
  isExpensiveJob: boolean,
): RetryDecision {
  const maxRetries = isExpensiveJob ? 2 : 3;

  switch (errorClass) {
    case "validation":
      return { shouldRetry: false, delayMs: 0, reason: "Validation error — not retryable" };

    case "auth":
      return { shouldRetry: false, delayMs: 0, reason: "Authentication error — requires manual intervention" };

    case "rate_limit":
      if (attemptNumber > maxRetries) {
        return { shouldRetry: false, delayMs: 0, reason: "Rate limited — max retries exceeded" };
      }
      return {
        shouldRetry: true,
        delayMs: Math.min(2000 * Math.pow(2, attemptNumber), 30000), // Exponential backoff: 2s, 4s, 8s
        reason: "Rate limited — retrying with backoff",
      };

    case "timeout":
      if (attemptNumber > maxRetries) {
        return { shouldRetry: false, delayMs: 0, reason: "Timeout — max retries exceeded" };
      }
      return {
        shouldRetry: true,
        delayMs: 1000 * (attemptNumber + 1),
        reason: "Timeout — retrying",
      };

    case "server_error":
      if (attemptNumber > maxRetries) {
        return { shouldRetry: false, delayMs: 0, reason: "Server error — max retries exceeded" };
      }
      return {
        shouldRetry: true,
        delayMs: 1000 * Math.pow(2, attemptNumber),
        reason: "Server error — retrying with backoff",
      };

    case "unknown":
      if (attemptNumber >= 1) {
        return { shouldRetry: false, delayMs: 0, reason: "Unknown error — not retrying automatically" };
      }
      // For unknown errors on expensive jobs, query provider before retrying
      if (isExpensiveJob) {
        return { shouldRetry: false, delayMs: 0, reason: "Expensive job — verify provider status before retrying" };
      }
      return { shouldRetry: true, delayMs: 2000, reason: "Unknown error — single retry attempt" };

    default:
      return { shouldRetry: false, delayMs: 0, reason: "Unclassified error" };
  }
}

// ============================================================
// PROVIDER FALLBACK (Section 128)
// ============================================================

export interface FallbackCheck {
  canFallback: boolean;
  fallbackModelId?: string;
  reason?: string;
}

export function canFallbackToModel(
  originalModel: {
    capability: string;
    requiredInputs: string[];
    outputConstraints: Record<string, unknown>;
    estimatedCredits: number;
  },
  fallbackModel: {
    capability: string;
    supportedInputs: string[];
    outputConstraints: Record<string, unknown>;
    estimatedCredits: number;
  },
  userMaxCredits: number,
  userPlan: string,
): FallbackCheck {
  // Same capability
  if (originalModel.capability !== fallbackModel.capability) {
    return { canFallback: false, reason: "Different capability" };
  }

  // All required inputs supported
  for (const input of originalModel.requiredInputs) {
    if (!fallbackModel.supportedInputs.includes(input)) {
      return { canFallback: false, reason: `Missing input support: ${input}` };
    }
  }

  // Price within approved maximum
  if (fallbackModel.estimatedCredits > userMaxCredits) {
    return { canFallback: false, reason: "Fallback exceeds approved budget" };
  }

  return { canFallback: true, fallbackModelId: fallbackModel.estimatedCredits.toString() };
}

// ============================================================
// RATE LIMITING (Section 175)
// ============================================================

interface RateLimitWindow {
  count: number;
  windowStartMs: number;
}

const rateLimitStore = new Map<string, RateLimitWindow>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  scope: "user" | "ip" | "endpoint" | "global";
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  "generate:image": { windowMs: 60_000, maxRequests: 10, scope: "user" },
  "generate:video": { windowMs: 60_000, maxRequests: 5, scope: "user" },
  "generate:audio": { windowMs: 60_000, maxRequests: 20, scope: "user" },
  "api:default": { windowMs: 60_000, maxRequests: 60, scope: "user" },
  "auth:login": { windowMs: 300_000, maxRequests: 10, scope: "ip" },
};

export function checkRateLimit(
  key: string,
  config?: RateLimitConfig,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const cfg = config || DEFAULT_LIMITS["api:default"];
  const now = Date.now();
  const storeKey = `${cfg.scope}:${key}`;

  let window = rateLimitStore.get(storeKey);

  if (!window || now - window.windowStartMs > cfg.windowMs) {
    window = { count: 0, windowStartMs: now };
  }

  window.count++;
  rateLimitStore.set(storeKey, window);

  const remaining = Math.max(0, cfg.maxRequests - window.count);
  const allowed = window.count <= cfg.maxRequests;
  const retryAfterMs = allowed ? 0 : cfg.windowMs - (now - window.windowStartMs);

  return { allowed, remaining, retryAfterMs };
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of rateLimitStore.entries()) {
    if (now - window.windowStartMs > 600_000) { // 10 min max
      rateLimitStore.delete(key);
    }
  }
}, 120_000);

// ============================================================
// SSRF PROTECTION (Section 138)
// ============================================================

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/,
  /^fe80:/,
  /^::1$/,
  /^localhost$/,
];

const ALLOWED_PROVIDER_DOMAINS = [
  "api.wavespeed.ai",
  "api.atlascloud.ai",
  "dashscope.aliyuncs.com",
  "api.openai.com",
  "openrouter.ai",
  "api.kie.ai",
  "generativelanguage.googleapis.com",
];

export function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((pattern) => pattern.test(hostname));
}

export function validateUrl(url: string, context: "provider" | "upload" | "mcp" = "provider"): {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
} {
  try {
    const parsed = new URL(url);

    // Block non-HTTP protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} not allowed` };
    }

    // Block private IPs
    if (isPrivateIp(parsed.hostname)) {
      return { valid: false, error: "Private/internal IP addresses not allowed" };
    }

    // For provider context, validate against allowlist
    if (context === "provider") {
      const isAllowed = ALLOWED_PROVIDER_DOMAINS.some(
        (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      );
      if (!isAllowed) {
        return { valid: false, error: `Domain ${parsed.hostname} not in provider allowlist` };
      }
    }

    // Rebuild URL without credentials or fragments
    const sanitized = new URL(parsed.pathname + parsed.search, parsed.origin);
    return { valid: true, sanitizedUrl: sanitized.toString() };

  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

// ============================================================
// UPLOAD SECURITY (Section 137)
// ============================================================

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".m4a", ".pdf"];
const MAX_UPLOAD_SIZE = 524_288_000; // 500MB

const MALICIOUS_SIGNATURES = [
  Buffer.from("<?php", "utf-8"),
  Buffer.from("<script", "utf-8"),
  Buffer.from("eval(", "utf-8"),
  Buffer.from("exec(", "utf-8"),
];

export function validateUpload(
  buffer: Buffer,
  fileName: string,
  declaredMimeType: string,
): { valid: boolean; error?: string } {
  // Extension check
  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File extension ${ext} not allowed` };
  }

  // Size check
  if (buffer.length > MAX_UPLOAD_SIZE) {
    return { valid: false, error: `File too large: ${(buffer.length / 1_000_000).toFixed(1)}MB (max 500MB)` };
  }

  // Empty file check
  if (buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  // Malicious payload scan
  for (const sig of MALICIOUS_SIGNATURES) {
    if (buffer.includes(sig)) {
      return { valid: false, error: "File contains potentially malicious content" };
    }
  }

  // Image-specific: check magic bytes
  if ([".jpg", ".jpeg"].includes(ext)) {
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return { valid: false, error: "Invalid JPEG file" };
    }
  }
  if (ext === ".png") {
    const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (!buffer.slice(0, 8).equals(pngSig)) {
      return { valid: false, error: "Invalid PNG file" };
    }
  }
  if (ext === ".gif") {
    if (buffer.slice(0, 6).toString() !== "GIF89a" && buffer.slice(0, 6).toString() !== "GIF87a") {
      return { valid: false, error: "Invalid GIF file" };
    }
  }

  return { valid: true };
}

// ============================================================
// SECURITY HEADERS (Section 177)
// ============================================================

export const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// ============================================================
// LOGGING PRIVACY (Section 179)
// ============================================================

const SENSITIVE_FIELDS = [
  "apiKey", "api_key", "api-key",
  "secretKey", "secret_key", "secret-key",
  "password", "passphrase",
  "token", "accessToken", "access_token",
  "refreshToken", "refresh_token",
  "authorization",
  "stripeSecret", "stripe_secret",
  "webhookSecret", "webhook_secret",
];

export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else if (key === "prompt" && typeof value === "string" && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + "...";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================
// ABUSE DETECTION (Section 176)
// ============================================================

interface AbuseSignal {
  userId: string;
  signal: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
}

const abuseSignals: AbuseSignal[] = [];

export function recordAbuseSignal(
  userId: string,
  signal: string,
  severity: "low" | "medium" | "high" = "low",
): void {
  abuseSignals.push({ userId, signal, severity, timestamp: Date.now() });

  // Keep only last 1000 signals
  if (abuseSignals.length > 1000) {
    abuseSignals.splice(0, abuseSignals.length - 1000);
  }

  if (severity === "high") {
    console.warn(`[abuse] HIGH severity from user ${userId}: ${signal}`);
  }
}

export function getUserAbuseScore(userId: string): number {
  const now = Date.now();
  const recentSignals = abuseSignals.filter(
    (s) => s.userId === userId && now - s.timestamp < 3600_000, // Last hour
  );

  let score = 0;
  for (const signal of recentSignals) {
    score += signal.severity === "high" ? 10 : signal.severity === "medium" ? 3 : 1;
  }

  return score;
}

export function isUserFlagged(userId: string): boolean {
  return getUserAbuseScore(userId) >= 20;
}

// ============================================================
// API KEY HASHING
// ============================================================

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const prefix = "helmies_";
  const random = crypto.randomBytes(32).toString("base64url");
  const key = `${prefix}${random}`;
  const hash = hashApiKey(key);
  return { key, hash, prefix: key.slice(0, 15) };
}

// ============================================================
// IDEMPOTENCY KEY GENERATION
// ============================================================

export function generateIdempotencyKey(userId: string, operation: string, data: unknown): string {
  const payload = `${userId}:${operation}:${JSON.stringify(data)}:${Date.now()}`;
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
