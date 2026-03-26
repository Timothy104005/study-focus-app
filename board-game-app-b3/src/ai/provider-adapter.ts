import type {
  InferenceFinishReason,
  InferenceRequest,
  InferenceUsage,
} from "./contracts";
import type { ModelCapabilityProfile } from "./model-registry";
import type { ProviderPath } from "./types";

export interface ProviderDescriptor {
  providerId: string;
  displayName: string;
  providerPath: ProviderPath;
  enabled: boolean;
  regions: readonly string[];
}

export interface ProviderExecutionResult {
  outputText?: string;
  outputJson?: unknown;
  finishReason?: InferenceFinishReason;
  usage?: InferenceUsage;
  rawResponse?: unknown;
}

// Provider adapters isolate SDK-specific request/response translation.
// The router only speaks in provider-neutral contracts and model profiles.
export interface ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  isEnabled(): boolean;
  supportsModel(model: ModelCapabilityProfile): boolean;
  infer(request: InferenceRequest, model: ModelCapabilityProfile): Promise<ProviderExecutionResult>;
}
