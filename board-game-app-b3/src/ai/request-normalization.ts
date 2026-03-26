import type { CapabilityRequirement } from "./types";
import type { InferenceInputAsset, InferenceRequest } from "./contracts";
import { applyTaskCategoryDefaults } from "./task-categories";

function deriveCapabilityRequirementsFromAssets(
  assets?: readonly InferenceInputAsset[],
): CapabilityRequirement {
  if (!assets || assets.length === 0) {
    return {};
  }

  const derivedRequirements: CapabilityRequirement = {};

  if (assets.some((asset) => asset.kind === "image")) {
    derivedRequirements.requiresVision = true;
  }

  if (assets.some((asset) => asset.kind === "audio")) {
    derivedRequirements.requiresAudioInput = true;
  }

  return derivedRequirements;
}

export function normalizeInferenceRequest(request: InferenceRequest): InferenceRequest {
  const categoryAdjustedRequest = applyTaskCategoryDefaults(request);
  const assetRequirements = deriveCapabilityRequirementsFromAssets(
    categoryAdjustedRequest.inputAssets,
  );

  // Normalize once before routing so policies operate on one practical request shape.
  return {
    ...categoryAdjustedRequest,
    executionMode: categoryAdjustedRequest.executionMode ?? "execute",
    capabilityRequirements: {
      ...assetRequirements,
      ...categoryAdjustedRequest.capabilityRequirements,
    },
  };
}
