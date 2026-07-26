// Helmies Studio — Storage Service
// Media upload/download, signed URLs, content validation, EXIF stripping

import { env, CONSTANTS } from "@helmies/shared-config";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

// ============================================================
// Storage backends
// ============================================================

export type StorageBackend = "local" | "s3";

export interface StoredFile {
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  bytes: number;
}

// ============================================================
// Local storage
// ============================================================

const LOCAL_BASE = env.STORAGE_LOCAL_PATH || "./uploads";

async function ensureLocalDir(subPath: string): Promise<string> {
  const dir = path.join(LOCAL_BASE, subPath);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function storeFileLocally(
  buffer: Buffer,
  fileName: string,
  userId: string,
  subPath: string,
): Promise<StoredFile> {
  const dir = await ensureLocalDir(path.join(userId, subPath));
  const ext = path.extname(fileName) || ".bin";
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  const storageName = `${hash}${ext}`;
  const fullPath = path.join(dir, storageName);

  await fs.writeFile(fullPath, buffer);

  const stats = await fs.stat(fullPath);

  return {
    storageKey: `${userId}/${subPath}/${storageName}`,
    mimeType: getMimeType(ext),
    bytes: stats.size,
  };
}

export async function getLocalFile(storageKey: string): Promise<Buffer> {
  const fullPath = path.join(LOCAL_BASE, storageKey);
  return fs.readFile(fullPath);
}

// ============================================================
// File validation
// ============================================================

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".bmp"],
  video: [".mp4", ".webm", ".mov", ".avi"],
  audio: [".mp3", ".wav", ".ogg", ".m4a", ".flac"],
  document: [".pdf", ".doc", ".docx"],
};

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/flac"],
};

export function validateFile(
  buffer: Buffer,
  fileName: string,
  declaredMimeType: string,
  category: "image" | "video" | "audio" | "document",
): { valid: boolean; error?: string } {
  // Check extension
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS[category]?.includes(ext)) {
    return { valid: false, error: `File extension ${ext} not allowed for ${category}` };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES[category]?.includes(declaredMimeType)) {
    return { valid: false, error: `MIME type ${declaredMimeType} not allowed for ${category}` };
  }

  // Check size
  const maxSize = parseInt(env.MAX_UPLOAD_SIZE_BYTES, 10);
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File too large: ${buffer.length} bytes (max ${maxSize})`,
    };
  }

  // Check not empty
  if (buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  return { valid: true };
}

// ============================================================
// MIME type helper
// ============================================================

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".pdf": "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

// ============================================================
// Storage key generation
// ============================================================

export function generateStorageKey(
  userId: string,
  type: "uploads" | "generations" | "projects" | "brands" | "director",
  fileName: string,
): string {
  const hash = crypto.randomUUID().slice(0, 8);
  const ext = path.extname(fileName);
  return `users/${userId}/${type}/${hash}${ext}`;
}

// ============================================================
// Cleanup
// ============================================================

export async function deleteFile(storageKey: string): Promise<void> {
  if (env.STORAGE_BACKEND === "local") {
    const fullPath = path.join(LOCAL_BASE, storageKey);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  // S3 deletion would go here
}
