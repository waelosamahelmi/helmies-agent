// Helmies Studio — Director Service
// Phase 14: Clean-room implementation of multi-shot production planning.
// Does NOT copy Maestro source code. Implements independently:
// ProductionPlan, ShotPlan, continuity, cost planning, shot reruns, reassembly.

import type { ProductionPlan, ShotPlan } from "@helmies/contracts";

// ============================================================
// Planning pipeline
// ============================================================

export interface DirectorInput {
  creativeBrief: string;
  targetDurationSec: number;
  platform: string;
  aspect: string;
  brandKitId?: string;
  characters?: string[];
  products?: string[];
  references?: string[];
  script?: string;
  lyrics?: string;
  audioReference?: string;
  budgetMode: "economy" | "balanced" | "premium";
  qualityMode: "fast" | "balanced" | "premium";
}

export interface DirectorPlanResult {
  productionPlan: ProductionPlan;
  estimatedCredits: number;
  maximumCredits: number;
  shotCount: number;
  totalDurationSec: number;
  warnings: string[];
}

// ============================================================
// Pass A: Creative Structure
// ============================================================

function planCreativeStructure(input: DirectorInput): {
  storyBeats: string[];
  creativeConcept: string;
  globalStyle: string;
} {
  // Determine story beats based on duration and type
  const duration = input.targetDurationSec;
  let beatCount: number;

  if (duration <= 10) beatCount = 2;
  else if (duration <= 20) beatCount = 3;
  else if (duration <= 30) beatCount = 4;
  else beatCount = Math.min(6, Math.ceil(duration / 8));

  const storyBeats: string[] = [];
  for (let i = 0; i < beatCount; i++) {
    if (i === 0) storyBeats.push("Opening: Establish product/brand presence");
    else if (i === beatCount - 1) storyBeats.push("Closing: Logo reveal + CTA");
    else storyBeats.push(`Scene ${i + 1}: Feature highlight / mood transition`);
  }

  return {
    storyBeats,
    creativeConcept: input.creativeBrief,
    globalStyle: input.qualityMode === "premium" ? "cinematic premium" : "modern commercial",
  };
}

// ============================================================
// Pass B: Shot Breakdown
// ============================================================

function breakDownShots(
  storyBeats: string[],
  totalDuration: number,
  input: DirectorInput,
): ShotPlan[] {
  const shotsPerBeat = 1; // Can be 2 for complex beats
  const totalShots = storyBeats.length * shotsPerBeat;
  const avgShotDuration = totalDuration / totalShots;

  const shots: ShotPlan[] = [];
  let shotIndex = 0;

  for (const beat of storyBeats) {
    const shot: ShotPlan = {
      id: `shot_${String(shotIndex + 1).padStart(2, "0")}`,
      index: shotIndex,
      title: beat.split(":")[0] || `Shot ${shotIndex + 1}`,
      durationSec: Math.round(avgShotDuration * 10) / 10,
      narrativeRole: beat,
      sceneGoal: beat,
      subjects: [],
      environment: "studio",
      spatialSetup: shotIndex === 0 ? "establishing wide" : "medium product focus",
      lighting: input.qualityMode === "premium" ? "cinematic three-point" : "soft commercial",
      mood: shotIndex === 0 ? "intriguing" : shotIndex === totalShots - 1 ? "confident" : "engaging",
      camera: {
        framing: shotIndex === 0 ? "wide shot" : "medium shot",
        angle: "eye level",
        lens: "50mm",
        movement: shotIndex === 0 ? "slow push-in" : shotIndex === totalShots - 1 ? "static" : "subtle dolly",
        intensity: "subtle",
      },
      imageStrategy: {
        mode: shotIndex === 0 ? "generate" : "reuse_previous_end_frame",
        prompt: beat,
        references: [],
      },
      videoStrategy: {
        mode: "t2v",
        prompt: beat,
        modelRoute: input.qualityMode === "premium" ? "video.premium" : "video.standard",
      },
      audio: shotIndex === 0
        ? { dialogue: input.creativeBrief, ambience: "studio atmosphere" }
        : undefined,
      continuity: [],
    };

    shots.push(shot);
    shotIndex++;
  }

  return shots;
}

// ============================================================
// Pass C & D: Prompt generation
// ============================================================

function generateShotPrompts(
  shots: ShotPlan[],
  input: DirectorInput,
): ShotPlan[] {
  return shots.map((shot, i) => {
    const isFirst = i === 0;
    const isLast = i === shots.length - 1;

    // Image/first-frame prompt
    const imagePrompt = isFirst
      ? `${input.creativeBrief}, establishing shot, ${shot.camera.framing}, ${shot.lighting}, premium commercial quality`
      : `${input.creativeBrief}, continuation shot, ${shot.camera.framing}, consistent lighting and product placement`;

    // Video motion prompt
    const videoPrompt = isFirst
      ? `${input.creativeBrief}, ${shot.camera.movement}, ${shot.durationSec}s, smooth cinematic motion, opening sequence`
      : isLast
        ? `${input.creativeBrief}, ${shot.camera.movement}, ${shot.durationSec}s, logo reveal, confident conclusion`
        : `${input.creativeBrief}, ${shot.camera.movement}, ${shot.durationSec}s, continuous motion from previous shot`;

    return {
      ...shot,
      imageStrategy: {
        ...shot.imageStrategy,
        prompt: imagePrompt,
      },
      videoStrategy: {
        ...shot.videoStrategy,
        prompt: videoPrompt,
      },
      continuity: isFirst
        ? ["establish product identity", "set color grade"]
        : ["maintain product identity", "match color grade from shot 1", "seamless transition from previous end frame"],
    };
  });
}

