import type { InferenceRequest } from "./contracts";
import { combineUnique, type RoutingTaskCategory } from "./types";

export interface TaskCategoryRequestDefaults {
  taskType: InferenceRequest["taskType"];
  priority?: InferenceRequest["priority"];
  outputMode?: InferenceRequest["outputMode"];
  minimumStrength?: InferenceRequest["minimumStrength"];
  targetCostTier?: InferenceRequest["targetCostTier"];
  capabilityRequirements?: InferenceRequest["capabilityRequirements"];
  preferredProviderIds?: readonly string[];
  blockedProviderIds?: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface TaskCategoryProfile {
  id: RoutingTaskCategory;
  description: string;
  requestDefaults: TaskCategoryRequestDefaults;
}

// These are intentionally small routing presets, not workflow implementations.
export const TASK_CATEGORY_PROFILES: Record<RoutingTaskCategory, TaskCategoryProfile> = {
  "cheap-bulk-extraction": {
    id: "cheap-bulk-extraction",
    description: "Low-cost bulk parsing and structured extraction tasks.",
    requestDefaults: {
      taskType: "extraction",
      priority: "cost",
      outputMode: "json",
      minimumStrength: "bulk",
      targetCostTier: "low",
      capabilityRequirements: {
        requiresJsonMode: true,
      },
      metadata: {
        taskCategoryIntent: "bulk-structured-output",
      },
    },
  },
  "ambiguity-escalation": {
    id: "ambiguity-escalation",
    description: "Tasks that should bias toward stronger reasoning and clearer fallback steps.",
    requestDefaults: {
      taskType: "reasoning",
      priority: "balanced",
      minimumStrength: "strong",
      targetCostTier: "medium",
      metadata: {
        taskCategoryIntent: "resolve-ambiguity",
      },
    },
  },
  "multimodal-assist": {
    id: "multimodal-assist",
    description: "Tasks that expect image-aware assistance or other multimodal context.",
    requestDefaults: {
      taskType: "generation",
      priority: "balanced",
      minimumStrength: "balanced",
      capabilityRequirements: {
        requiresVision: true,
      },
      metadata: {
        taskCategoryIntent: "multimodal-help",
      },
    },
  },
  "bot-policy-decision": {
    id: "bot-policy-decision",
    description: "Policy or moderation style decisions where structured output matters.",
    requestDefaults: {
      taskType: "evaluation",
      priority: "quality",
      outputMode: "json",
      minimumStrength: "strong",
      capabilityRequirements: {
        requiresJsonMode: true,
      },
      metadata: {
        taskCategoryIntent: "policy-decision",
      },
    },
  },
};

export function getTaskCategoryProfile(taskCategory: RoutingTaskCategory): TaskCategoryProfile {
  return TASK_CATEGORY_PROFILES[taskCategory];
}

export function applyTaskCategoryDefaults(request: InferenceRequest): InferenceRequest {
  if (!request.taskCategory) {
    return request;
  }

  const profile = getTaskCategoryProfile(request.taskCategory);

  return {
    ...profile.requestDefaults,
    ...request,
    capabilityRequirements: {
      ...profile.requestDefaults.capabilityRequirements,
      ...request.capabilityRequirements,
    },
    preferredProviderIds: combineUnique(
      profile.requestDefaults.preferredProviderIds,
      request.preferredProviderIds,
    ),
    blockedProviderIds: combineUnique(
      profile.requestDefaults.blockedProviderIds,
      request.blockedProviderIds,
    ),
    metadata: {
      ...(profile.requestDefaults.metadata ?? {}),
      ...(request.metadata ?? {}),
    },
  };
}
