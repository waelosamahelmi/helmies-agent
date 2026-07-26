// Helmies Studio — Vision Service
// Phase 9: Image/reference analysis — caption, palette, OCR, objects, style
// Provider-agnostic: supports local Florence or cloud multimodal LLMs

import type { VisualAnalysisResult } from "@helmies/contracts";

// ============================================================
// Vision Analyzer Interface
// ============================================================

export interface AnalyzeImageInput {
  imageUrl: string; // Internal URL or storage key
  imageBase64?: string;
  analysisTypes: ("caption" | "palette" | "objects" | "ocr" | "style" | "regions")[];
  modelRoute?: string; // "vision.fast", "vision.standard", "vision.premium"
}

export interface CompareImagesInput {
  imageUrlA: string;
  imageUrlB: string;
  compareAspects: ("similarity" | "style_transfer" | "subject_match" | "composition")[];
}

export interface VisualComparison {
  similarityScore: number;
  styleMatch: number;
  subjectMatch: number;
  compositionMatch: number;
  differences: string[];
  recommendations: string[];
}

// ============================================================
// Default analyzer (uses cloud multimodal LLM)
// ============================================================

export async function analyzeImage(input: AnalyzeImageInput): Promise<VisualAnalysisResult> {
  // In production, this calls a multimodal LLM (e.g., GPT-4o, Gemini) or local Florence
  // For now, return a structured placeholder that the provider adapter fills

  const result: VisualAnalysisResult = {
    caption: "",
    palette: [],
    subjects: [],
    objects: [],
    textRegions: [],
    regions: [],
  };

  // Build analysis prompt based on requested types
  const prompts: string[] = [];

  if (input.analysisTypes.includes("caption")) {
    prompts.push("Describe this image in detail including subject, setting, lighting, and mood.");
  }
  if (input.analysisTypes.includes("palette")) {
    prompts.push("Extract the dominant color palette (5-7 hex colors).");
  }
  if (input.analysisTypes.includes("objects")) {
    prompts.push("List all objects, people, and elements with their positions.");
  }
  if (input.analysisTypes.includes("ocr")) {
    prompts.push("Extract all visible text, word by word, with positions.");
  }
  if (input.analysisTypes.includes("style")) {
    prompts.push("Describe the visual style: photographic/illustration/3D, lighting, composition, texture.");
  }
  if (input.analysisTypes.includes("regions")) {
    prompts.push("Identify key regions and their semantic meaning.");
  }

  // TODO: Call multimodal LLM with the image and prompts
  // const response = await callVisionModel(input.imageUrl, prompts.join("\n"));
  // Parse structured response into VisualAnalysisResult

  return result;
}

export async function analyzeImageBatch(
  inputs: AnalyzeImageInput[],
): Promise<VisualAnalysisResult[]> {
  return Promise.all(inputs.map(analyzeImage));
}

export async function compareImages(input: CompareImagesInput): Promise<VisualComparison> {
  // TODO: Call vision model for comparison
  return {
    similarityScore: 0,
    styleMatch: 0,
    subjectMatch: 0,
    compositionMatch: 0,
    differences: [],
    recommendations: [],
  };
}

// ============================================================
// Palette utilities
// ============================================================

export function extractDominantColors(palette: string[], count: number = 3): string[] {
  // Return top N dominant colors
  return palette.slice(0, count);
}

export function isColorInPalette(color: string, palette: string[], threshold = 30): boolean {
  // Simple Euclidean distance in RGB space
  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });

  const c1 = hexToRgb(color);
  for (const p of palette) {
    const c2 = hexToRgb(p);
    const dist = Math.sqrt(
      (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2,
    );
    if (dist <= threshold) return true;
  }
  return false;
}

// ============================================================
// OCR utilities
// ============================================================

export interface TextRegion {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export function extractAllText(regions: TextRegion[]): string {
  return regions.map((r) => r.text).join(" ");
}

export function findText(
  regions: TextRegion[],
  searchText: string,
): TextRegion | null {
  const lower = searchText.toLowerCase();
  return regions.find((r) => r.text.toLowerCase().includes(lower)) || null;
}

// ============================================================
// Style fingerprint
// ============================================================

export interface StyleFingerprint {
  medium: string; // "photograph", "illustration", "3d_render", "digital_art"
  lighting: string; // "natural", "studio", "dramatic", "flat"
  composition: string; // "centered", "rule_of_thirds", "asymmetric", "minimal"
  colorTemperature: string; // "warm", "cool", "neutral"
  texture: string; // "smooth", "grainy", "matte", "glossy"
  era: string; // "contemporary", "vintage", "futuristic"
}

export function classifyStyle(analysis: VisualAnalysisResult): StyleFingerprint {
  const style = analysis.style || {};
  const lighting = analysis.lighting || {};

  return {
    medium: (style.medium as string) || "photograph",
    lighting: (lighting.type as string) || "natural",
    composition: (style.composition as string) || "centered",
    colorTemperature: (style.colorTemperature as string) || "neutral",
    texture: (style.texture as string) || "smooth",
    era: (style.era as string) || "contemporary",
  };
}

// ============================================================
// Vision Service Server
// ============================================================

async function start() {
  console.log("[vision-service] Helmies Studio Vision Service starting...");

  // In production, this would be an Express server:
  //
  // POST /analyze       — analyze a single image
  // POST /analyze-batch  — analyze multiple images
  // POST /compare        — compare two images
  // POST /ocr            — extract text
  // POST /palette        — extract color palette

  console.log("[vision-service] Ready");
}

start();
