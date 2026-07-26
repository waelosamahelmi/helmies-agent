// Helmies Studio — Canvas Compiler
// Phase 8: Converts visual Canvas documents into model-appropriate structured inputs.
// The Canvas is a visual instruction document, not just a drawing surface.

import type { CanvasDocument, CanvasObject, CanvasSemanticRole } from "@helmies/contracts";

// ============================================================
// Compiler output
// ============================================================

export interface CompiledCanvas {
  /** Flattened composition guide image (all non-mask objects rendered) */
  compositionGuideUrl?: string;
  /** High-resolution clean render of the composition */
  cleanRenderUrl?: string;
  /** Inpaint mask (black = keep, white = regenerate) */
  inpaintMaskUrl?: string;
  /** Preservation mask (white = preserve exactly) */
  preservationMaskUrl?: string;
  /** Reference assets with semantic roles */
  references: CompiledReference[];
  /** Text content requirements */
  textRequirements: TextRequirement[];
  /** Spatial region instructions */
  regionInstructions: RegionInstruction[];
  /** Compiled natural language prompt */
  compiledPrompt: string;
  /** Negative prompt built from instructions */
  negativePrompt: string;
  /** Canvas instructions as JSON for model-specific processing */
  compositionJson: Record<string, unknown>;
}

export interface CompiledReference {
  assetId: string;
  role: CanvasSemanticRole;
  weight: number; // 0-1 importance
  preserveExactly: boolean;
}

export interface TextRequirement {
  text: string;
  fontFamily?: string;
  position: { x: number; y: number };
  size: "small" | "medium" | "large" | "headline";
  color?: string;
}

export interface RegionInstruction {
  description: string;
  bounds: { x: number; y: number; width: number; height: number };
  action: "preserve" | "regenerate" | "remove" | "style_transfer";
}

// ============================================================
// Compile canvas to model inputs
// ============================================================

export function compileCanvas(
  document: CanvasDocument,
  modelCapability: string,
): CompiledCanvas {
  const objects = document.objects || [];
  const instructions = document.instructions || [];

  // Separate objects by role
  const references: CompiledReference[] = [];
  const textReqs: TextRequirement[] = [];
  const regionInstructions: RegionInstruction[] = [];
  const preserveRegions: RegionInstruction[] = [];
  const removeRegions: RegionInstruction[] = [];

  for (const obj of objects) {
    if (!obj.visible) continue;

    switch (obj.role) {
      case "product_reference":
      case "identity_reference":
      case "style_reference":
      case "layout_reference":
      case "background_reference":
        if (obj.assetId) {
          references.push({
            assetId: obj.assetId,
            role: obj.role,
            weight: obj.role === "product_reference" || obj.role === "identity_reference" ? 1.0 : 0.5,
            preserveExactly: obj.role === "preserve_exactly",
          });
        }
        break;

      case "logo":
        if (obj.assetId) {
          references.push({
            assetId: obj.assetId,
            role: "logo",
            weight: 1.0,
            preserveExactly: true,
          });
        }
        break;

      case "text_content":
        if (obj.text) {
          textReqs.push({
            text: obj.text,
            fontFamily: obj.fontFamily,
            position: { x: obj.x, y: obj.y },
            size: "medium",
            color: obj.color,
          });
        }
        break;

      case "preserve_exactly":
        regionInstructions.push({
          description: obj.promptNote || "Preserve this region exactly",
          bounds: { x: obj.x, y: obj.y, width: obj.width || 0.1, height: obj.height || 0.1 },
          action: "preserve",
        });
        break;

      case "edit_target":
        regionInstructions.push({
          description: obj.promptNote || "Edit/regenerate this region",
          bounds: { x: obj.x, y: obj.y, width: obj.width || 0.1, height: obj.height || 0.1 },
          action: "regenerate",
        });
        break;

      case "remove_target":
        regionInstructions.push({
          description: obj.promptNote || "Remove content from this region",
          bounds: { x: obj.x, y: obj.y, width: obj.width || 0.1, height: obj.height || 0.1 },
          action: "remove",
        });
        break;
    }
  }

  // Build compiled prompt
  const compiledPrompt = buildCompiledPrompt(references, textReqs, instructions, modelCapability);

  // Build negative prompt
  const negativePrompt = buildCanvasNegativePrompt(objects);

  return {
    references,
    textRequirements: textReqs,
    regionInstructions,
    compiledPrompt,
    negativePrompt,
    compositionJson: {
      width: document.width,
      height: document.height,
      aspectRatio: document.aspectRatio,
      objectCount: objects.length,
      referenceCount: references.length,
      textCount: textReqs.length,
      instructions,
    },
  };
}

