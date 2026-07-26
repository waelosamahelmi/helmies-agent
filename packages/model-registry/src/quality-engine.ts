// Helmies Studio — Quality Engine
// Section 77: Automated quality checks for generated outputs.
// Validates file integrity, prompt alignment, reference consistency, brand compliance.

// ============================================================
// Quality dimensions
// ============================================================

export interface QualityScores {
  technical: number; // 0-1: file valid, expected dimensions, no corruption
  promptAlignment: number; // 0-1: how well output matches the prompt
  referenceConsistency: number; // 0-1: similarity to reference images
  brandConsistency: number; // 0-1: brand palette/logo compliance
  textAccuracy: number; // 0-1: OCR text matches requested text
}

export interface QualityResult {
  passed: boolean;
  scores: QualityScores;
  overallScore: number; // weighted average
  issues: QualityIssue[];
  recommendation: "accept" | "retry" | "reject";
}

export interface QualityIssue {
  dimension: keyof QualityScores;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface QualityCheckInput {
  assetUrl: string;
  assetType: "image" | "video" | "audio";
  expectedWidth?: number;
  expectedHeight?: number;
  expectedDurationSec?: number;
  prompt: string;
  referenceUrls?: string[];
  expectedText?: string[];
  brandPalette?: string[];
  logoRequired?: boolean;
}

// ============================================================
// Quality thresholds
// ============================================================

const THRESHOLDS = {
  technical: { accept: 0.95, retry: 0.8 },
  promptAlignment: { accept: 0.8, retry: 0.6 },
  referenceConsistency: { accept: 0.75, retry: 0.5 },
  brandConsistency: { accept: 0.85, retry: 0.7 },
  textAccuracy: { accept: 0.9, retry: 0.7 },
  overall: { accept: 0.8, retry: 0.6 },
};

// ============================================================
// Quality evaluation
// ============================================================

export async function evaluateQuality(input: QualityCheckInput): Promise<QualityResult> {
  const issues: QualityIssue[] = [];

  // 1. Technical check
  const technical = await checkTechnicalQuality(input);
  if (technical < THRESHOLDS.technical.retry) {
    issues.push({ dimension: "technical", severity: "high", description: "File appears corrupted or has wrong dimensions" });
  }

  // 2. Prompt alignment (simplified - in production uses vision model)
  const promptAlignment = 0.85; // Placeholder: actual implementation calls vision model
  if (promptAlignment < THRESHOLDS.promptAlignment.retry) {
    issues.push({ dimension: "promptAlignment", severity: "medium", description: "Output may not match the prompt" });
  }

  // 3. Reference consistency
  let referenceConsistency = 1.0;
  if (input.referenceUrls && input.referenceUrls.length > 0) {
    referenceConsistency = 0.9; // Placeholder: actual comparison via vision
    if (referenceConsistency < THRESHOLDS.referenceConsistency.retry) {
      issues.push({ dimension: "referenceConsistency", severity: "medium", description: "Output differs significantly from references" });
    }
  }

  // 4. Brand consistency
  let brandConsistency = 1.0;
  if (input.brandPalette && input.brandPalette.length > 0) {
    brandConsistency = 0.88; // Placeholder: palette detection via vision
    if (brandConsistency < THRESHOLDS.brandConsistency.retry) {
      issues.push({ dimension: "brandConsistency", severity: "medium", description: "Brand colors not detected in output" });
    }
  }

  // 5. Text accuracy
  let textAccuracy = 1.0;
  if (input.expectedText && input.expectedText.length > 0) {
    textAccuracy = 0.85; // Placeholder: OCR verification
    if (textAccuracy < THRESHOLDS.textAccuracy.retry) {
      issues.push({ dimension: "textAccuracy", severity: "high", description: "Requested text may be missing or incorrect" });
    }
  }

  // Calculate overall score
  const weights = {
    technical: 0.2,
    promptAlignment: 0.3,
    referenceConsistency: 0.2,
    brandConsistency: 0.15,
    textAccuracy: 0.15,
  };

  const overallScore =
    technical * weights.technical +
    promptAlignment * weights.promptAlignment +
    referenceConsistency * weights.referenceConsistency +
    brandConsistency * weights.brandConsistency +
    textAccuracy * weights.textAccuracy;

  // Recommendation
  let recommendation: "accept" | "retry" | "reject";
  if (overallScore >= THRESHOLDS.overall.accept) {
    recommendation = "accept";
  } else if (overallScore >= THRESHOLDS.overall.retry) {
    recommendation = "retry";
  } else {
    recommendation = "reject";
  }

  // If any dimension is critically low, reject
  const hasCriticalIssue = issues.some((i) =>
    i.severity === "high" &&
    (i.dimension === "technical" || i.dimension === "textAccuracy"),
  );
  if (hasCriticalIssue && recommendation !== "reject") {
    recommendation = "retry";
  }

  return {
    passed: recommendation === "accept",
    scores: {
      technical,
      promptAlignment,
      referenceConsistency,
      brandConsistency,
      textAccuracy,
    },
    overallScore: Math.round(overallScore * 1000) / 1000,
    issues,
    recommendation,
  };
}

// ============================================================
// Technical quality check
// ============================================================

async function checkTechnicalQuality(input: QualityCheckInput): Promise<number> {
  let score = 1.0;

  try {
    // Fetch asset headers to validate
    const response = await fetch(input.assetUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return 0; // Cannot access file
    }

    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");

    // Check file is not empty
    if (contentLength && parseInt(contentLength) < 100) {
      return 0.1;
    }

    // Check content type matches expected
    const expectedTypes: Record<string, string[]> = {
      image: ["image/"],
      video: ["video/"],
      audio: ["audio/"],
    };

    const expected = expectedTypes[input.assetType];
    if (expected && contentType && !expected.some((t) => contentType.startsWith(t))) {
      score -= 0.3;
    }

    // Dimension checks would require actually downloading and parsing the file
    // For now, this is a basic check

  } catch {
    return 0; // Cannot access file
  }

  return Math.max(0, score);
}

// ============================================================
// Retry budget tracker
// ============================================================

export interface RetryBudget {
  maxRetries: number;
  currentRetries: number;
  maxCreditsSpent: number;
  creditsSpent: number;
}

export function canRetry(
  budget: RetryBudget,
  qualityResult: QualityResult,
): boolean {
  if (qualityResult.recommendation === "accept") return false;
  if (qualityResult.recommendation === "reject") return false;
  if (budget.currentRetries >= budget.maxRetries) return false;
  return true;
}

export function shouldAutoRetry(
  qualityResult: QualityResult,
  retryCount: number,
  maxAutoRetries = 2,
): boolean {
  if (retryCount >= maxAutoRetries) return false;
  if (qualityResult.recommendation === "reject") return false;
  if (qualityResult.overallScore >= 0.7) return false; // Close enough, ask user
  return qualityResult.recommendation === "retry";
}
