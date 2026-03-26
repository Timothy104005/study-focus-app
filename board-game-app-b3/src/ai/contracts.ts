import type { DataPolicy, DeploymentPolicy } from "./policy";
import type {
  CapabilityRequirement,
  CostTier,
  InferenceTaskType,
  OutputMode,
  RoutingTaskCategory,
  StrengthTier,
} from "./types";

export type MessageRole = "system" | "developer" | "user" | "assistant" | "tool";
export type InferencePriority = "cost" | "latency" | "balanced" | "quality";
export type InferenceFinishReason = "stop" | "length" | "tool-call" | "content-filter" | "error" | "unknown";
export type InferenceExecutionMode = "execute" | "dry-run";
export type InferenceInputAssetKind = "image" | "audio" | "file" | "json";

export interface InferenceMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface InferenceInputAsset {
  kind: InferenceInputAssetKind;
  uri?: string;
  mediaType?: string;
  description?: string;
}

export interface EscalationPolicy {
  allowModelEscalation: boolean;
  maxEscalationSteps: number;
  preferSameProvider: boolean;
}

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  allowModelEscalation: true,
  maxEscalationSteps: 2,
  preferSameProvider: true,
};

export interface InferenceRequest {
  requestId?: string;
  preferredModelId?: string;
  messages: readonly InferenceMessage[];
  taskType: InferenceTaskType;
  taskCategory?: RoutingTaskCategory;
  executionMode?: InferenceExecutionMode;
  outputMode?: OutputMode;
  priority?: InferencePriority;
  inputAssets?: readonly InferenceInputAsset[];
  capabilityRequirements?: CapabilityRequirement;
  preferredProviderIds?: readonly string[];
  blockedProviderIds?: readonly string[];
  targetCostTier?: CostTier;
  minimumStrength?: StrengthTier;
  maxOutputTokens?: number;
  temperature?: number;
  dataPolicy?: Partial<DataPolicy>;
  deploymentPolicy?: Partial<DeploymentPolicy>;
  escalation?: Partial<EscalationPolicy>;
  budgetScope?: string;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface InferenceUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface InferenceAttemptTrace {
  providerId: string;
  modelId: string;
  status: "succeeded" | "failed" | "skipped";
  reason: string;
  errorMessage?: string;
}

export interface InferenceRouteCandidate {
  providerId: string;
  modelId: string;
  disposition: "selected" | "fallback" | "rejected";
  reason: string;
  budgetStatus?: "allow" | "warn" | "block";
}

export interface InferenceRouteTrace {
  policyId: string;
  selectedProviderId: string;
  selectedModelId: string;
  fallbackModelIds: readonly string[];
  rationale: readonly string[];
  candidatePlan: readonly InferenceRouteCandidate[];
  attempts: readonly InferenceAttemptTrace[];
}

export interface InferenceResult {
  requestId?: string;
  executionMode?: InferenceExecutionMode;
  providerId: string;
  modelId: string;
  outputText?: string;
  outputJson?: unknown;
  finishReason: InferenceFinishReason;
  usage?: InferenceUsage;
  route: InferenceRouteTrace;
  rawResponse?: unknown;
}

export function resolveEscalationPolicy(
  override?: Partial<EscalationPolicy>,
): EscalationPolicy {
  return { ...DEFAULT_ESCALATION_POLICY, ...override };
}
