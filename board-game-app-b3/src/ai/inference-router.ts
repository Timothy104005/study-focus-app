import { NoopBudgetGuard, type BudgetGuard } from "./budget";
import type { InferenceAttemptTrace, InferenceRequest, InferenceResult } from "./contracts";
import { resolveEscalationPolicy } from "./contracts";
import type { ModelCapabilityRegistry } from "./model-registry";
import type { DataPolicy, DeploymentPolicy } from "./policy";
import { resolveDataPolicy, resolveDeploymentPolicy } from "./policy";
import type { ProviderAdapter } from "./provider-adapter";
import { normalizeInferenceRequest } from "./request-normalization";
import type { RoutingDecision, RoutingPolicy } from "./routing";

export interface InferenceRouterOptions {
  registry: ModelCapabilityRegistry;
  providers: readonly ProviderAdapter[];
  routingPolicy: RoutingPolicy;
  budgetGuard?: BudgetGuard;
  defaultDataPolicy?: Partial<DataPolicy>;
  defaultDeploymentPolicy?: Partial<DeploymentPolicy>;
}

export interface PlannedInference {
  request: InferenceRequest;
  dataPolicy: DataPolicy;
  deploymentPolicy: DeploymentPolicy;
  decision: RoutingDecision;
}

export class InferenceRouter {
  private readonly providers: ReadonlyMap<string, ProviderAdapter>;
  private readonly budgetGuard: BudgetGuard;

  constructor(private readonly options: InferenceRouterOptions) {
    this.providers = new Map(
      options.providers.map((provider) => [provider.descriptor.providerId, provider]),
    );
    this.budgetGuard = options.budgetGuard ?? new NoopBudgetGuard();
  }

  async plan(request: InferenceRequest): Promise<PlannedInference> {
    const normalizedRequest = normalizeInferenceRequest(request);
    const dataPolicy = resolveDataPolicy(
      this.options.defaultDataPolicy,
      normalizedRequest.dataPolicy,
    );
    const deploymentPolicy = resolveDeploymentPolicy(
      this.options.defaultDeploymentPolicy,
      normalizedRequest.deploymentPolicy,
    );

    const decision = await this.options.routingPolicy.selectRoute({
      request: normalizedRequest,
      registry: this.options.registry,
      providers: this.providers,
      budgetGuard: this.budgetGuard,
      dataPolicy,
      deploymentPolicy,
    });

    return {
      request: normalizedRequest,
      dataPolicy,
      deploymentPolicy,
      decision,
    };
  }

  async dryRun(request: InferenceRequest): Promise<InferenceResult> {
    const planned = await this.plan({ ...request, executionMode: "dry-run" });
    const { decision } = planned;

    return {
      requestId: planned.request.requestId,
      executionMode: "dry-run",
      providerId: decision.selectedModel.providerId,
      modelId: decision.selectedModel.modelId,
      finishReason: "unknown",
      rawResponse: {
        dryRun: true,
        note: "No provider adapter was invoked.",
      },
      route: {
        policyId: this.options.routingPolicy.id,
        selectedProviderId: decision.selectedModel.providerId,
        selectedModelId: decision.selectedModel.modelId,
        fallbackModelIds: decision.fallbackChain.map((step) => step.model.modelId),
        rationale: [...decision.rationale, "Dry run only; provider execution was skipped."],
        candidatePlan: decision.candidatePlan,
        attempts: [
          {
            providerId: decision.selectedModel.providerId,
            modelId: decision.selectedModel.modelId,
            status: "skipped",
            reason: "Dry run only; provider execution was skipped.",
          },
        ],
      },
    };
  }

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    if (request.executionMode === "dry-run") {
      return this.dryRun(request);
    }

    const planned = await this.plan(request);
    const { decision } = planned;
    const escalation = resolveEscalationPolicy(planned.request.escalation);
    const executionModels = [
      decision.selectedModel,
      ...decision.fallbackChain.map((step) => step.model),
    ].slice(0, escalation.allowModelEscalation ? escalation.maxEscalationSteps + 1 : 1);

    const attempts: InferenceAttemptTrace[] = [];

    // The router retries by moving through the precomputed cheap-to-strong chain.
    // Provider adapters stay responsible for the underlying SDK calls only.
    for (const [index, model] of executionModels.entries()) {
      const adapter = this.providers.get(model.providerId);

      if (!adapter) {
        attempts.push({
          providerId: model.providerId,
          modelId: model.modelId,
          status: "skipped",
          reason: "No provider adapter is registered for the selected provider.",
        });
        continue;
      }

      try {
        const providerResult = await adapter.infer(planned.request, model);

        attempts.push({
          providerId: model.providerId,
          modelId: model.modelId,
          status: "succeeded",
          reason:
            index === 0
              ? "Primary route succeeded."
              : "Escalated route succeeded after an earlier failure.",
        });

        await this.budgetGuard.record?.({
          request: planned.request,
          candidate: model,
          attemptNumber: index,
          usage: providerResult.usage,
        });

        return {
          requestId: planned.request.requestId,
          executionMode: planned.request.executionMode,
          providerId: model.providerId,
          modelId: model.modelId,
          outputText: providerResult.outputText,
          outputJson: providerResult.outputJson,
          finishReason: providerResult.finishReason ?? "unknown",
          usage: providerResult.usage,
          rawResponse: providerResult.rawResponse,
          route: {
            policyId: this.options.routingPolicy.id,
            selectedProviderId: model.providerId,
            selectedModelId: model.modelId,
            fallbackModelIds: decision.fallbackChain.map((step) => step.model.modelId),
            rationale: decision.rationale,
            candidatePlan: decision.candidatePlan,
            attempts,
          },
        };
      } catch (error) {
        attempts.push({
          providerId: model.providerId,
          modelId: model.modelId,
          status: "failed",
          reason:
            index === 0
              ? "Primary route failed during provider execution."
              : "Escalated route failed during provider execution.",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw new Error(
      `All provider attempts failed. Attempted models: ${attempts
        .map((attempt) => `${attempt.providerId}/${attempt.modelId}`)
        .join(", ")}.`,
    );
  }
}