// ============================================================
// Prompt building
// ============================================================

function buildCompiledPrompt(
  references: CompiledReference[],
  textReqs: TextRequirement[],
  instructions: string[],
  capability: string,
): string {
  const parts: string[] = [];

  // Add reference context
  const productRefs = references.filter((r) => r.role === "product_reference");
  const styleRefs = references.filter((r) => r.role === "style_reference");
  const identityRefs = references.filter((r) => r.role === "identity_reference");
  const logoRefs = references.filter((r) => r.role === "logo");

  if (productRefs.length > 0) {
    parts.push(`Product: use the provided product reference image${productRefs.length > 1 ? "s" : ""} as the main subject. Preserve product details exactly.`);
  }

  if (styleRefs.length > 0) {
    parts.push(`Style: match the visual style, lighting, and mood of the style reference${styleRefs.length > 1 ? "s" : ""}.`);
  }

  if (identityRefs.length > 0) {
    parts.push(`Identity: maintain the subject identity from the reference.`);
  }

  if (logoRefs.length > 0) {
    parts.push(`Logo: place the logo ${logoRefs[0].position ? `at position (${logoRefs[0].position.x}, ${logoRefs[0].position.y})` : "prominently"}. Preserve logo proportions.`);
  }

  // Add text requirements
  for (const t of textReqs) {
    parts.push(`Text "${t.text}" ${t.color ? `in ${t.color}` : ""}.`);
  }

  // Add instructions
  parts.push(...instructions);

  return parts.join(" ");
}

function buildCanvasNegativePrompt(objects: CanvasObject[]): string {
  const negatives: string[] = [
    "blurry",
    "low quality",
    "distorted text",
    "watermark",
  ];

  // Check for text objects — if present, add text-specific negatives
  const hasText = objects.some((o) => o.role === "text_content");
  if (hasText) {
    negatives.push("misspelled text", "garbled text", "illegible text", "incorrect spelling");
  }

  // Check for logo
  const hasLogo = objects.some((o) => o.role === "logo");
  if (hasLogo) {
    negatives.push("distorted logo", "stretched logo", "incorrect logo colors");
  }

  // Check for product
  const hasProduct = objects.some((o) => o.role === "product_reference");
  if (hasProduct) {
    negatives.push("altered product", "missing product details", "wrong product shape");
  }

  return negatives.join(", ");
}

// ============================================================
// Model capability checker
// ============================================================

export function checkModelCanvasCompatibility(
  modelCapability: string,
  document: CanvasDocument,
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const objects = document.objects || [];

  const referenceCount = objects.filter((o) =>
    o.assetId && ["product_reference", "style_reference", "identity_reference", "logo"].includes(o.role || ""),
  ).length;

  const hasText = objects.some((o) => o.role === "text_content");
  const hasMasks = objects.some((o) => ["preserve_exactly", "edit_target", "remove_target"].includes(o.role || ""));

  // Image generation models may have reference limits
  if (modelCapability === "image.generate" && referenceCount > 3) {
    warnings.push(`This model supports up to 3 references. You have ${referenceCount}. Consider reducing or using a model with multi-reference support.`);
  }

  if (hasText && modelCapability === "image.generate") {
    warnings.push("Text rendering quality varies by model. Verify text accuracy after generation.");
  }

  if (hasMasks && !["image.edit", "image.inpaint"].includes(modelCapability)) {
    warnings.push("Mask/preservation regions require an edit-capable model. Switch to image.edit mode.");
  }

  return {
    compatible: warnings.every((w) => !w.includes("require")),
    warnings,
  };
}
