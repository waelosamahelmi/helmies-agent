// Helmies Studio — Brand Engine
// Brand Kit management, fingerprinting, context compilation for prompts

import type { BrandEnforcementMode, BrandFingerprint } from "@helmies/contracts";

// ============================================================
// Brand fingerprint extraction from visual analysis
// ============================================================

export function extractBrandFingerprint(
  analysisResults: {
    palette?: string[];
    style?: Record<string, unknown>;
  }[],
): BrandFingerprint {
  const allColors: string[] = [];
  const visualTraits: Record<string, number> = {};

  for (const analysis of analysisResults) {
    if (analysis.palette) {
      allColors.push(...analysis.palette);
    }
    if (analysis.style) {
      for (const [key, value] of Object.entries(analysis.style)) {
        const k = `${key}:${value}`;
        visualTraits[k] = (visualTraits[k] || 0) + 1;
      }
    }
  }

  // Extract dominant colors (top 5 most frequent)
  const colorFreq = new Map<string, number>();
  for (const c of allColors) {
    colorFreq.set(c, (colorFreq.get(c) || 0) + 1);
  }
  const sorted = [...colorFreq.entries()].sort((a, b) => b[1] - a[1]);
  const primary = sorted.slice(0, 3).map(([c]) => c);
  const secondary = sorted.slice(3, 6).map(([c]) => c);

  // Extract dominant visual traits
  const topTraits = Object.entries(visualTraits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const visual: Record<string, string> = {};
  for (const [trait] of topTraits) {
    const [key, value] = trait.split(":");
    if (!visual[key]) {
      visual[key] = value;
    }
  }

  return {
    palette: { primary, secondary },
    visual,
    avoid: ["low quality", "watermark", "generic stock"],
  };
}

// ============================================================
// Brand context compilation for prompts
// ============================================================

export interface CompiledBrandContext {
  paletteConstraint: string;
  logoConstraint: string;
  typographyConstraint: string;
  styleConstraint: string;
  forbiddenElements: string;
  compactContext: string; // For inclusion in LLM prompts (token-efficient)
}

export function compileBrandContext(
  brandConfig: Record<string, unknown>,
  fingerprint: BrandFingerprint | null,
  enforcementMode: BrandEnforcementMode,
  capability: string,
): CompiledBrandContext {
  const isImage = capability.startsWith("image");
  const isVideo = capability.startsWith("video");

  // Palette constraint
  const colors = fingerprint?.palette?.primary?.join(", ") || "";
  const paletteConstraint = isImage
    ? `Use brand colors: ${colors}. Preserve exact brand palette.`
    : "";

  // Logo constraint
  const logoConstraint = isImage
    ? "Preserve logo aspect ratio and safe area. Do not distort or crop the logo."
    : "";

  // Typography constraint
  const typographyConstraint = isImage
    ? `Use brand typography: ${fingerprint?.typography?.heading || "brand heading font"} for headlines, ${fingerprint?.typography?.body || "brand body font"} for body text.`
    : "";

  // Style constraint
  const styleDesc = fingerprint?.visual
    ? Object.entries(fingerprint.visual)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "";
  const styleConstraint = isImage
    ? `Visual style: ${styleDesc}. Maintain brand consistency.`
    : isVideo
      ? `Visual style: ${styleDesc}.`
      : "";

  // Forbidden elements
  const forbiddenElements = fingerprint?.avoid?.length
    ? `Avoid: ${fingerprint.avoid.join(", ")}.`
    : "";

  // Compact context for LLM tool context (token-efficient)
  const compactParts: string[] = [];
  if (colors) compactParts.push(`Brand colors: [${colors}]`);
  if (styleDesc) compactParts.push(`Brand style: ${styleDesc}`);
  if (fingerprint?.avoid?.length) compactParts.push(`Avoid: ${fingerprint.avoid.slice(0, 3).join(", ")}`);

  const compactContext = compactParts.join(" | ");

  return {
    paletteConstraint: enforcementMode !== "off" ? paletteConstraint : "",
    logoConstraint: enforcementMode === "locked" ? logoConstraint : "",
    typographyConstraint: enforcementMode !== "off" ? typographyConstraint : "",
    styleConstraint: enforcementMode !== "off" ? styleConstraint : "",
    forbiddenElements: enforcementMode !== "off" ? forbiddenElements : "",
    compactContext,
  };
}

// ============================================================
// Brand relevance scoring
// ============================================================

export function scoreBrandRelevance(
  brandKitId: string,
  projectContext: Record<string, unknown>,
  capability: string,
): number {
  // Only include brand when relevant to the capability
  const relevantCapabilities = [
    "image.generate",
    "image.edit",
    "video.generate",
    "video.image_to_video",
  ];

  if (!relevantCapabilities.includes(capability)) {
    return 0; // Brand not relevant for audio/LLM
  }

  // Higher score = more relevant
  let score = 0.5; // Base relevance

  if (projectContext) {
    score += 0.3; // Project-scoped
  }

  return Math.min(score, 1.0);
}

// ============================================================
// Brand violation detection
// ============================================================

export interface BrandViolation {
  type: "color" | "logo" | "typography" | "style";
  severity: "low" | "medium" | "high";
  description: string;
}

export function detectBrandViolations(
  qualityResult: Record<string, number>,
  fingerprint: BrandFingerprint,
): BrandViolation[] {
  const violations: BrandViolation[] = [];

  // Check brand consistency score
  const brandScore = qualityResult.brandConsistency || 1;
  if (brandScore < 0.7) {
    violations.push({
      type: "style",
      severity: "high",
      description: `Brand consistency below threshold: ${(brandScore * 100).toFixed(0)}%`,
    });
  } else if (brandScore < 0.85) {
    violations.push({
      type: "style",
      severity: "medium",
      description: `Brand consistency needs improvement: ${(brandScore * 100).toFixed(0)}%`,
    });
  }

  return violations;
}
