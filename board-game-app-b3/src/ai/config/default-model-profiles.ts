import {
  ModelCapabilityRegistry,
  type ModelCapabilityProfile,
} from "../model-registry";
import {
  allowProviderPath,
  optIntoModels,
  type DeploymentPolicy,
} from "../policy";

const BULK_TASKS = ["classification", "extraction", "summarization"] as const;
const GENERAL_TASKS = [
  "classification",
  "extraction",
  "summarization",
  "generation",
  "evaluation",
  "other",
] as const;
const STRONG_TASKS = [
  "generation",
  "planning",
  "tool-use",
  "reasoning",
  "evaluation",
  "other",
] as const;

export const DEFAULT_MODEL_PROFILES: readonly ModelCapabilityProfile[] = [
  {
    modelId: "bulk-primary",
    providerId: "openai",
    providerModelId: "gpt-4o-mini",
    displayName: "Primary bulk model",
    providerPath: "primary",
    costTier: "low",
    strengthTier: "bulk",
    latencyTier: "low",
    maxContextTokens: 128_000,
    maxOutputTokens: 16_000,
    supportedTasks: GENERAL_TASKS,
    capabilities: {
      toolCalls: true,
      jsonMode: true,
      vision: true,
      audioInput: false,
      streaming: true,
    },
    regions: ["global", "us", "eu"],
    enabledByDefault: true,
    dataPolicy: {
      providerMayStorePrompts: false,
      providerMayTrainOnPrompts: false,
      crossRegionTransferAllowed: true,
    },
  },
  {
    modelId: "strong-primary",
    providerId: "openai",
    providerModelId: "gpt-5",
    displayName: "Primary strong model",
    providerPath: "primary",
    costTier: "high",
    strengthTier: "frontier",
    latencyTier: "medium",
    maxContextTokens: 256_000,
    maxOutputTokens: 32_000,
    supportedTasks: STRONG_TASKS,
    capabilities: {
      toolCalls: true,
      jsonMode: true,
      vision: true,
      audioInput: false,
      streaming: true,
    },
    regions: ["global", "us", "eu"],
    enabledByDefault: true,
    dataPolicy: {
      providerMayStorePrompts: false,
      providerMayTrainOnPrompts: false,
      crossRegionTransferAllowed: true,
    },
  },
  {
    modelId: "strong-secondary",
    providerId: "anthropic",
    providerModelId: "claude-sonnet",
    displayName: "Secondary strong model",
    providerPath: "secondary",
    costTier: "medium",
    strengthTier: "strong",
    latencyTier: "medium",
    maxContextTokens: 200_000,
    maxOutputTokens: 16_000,
    supportedTasks: STRONG_TASKS,
    capabilities: {
      toolCalls: true,
      jsonMode: true,
      vision: true,
      audioInput: false,
      streaming: true,
    },
    regions: ["global", "us", "eu"],
    enabledByDefault: true,
    dataPolicy: {
      providerMayStorePrompts: false,
      providerMayTrainOnPrompts: false,
      crossRegionTransferAllowed: true,
    },
  },
  {
    modelId: "bulk-regional-optional",
    providerId: "deepseek",
    providerModelId: "deepseek-chat",
    displayName: "Optional regional bulk model",
    providerPath: "regional-optional",
    costTier: "ultra-low",
    strengthTier: "bulk",
    latencyTier: "low",
    maxContextTokens: 64_000,
    maxOutputTokens: 8_000,
    supportedTasks: BULK_TASKS,
    capabilities: {
      toolCalls: false,
      jsonMode: true,
      vision: false,
      audioInput: false,
      streaming: true,
    },
    regions: ["cn"],
    enabledByDefault: false,
    requiresExplicitOptIn: true,
    tags: ["regional", "cost-optimized"],
    dataPolicy: {
      providerMayStorePrompts: true,
      providerMayTrainOnPrompts: false,
      crossRegionTransferAllowed: false,
      requiredResidency: "cn",
    },
  },
  {
    modelId: "strong-regional-optional",
    providerId: "qwen",
    providerModelId: "qwen-max",
    displayName: "Optional regional strong model",
    providerPath: "regional-optional",
    costTier: "low",
    strengthTier: "strong",
    latencyTier: "medium",
    maxContextTokens: 128_000,
    maxOutputTokens: 16_000,
    supportedTasks: STRONG_TASKS,
    capabilities: {
      toolCalls: true,
      jsonMode: true,
      vision: true,
      audioInput: false,
      streaming: true,
    },
    regions: ["cn"],
    enabledByDefault: false,
    requiresExplicitOptIn: true,
    tags: ["regional", "quality-escalation"],
    dataPolicy: {
      providerMayStorePrompts: true,
      providerMayTrainOnPrompts: false,
      crossRegionTransferAllowed: false,
      requiredResidency: "cn",
    },
  },
];

export const OPTIONAL_REGIONAL_MODEL_IDS = [
  "bulk-regional-optional",
  "strong-regional-optional",
] as const;

export function createDefaultModelCapabilityRegistry(): ModelCapabilityRegistry {
  return new ModelCapabilityRegistry(DEFAULT_MODEL_PROFILES);
}

export function createRegionalOptionalDeploymentPolicy(
  basePolicy?: Partial<DeploymentPolicy>,
): DeploymentPolicy {
  return optIntoModels(
    OPTIONAL_REGIONAL_MODEL_IDS,
    allowProviderPath("regional-optional", basePolicy),
  );
}