// ============================================================
// Pass E: Validation
// ============================================================

function validatePlan(
  shots: ShotPlan[],
  targetDuration: number,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalDuration = shots.reduce((sum, s) => sum + s.durationSec, 0);

  if (Math.abs(totalDuration - targetDuration) > targetDuration * 0.2) {
    warnings.push(
      `Total duration (${totalDuration.toFixed(1)}s) differs from target (${targetDuration}s) by >20%`,
    );
  }

  if (shots.length === 0) {
    errors.push("Plan must contain at least one shot");
  }

  if (shots.length > 12) {
    warnings.push("High shot count may result in long generation times");
  }

  // Check continuity across shots
  for (let i = 1; i < shots.length; i++) {
    if (!shots[i].continuity?.length) {
      warnings.push(`Shot ${i + 1} missing continuity constraints`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Pass F: Cost estimation
// ============================================================

function estimateCost(
  shots: ShotPlan[],
  budgetMode: "economy" | "balanced" | "premium",
): { estimatedCredits: number; maximumCredits: number } {
  // Cost constants (would come from pricing engine in production)
  const imageCost: Record<string, number> = {
    economy: 35,
    balanced: 80,
    premium: 140,
  };

  const videoCostPerSec: Record<string, number> = {
    economy: 35,
    balanced: 50,
    premium: 80,
  };

  let total = 0;
  let max = 0;

  for (const shot of shots) {
    const imgCost = shot.imageStrategy.mode === "generate"
      ? imageCost[budgetMode]
      : 0;

    const vidCost = Math.ceil(shot.durationSec * videoCostPerSec[budgetMode]);

    total += imgCost + vidCost;
  }

  // Max: add 15% buffer for retries
  max = Math.ceil(total * 1.15);

  return {
    estimatedCredits: total,
    maximumCredits: max,
  };
}

// ============================================================
// Full planning pipeline
// ============================================================

export function planProduction(input: DirectorInput): DirectorPlanResult {
  // Pass A: Creative structure
  const structure = planCreativeStructure(input);

  // Pass B: Shot breakdown
  const shots = breakDownShots(structure.storyBeats, input.targetDurationSec, input);

  // Pass C & D: Prompts
  const promptedShots = generateShotPrompts(shots, input);

  // Pass E: Validation
  const validation = validatePlan(promptedShots, input.targetDurationSec);

  // Pass F: Cost
  const cost = estimateCost(promptedShots, input.budgetMode);

  // Build production plan
  const productionPlan: ProductionPlan = {
    id: `plan_${Date.now()}`,
    title: input.creativeBrief.slice(0, 80),
    type: input.targetDurationSec <= 15 ? "social" : "ad",
    durationSec: input.targetDurationSec,
    globalStyle: structure.globalStyle,
    brandKitId: input.brandKitId,
    subjects: [],
    locations: [],
    shots: promptedShots,
    continuityRules: [
      "Maintain consistent color grade across all shots",
      "Preserve product identity throughout",
      "Smooth transitions between shots",
    ],
  };

  return {
    productionPlan,
    estimatedCredits: cost.estimatedCredits,
    maximumCredits: cost.maximumCredits,
    shotCount: promptedShots.length,
    totalDurationSec: promptedShots.reduce((s, shot) => s + shot.durationSec, 0),
    warnings: validation.warnings,
  };
}

// ============================================================
// Shot rerun support
// ============================================================

export function canRerunShot(
  shot: ShotPlan,
  pipelineStatus: string,
): boolean {
  const rerunnableStatuses = [
    "completed",
    "generating_images",
    "generating_video",
    "quality_check",
  ];
  return rerunnableStatuses.includes(pipelineStatus);
}

export function getShotDependencies(
  shotIndex: number,
  shots: ShotPlan[],
): number[] {
  // A shot depends on the immediately preceding shot's end frame
  if (shotIndex === 0) return [];
  return [shotIndex - 1];
}

export function getAffectedShots(
  rerunShotIndex: number,
  shots: ShotPlan[],
): number[] {
  // Rerunning a shot affects all subsequent shots due to continuity
  const affected: number[] = [];
  for (let i = rerunShotIndex; i < shots.length; i++) {
    affected.push(i);
  }
  return affected;
}

// ============================================================
// Reassembly
// ============================================================

export interface AssemblyInstruction {
  shotIndex: number;
  assetId: string;
  startTimeSec: number;
  durationSec: number;
}

export function generateAssemblyPlan(shots: ShotPlan[]): AssemblyInstruction[] {
  let currentTime = 0;
  const instructions: AssemblyInstruction[] = [];

  for (const shot of shots) {
    instructions.push({
      shotIndex: shot.index,
      assetId: `shot_${shot.id}`,
      startTimeSec: currentTime,
      durationSec: shot.durationSec,
    });
    currentTime += shot.durationSec;
  }

  return instructions;
}
