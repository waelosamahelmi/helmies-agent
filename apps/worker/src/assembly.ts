// Helmies Studio — Assembly Service (Section 134)
// FFmpeg-based video joining, audio preservation, normalization, thumbnails.

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

export interface AssemblyInput {
  clips: Array<{
    assetPath: string;
    startSec?: number;
    durationSec: number;
    transition?: "cut" | "fade" | "dissolve";
  }>;
  outputFormat: "mp4" | "webm";
  resolution?: string; // "1080p", "720p"
  fps?: number;
  audioTrack?: string; // Background music path
  normalizeAudio?: boolean;
}

export interface AssemblyResult {
  outputPath: string;
  durationSec: number;
  sizeBytes: number;
}

export async function assembleVideo(input: AssemblyInput): Promise<AssemblyResult> {
  const outputDir = path.dirname(input.clips[0].assetPath);
  const outputName = `assembled_${Date.now()}.${input.outputFormat}`;
  const outputPath = path.join(outputDir, outputName);

  // Build FFmpeg filter complex for concatenation
  const filterParts: string[] = [];
  const inputs: string[] = [];

  for (let i = 0; i < input.clips.length; i++) {
    const clip = input.clips[i];
    inputs.push(`-i "${clip.assetPath}"`);

    // Trim each clip
    const start = clip.startSec ? `trim=start=${clip.startSec}:duration=${clip.durationSec},setpts=PTS-STARTPTS` : `trim=duration=${clip.durationSec},setpts=PTS-STARTPTS`;
    filterParts.push(`[${i}:v]${start}[v${i}]`);
  }

  // Concat all video streams
  const concatInputs = input.clips.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${input.clips.length}:v=1:a=0[outv]`);

  // Add audio track if provided
  if (input.audioTrack) {
    inputs.push(`-i "${input.audioTrack}"`);
    filterParts.push(`[${input.clips.length}:a]afade=t=out:st=${input.clips.reduce((s, c) => s + c.durationSec, 0) - 2}:d=2[outa]`);
  }

  const filterComplex = filterParts.join(";");
  const mapOutput = input.audioTrack ? `-map "[outv]" -map "[outa]"` : `-map "[outv]"`;

  const cmd = [
    "ffmpeg -y",
    inputs.join(" "),
    `-filter_complex "${filterComplex}"`,
    mapOutput,
    `-c:v libx264 -preset medium -crf 23`,
    input.fps ? `-r ${input.fps}` : "",
    input.resolution ? `-vf "scale=-2:${input.resolution.replace('p', '')}"` : "",
    input.audioTrack ? `-c:a aac -b:a 192k` : "",
    `"${outputPath}"`,
  ].filter(Boolean).join(" ");

  try {
    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout
    const stat = await fs.stat(outputPath);

    return {
      outputPath,
      durationSec: input.clips.reduce((s, c) => s + c.durationSec, 0),
      sizeBytes: stat.size,
    };
  } catch (error: any) {
    throw new Error(`FFmpeg assembly failed: ${error.message}`);
  }
}

export async function generateThumbnail(
  videoPath: string,
  outputDir: string,
  timeSec: number = 1,
): Promise<string> {
  const thumbName = `thumb_${path.basename(videoPath, path.extname(videoPath))}.jpg`;
  const thumbPath = path.join(outputDir, thumbName);

  const cmd = `ffmpeg -y -i "${videoPath}" -ss ${timeSec} -vframes 1 -q:v 2 "${thumbPath}"`;

  await execAsync(cmd, { timeout: 15000 });
  return thumbPath;
}

export async function normalizeVideo(
  inputPath: string,
  outputPath: string,
  targetFps: number = 30,
): Promise<string> {
  const cmd = `ffmpeg -y -i "${inputPath}" -r ${targetFps} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outputPath}"`;
  await execAsync(cmd, { timeout: 300000 });
  return outputPath;
}
