// Helmies Studio — Media Storage Ingestion Pipeline
// Sections 75-76, 126: Provider output → worker fetches → validates →
// stores in controlled storage → generates thumbnail → creates Asset record.
// Temporary provider URLs are NEVER treated as permanent assets.

import { validateUrl } from "@helmies/shared-config/security";
import crypto from "crypto";

// ============================================================
// Storage ingestion result
// ============================================================

export interface IngestedMedia {
  assetId: string;
  storageKey: string;
  permanentUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  bytes: number;
  originalProviderUrl: string;
  ingestedAt: Date;
}

// ============================================================
// Media fetcher
// ============================================================

export async function fetchFromProvider(
  providerUrl: string,
  maxSizeBytes: number = 500_000_000, // 500MB
  timeoutMs: number = 300_000, // 5 minutes
): Promise<{ buffer: Buffer; contentType: string }> {
  // Validate URL before fetching (SSRF protection)
  const urlCheck = validateUrl(providerUrl, "provider");
  if (!urlCheck.valid) {
    throw new Error(`Invalid provider URL: ${urlCheck.error}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlCheck.sanitizedUrl!, {
      signal: controller.signal,
      headers: { "Accept": "*/*" },
    });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = parseInt(response.headers.get("content-length") || "0");

    if (contentLength > maxSizeBytes) {
      throw new Error(`File too large: ${contentLength} bytes (max ${maxSizeBytes})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > maxSizeBytes) {
      throw new Error(`Downloaded file too large: ${buffer.length} bytes`);
    }

    return { buffer, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// Media validator
// ============================================================

export function validateMedia(
  buffer: Buffer,
  contentType: string,
  expectedType: "image" | "video" | "audio",
): { valid: boolean; mimeType: string; error?: string } {
  // Check buffer is not empty
  if (buffer.length < 100) {
    return { valid: false, mimeType: contentType, error: "File too small — likely corrupted" };
  }

  // Validate content type against expected
  const typeMap: Record<string, string[]> = {
    image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    video: ["video/mp4", "video/webm", "video/quicktime"],
    audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"],
  };

  const expected = typeMap[expectedType];
  if (expected && !expected.some((t) => contentType.startsWith(t))) {
    return {
      valid: false,
      mimeType: contentType,
      error: `Expected ${expectedType} but got ${contentType}`,
    };
  }

  // Image-specific validation
  if (expectedType === "image") {
    // JPEG: starts with FF D8
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        return { valid: false, mimeType: contentType, error: "Invalid JPEG header" };
      }
    }
    // PNG: starts with 89 50 4E 47
    if (contentType.includes("png")) {
      const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (!buffer.slice(0, 8).equals(pngSig)) {
        return { valid: false, mimeType: contentType, error: "Invalid PNG header" };
      }
    }
    // WEBP: starts with RIFF....WEBP
    if (contentType.includes("webp")) {
      if (buffer.slice(0, 4).toString() !== "RIFF" || buffer.slice(8, 12).toString() !== "WEBP") {
        return { valid: false, mimeType: contentType, error: "Invalid WEBP header" };
      }
    }
  }

  return { valid: true, mimeType: contentType };
}

// ============================================================
// Storage writer (local filesystem)
// ============================================================

import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_LOCAL_PATH || "./uploads";

export async function writeToStorage(
  buffer: Buffer,
  userId: string,
  category: string,
  mimeType: string,
): Promise<{ storageKey: string; filePath: string }> {
  const ext = mapMimeToExt(mimeType);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const fileName = `${hash}${ext}`;
  const relativePath = path.join("users", userId, category, fileName);
  const fullPath = path.join(STORAGE_ROOT, relativePath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    storageKey: relativePath.replace(/\\/g, "/"),
    filePath: fullPath,
  };
}

// ============================================================
// Thumbnail generator
// ============================================================

export async function generateThumbnail(
  buffer: Buffer,
  mimeType: string,
  maxSize: number = 400,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return null;
  }

  try {
    // Use sharp for image thumbnailing
    const sharp = await import("sharp");
    const thumb = await sharp(buffer)
      .resize(maxSize, maxSize, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return { buffer: thumb, mimeType: "image/jpeg" };
  } catch {
    // If sharp fails (e.g., for videos), return null
    return null;
  }
}

// ============================================================
// Full ingestion pipeline
// ============================================================

export interface IngestionResult {
  success: boolean;
  ingested?: IngestedMedia;
  error?: string;
  stage: "fetching" | "validating" | "storing" | "thumbnailing" | "complete";
}

export async function ingestProviderMedia(
  providerUrl: string,
  userId: string,
  jobId: string,
  expectedType: "image" | "video" | "audio",
): Promise<IngestionResult> {
  try {
    // Stage 1: Fetch
    const { buffer, contentType } = await fetchFromProvider(providerUrl);

    // Stage 2: Validate
    const validation = validateMedia(buffer, contentType, expectedType);
    if (!validation.valid) {
      return { success: false, error: validation.error, stage: "validating" };
    }

    // Stage 3: Store
    const storage = await writeToStorage(buffer, userId, "generations", validation.mimeType);

    // Stage 4: Thumbnail
    let thumbnailUrl: string | undefined;
    const thumbnail = await generateThumbnail(buffer, validation.mimeType);
    if (thumbnail) {
      const thumbStorage = await writeToStorage(
        thumbnail.buffer,
        userId,
        "thumbnails",
        thumbnail.mimeType,
      );
      thumbnailUrl = `/media/${thumbStorage.storageKey}`;
    }

    const ingested: IngestedMedia = {
      assetId: `asset_${crypto.randomUUID().slice(0, 8)}`,
      storageKey: storage.storageKey,
      permanentUrl: `/media/${storage.storageKey}`,
      thumbnailUrl,
      mimeType: validation.mimeType,
      bytes: buffer.length,
      originalProviderUrl: providerUrl,
      ingestedAt: new Date(),
    };

    return { success: true, ingested, stage: "complete" };
  } catch (error: any) {
    return { success: false, error: error.message, stage: "fetching" };
  }
}

// ============================================================
// Signed URL generation (Section 136)
// ============================================================

export function generateSignedUrl(
  storageKey: string,
  userId: string,
  expiresInSec: number = 3600,
): string {
  // Verify ownership: storageKey must start with user's path
  if (!storageKey.startsWith(`users/${userId}/`)) {
    throw new Error("Storage key does not belong to user");
  }

  const expires = Date.now() + expiresInSec * 1000;
  const signature = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-secret")
    .update(`${storageKey}:${expires}:${userId}`)
    .digest("hex")
    .slice(0, 32);

  return `/api/media/signed?key=${encodeURIComponent(storageKey)}&expires=${expires}&sig=${signature}`;
}

export function verifySignedUrl(
  storageKey: string,
  expires: number,
  signature: string,
  userId: string,
): boolean {
  if (Date.now() > expires) return false;

  const expected = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-secret")
    .update(`${storageKey}:${expires}:${userId}`)
    .digest("hex")
    .slice(0, 32);

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ============================================================
// Asset lineage tracking (Section 76)
// ============================================================

export function buildAssetLineage(
  parentAssetId: string | null,
  generationJobId: string,
  transformation: string,
): { parentAssetId: string | null; generationJobId: string; transformation: string } {
  return {
    parentAssetId,
    generationJobId,
    transformation,
  };
  // Trace: image → video → lipsync → final
}

// ============================================================
// Helper: MIME to extension
// ============================================================

function mapMimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
  };
  return map[mimeType] || ".bin";
}

// ============================================================
// Cleanup expired temporary files
// ============================================================

export async function cleanupTempFiles(maxAgeMs: number = 3600_000): Promise<number> {
  const tempDir = path.join(STORAGE_ROOT, "jobs");
  let cleaned = 0;

  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(tempDir, entry.name);
        const stat = await fs.stat(dirPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.rm(dirPath, { recursive: true, force: true });
          cleaned++;
        }
      }
    }
  } catch {
    // Directory may not exist yet
  }

  return cleaned;
}

// Run cleanup every hour
setInterval(() => {
  cleanupTempFiles().then((n) => {
    if (n > 0) console.log(`[storage] Cleaned ${n} temp directories`);
  });
}, 3600_000);
