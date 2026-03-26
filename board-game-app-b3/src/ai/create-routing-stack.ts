import { NoopBudgetGuard, type BudgetGuard } from "./budget";
import { DEFAULT_MODEL_PROFILES } from "./config/default-model-profiles";
import { InferenceRouter } from "./inference-router";
import {
  ModelCapabilityRegistry,
  type ModelCapabilityProfile,
} from "./model-registry";
import {
  resolveDataPolicy,
  resolveDeploymentPolicy,
  type DataPolicy,
  type DeploymentPolicy,
} from "./policy";
import type { ProviderAdapter } from "./provider-adapter";
import { CheapToStrongRoutingPolicy, type RoutingPolicy } from "./routing";

export interface CreateAiRoutingStackOptions {
  providers: readonly ProviderAdapter[];
  modelProfiles?: readonly ModelCapabilityProfile[];
  routingPolicy?: RoutingPolicy;
  budgetGuard?: BudgetGuard;
  defaultDataPolicy?: Partial<DataPolicy>;
  defaultDeploymentPolicy?: Partial<DeploymentPolicy>;
}

export interface AiRoutingStack {
  registry: ModelCapabilityRegistry;
  routingPolicy: RoutingPolicy;
  budgetGuard: BudgetGuard;
  defaultDataPolicy: DataPolicy;
  defaultDeploymentPolicy: DeploymentPolicy;
  router: InferenceRouter;
}

// This is the minimal assembly point for app integration: provide adapters,
// optionally override profiles/policies, and receive a ready-to-use router.
export function createAiRoutingStack(
  options: CreateAiRoutingStackOptions,
): AiRoutingStack {
  const registry = new ModelCapabilityRegistry(
    options.modelProfiles ?? DEFAULT_MODEL_PROFILES,
  );
  const routingPolicy = options.routingPolicy ?? new CheapToStrongRoutingPolicy();
  const budgetGuard = options.budgetGuard ?? new NoopBudgetGuard();
  const defaultDataPolicy = resolveDataPolicy(options.defaultDataPolicy);
  const defaultDeploymentPolicy = resolveDeploymentPolicy(
    options.defaultDeploymentPolicy,
  );

  return {
    registry,
    routingPolicy,
    budgetGuard,
    defaultDataPolicy,
    defaultDeploymentPolicy,
    router: new InferenceRouter({
      registry,
      providers: options.providers,
      routingPolicy,
      budgetGuard,
      defaultDataPolicy,
      defaultDeploymentPolicy,
    }),
  };
}
