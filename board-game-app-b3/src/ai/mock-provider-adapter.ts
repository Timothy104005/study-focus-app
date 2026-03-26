import type {
  InferenceFinishReason,
  InferenceRequest,
} from "./contracts";
import type { ModelCapabilityProfile } from "./model-registry";
import type {
  ProviderAdapter,
  ProviderDescriptor,
  ProviderExecutionResult,
} from "./provider-adapter";

export interface MockProviderAdapterOptions {
  descriptor: ProviderDescriptor;
  supportedModelIds?: readonly string[];
  defaultFinishReason?: InferenceFinishReason;
  resultFactory?: (
    request: InferenceRequest,
    model: ModelCapabilityProfile,
  ) => ProviderExecutionResult | Promise<ProviderExecutionResult>;
}

function buildDefaultResult(
  request: InferenceRequest,
  model: ModelCapabilityProfile,
  finishReason: InferenceFinishReason,
): ProviderExecutionResult {
  const latestMessage = request.messages[request.messages.length - 1];
  const preview = latestMessage?.content
    ? latestMessage.content.slice(0, 120)
    : "mock response";

  return {
    outputText: `[mock:${model.modelId}] ${preview}`,
    finishReason,
    rawResponse: {
      mock: true,
      providerId: model.providerId,
      modelId: model.modelId,
    },
  };
}

// Useful for local wiring, unit tests, and integration spikes before any
// real provider SDK is connected.
export class MockProviderAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor;

  constructor(private readonly options: MockProviderAdapterOptions) {
    this.descriptor = options.descriptor;
  }

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  supportsModel(model: ModelCapabilityProfile): boolean {
    if (model.providerId !== this.descriptor.providerId) {
      return false;
    }

    if (
      this.options.supportedModelIds &&
      !this.options.supportedModelIds.includes(model.modelId)
    ) {
      return false;
    }

    return true;
  }

  async infer(
    request: InferenceRequest,
    model: ModelCapabilityProfile,
  ): Promise<ProviderExecutionResult> {
    if (!this.supportsModel(model)) {
      throw new Error(
        `Mock provider ${this.descriptor.providerId} does not support model ${model.modelId}.`,
      );
    }

    if (this.options.resultFactory) {
      return this.options.resultFactory(request, model);
    }

    return buildDefaultResult(
      request,
      model,
      this.options.defaultFinishReason ?? "stop",
    );
  }
}

export function createMockProviderAdapter(
  options: MockProviderAdapterOptions,
): ProviderAdapter {
  return new MockProviderAdapter(options);
}
