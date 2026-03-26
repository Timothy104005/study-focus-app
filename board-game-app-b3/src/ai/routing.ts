import type { BudgetCheckResult, BudgetGuard } from "./budget";
import type {
  InferencePriority,
  InferenceRequest,
  InferenceRouteCandidate,
} from "./contracts";
import { resolveEscalationPolicy } from "./contracts";
import type {
  ModelCapabilityProfile,
  ModelCapabilityRegistry,
} from "./model-registry";
import { resolveDataPolicy } from "./policy";
import type { DataPolicy, DeploymentPolicy } from "./policy";
import type { ProviderAdapter } from "./provider-adapter";
import {
  combineUnique,
  costTierRank,
  latencyTierRank,
  meetsMinimumStrength,
  strengthTierRank,
  type StrengthTier,
} from "./types";

const TASK_DEFAULT_MINIMUM_STRENGTH: Record<InferenceRequest["taskType"], StrengthTier> = {
  classification: "bulk",
  extraction: "bulk",
  summarization: "bulk",
  generation: "balanced",
  planning: "strong",
  "tool-use": "strong",
  reasoning: "strong",
  evaluation: "balanced",
  other: "balanced",
};

export interface EscalationStep {
  model: ModelCapabilityProfile;
  reason: string;
}

export interface RoutingDecision {
  selectedModel: ModelCapabilityProfile;
  fallbackChain: readonly EscalationStep[];
  rationale: readonly string[];
  candidatePlan: readonly InferenceRouteCandidate[];
}

export interface RoutingContext {
  request: InferenceRequest;
  registry: ModelCapabilityRegistry;
  providers: ReadonlyMap<string, ProviderAdapter>;
  budgetGuard: BudgetGuard;
  dataPolicy: DataPolicy;
  deploymentPolicy: DeploymentPolicy;
}

export interface RoutingPolicy {
  readonly id: string;
  selectRoute(context: RoutingContext): Promise<RoutingDecision> | RoutingDecision;
}

// Cheap-to-strong is meant to be safe and boring by default: start with the
// lowest-cost eligible automatic model, then precompute stronger fallbacks.
export class CheapToStrongRoutingPolicy implements RoutingPolicy {
  readonly id = "cheap-to-strong-v1";

  async selectRoute(context: RoutingContext): Promise<RoutingDecision> {
    if (context.request.preferredModelId) {
      return this.selectExplicitModel(context);
    }

    const minimumStrength =
      context.request.minimumStrength ??
      TASK_DEFAULT_MINIMUM_STRENGTH[context.request.taskType];

    const blockedProviders = combineUnique(
      context.request.blockedProviderIds,
      context.deploymentPolicy.blockedProviders,
    );

    const baseCandidates = context.registry
      .findEligible({
        taskType: context.request.taskType,
        capabilityRequirements: context.request.capabilityRequirements,
        blockedProviderIds: blockedProviders,
        explicitlyEnabledModelIds: context.deploymentPolicy.explicitlyEnabledModelIds,
        blockedModelIds: context.deploymentPolicy.blockedModelIds,
        minimumStrength,
        targetCostTier: context.request.targetCostTier,
        permittedProviderPaths: context.deploymentPolicy.permittedProviderPaths,
        allowOptInModels: context.deploymentPolicy.allowOptInOnlyProviders,
        allowDisabledModels: context.deploymentPolicy.allowDisabledModels,
      })
      .filter((profile) => this.isProviderUsable(profile, context.providers))
      .filter((profile) => this.isDataPolicyCompatible(profile, context.dataPolicy))
      .filter((profile) => this.isDeploymentCompatible(profile, context.deploymentPolicy));

    if (baseCandidates.length === 0) {
      throw new Error("No eligible models match the request capabilities and deployment policy.");
    }

    const rankedCandidates = [...baseCandidates].sort((left, right) =>
      this.compareCandidates(left, right, context.request.priority, context),
    );

    const budgetAssessment = await this.applyBudgetGuard(rankedCandidates, context);

    if (budgetAssessment.approved.length === 0) {
      throw new Error("All eligible models were blocked by the budget guard.");
    }

    const selected = budgetAssessment.approved[0].model;
    const fallbackChain = this.buildEscalationChain(
      selected,
      budgetAssessment.approved.slice(1).map((entry) => entry.model),
      context.request,
    );
    const candidatePlan = this.buildCandidatePlan(
      selected,
      fallbackChain,
      budgetAssessment,
    );

    const rationale = [
      `Selected the lowest-cost eligible model that satisfies a minimum strength of ${minimumStrength}.`,
      "Automatic routing excludes non-default catalog entries unless deployment policy explicitly enables them.",
      ...(context.request.taskCategory
        ? [`Applied task category defaults for ${context.request.taskCategory}.`]
        : []),
      ...budgetAssessment.approved.flatMap((entry) =>
        entry.budget.status === "warn" && entry.budget.reason ? [entry.budget.reason] : [],
      ),
    ];

    return {
      selectedModel: selected,
      fallbackChain,
      rationale,
      candidatePlan,
    };
  }

  private async selectExplicitModel(context: RoutingContext): Promise<RoutingDecision> {
    const profile = context.registry.get(context.request.preferredModelId as string);

    if (!profile) {
      throw new Error(`Requested model ${context.request.preferredModelId} is not registered.`);
    }

    if (!this.isProviderUsable(profile, context.providers)) {
      throw new Error(`Requested model ${profile.modelId} is not backed by an enabled provider.`);
    }

    if (!this.isDataPolicyCompatible(profile, context.dataPolicy)) {
      throw new Error(`Requested model ${profile.modelId} does not satisfy the data policy.`);
    }

    if (!this.isDeploymentCompatible(profile, context.deploymentPolicy)) {
      throw new Error(`Requested model ${profile.modelId} does not satisfy the deployment policy.`);
    }

    const budget = await context.budgetGuard.preflight({
      request: context.request,
      candidate: profile,
      attemptNumber: 0,
    });

    if (budget.status === "block") {
      throw new Error(budget.reason ?? `Requested model ${profile.modelId} was blocked by budget.`);
    }

    return {
      selectedModel: profile,
      fallbackChain: [],
      rationale: [`Using explicitly requested model ${profile.modelId}.`],
      candidatePlan: [
        {
          providerId: profile.providerId,
          modelId: profile.modelId,
          disposition: "selected",
          reason: `Explicit model selection for ${profile.modelId}.`,
          budgetStatus: budget.status,
        },
      ],
    };
  }

  private async applyBudgetGuard(
    candidates: readonly ModelCapabilityProfile[],
    context: RoutingContext,
  ): Promise<{
    approved: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }>;
    blocked: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }>;
  }> {
    const approved: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }> = [];
    const blocked: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }> = [];

    for (const [index, candidate] of candidates.entries()) {
      const budget = await context.budgetGuard.preflight({
        request: context.request,
        candidate,
        attemptNumber: index,
      });

      if (budget.status === "block") {
        blocked.push({ model: candidate, budget });
        continue;
      }

      approved.push({ model: candidate, budget });
    }

    return { approved, blocked };
  }

  private buildCandidatePlan(
    selected: ModelCapabilityProfile,
    fallbackChain: readonly EscalationStep[],
    budgetAssessment: {
      approved: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }>;
      blocked: Array<{ model: ModelCapabilityProfile; budget: BudgetCheckResult }>;
    },
  ): readonly InferenceRouteCandidate[] {
    const fallbackReasons = new Map(
      fallbackChain.map((step) => [step.model.modelId, step.reason]),
    );

    const approvedPlan = budgetAssessment.approved.map((entry) => {
      if (entry.model.modelId === selected.modelId) {
        return {
          providerId: entry.model.providerId,
          modelId: entry.model.modelId,
          disposition: "selected" as const,
          reason: "Primary automatic route selection.",
          budgetStatus: entry.budget.status,
        };
      }

      if (fallbackReasons.has(entry.model.modelId)) {
        return {
          providerId: entry.model.providerId,
          modelId: entry.model.modelId,
          disposition: "fallback" as const,
          reason: fallbackReasons.get(entry.model.modelId) as string,
          budgetStatus: entry.budget.status,
        };
      }

      return {
        providerId: entry.model.providerId,
        modelId: entry.model.modelId,
        disposition: "rejected" as const,
        reason: "Eligible candidate retained outside the current fallback chain.",
        budgetStatus: entry.budget.status,
      };
    });

    const blockedPlan = budgetAssessment.blocked.map((entry) => ({
      providerId: entry.model.providerId,
      modelId: entry.model.modelId,
      disposition: "rejected" as const,
      reason: entry.budget.reason ?? "Rejected by budget guard.",
      budgetStatus: entry.budget.status,
    }));

    return [...approvedPlan, ...blockedPlan];
  }

  private buildEscalationChain(
    selected: ModelCapabilityProfile,
    candidates: readonly ModelCapabilityProfile[],
    request: InferenceRequest,
  ): readonly EscalationStep[] {
    const escalation = resolveEscalationPolicy(request.escalation);

    if (!escalation.allowModelEscalation) {
      return [];
    }

    const strongerCandidates = candidates.filter(
      (candidate) =>
        strengthTierRank(candidate.strengthTier) > strengthTierRank(selected.strengthTier) ||
        costTierRank(candidate.costTier) > costTierRank(selected.costTier),
    );

    const sortedCandidates = [...strongerCandidates].sort((left, right) => {
      if (
        escalation.preferSameProvider &&
        left.providerId === selected.providerId &&
        right.providerId !== selected.providerId
      ) {
        return -1;
      }

      if (
        escalation.preferSameProvider &&
        right.providerId === selected.providerId &&
        left.providerId !== selected.providerId
      ) {
        return 1;
      }

      return strengthTierRank(left.strengthTier) - strengthTierRank(right.strengthTier);
    });

    return sortedCandidates.slice(0, escalation.maxEscalationSteps).map((model) => ({
      model,
      reason: `Escalate from ${selected.modelId} to ${model.modelId} when higher quality is needed.`,
    }));
  }

  private compareCandidates(
    left: ModelCapabilityProfile,
    right: ModelCapabilityProfile,
    priority: InferencePriority | undefined,
    context: RoutingContext,
  ): number {
    const preferredProviders = combineUnique(
      context.request.preferredProviderIds,
      context.deploymentPolicy.preferredProviders,
    );

    const preferredRegions = context.deploymentPolicy.preferredRegions;

    const providerScoreDelta =
      this.preferenceScore(right.providerId, preferredProviders) -
      this.preferenceScore(left.providerId, preferredProviders);

    if (providerScoreDelta !== 0) {
      return providerScoreDelta;
    }

    const regionScoreDelta =
      this.preferenceScoreForAny(right.regions, preferredRegions) -
      this.preferenceScoreForAny(left.regions, preferredRegions);

    if (regionScoreDelta !== 0) {
      return regionScoreDelta;
    }

    if (priority === "quality") {
      return (
        strengthTierRank(right.strengthTier) - strengthTierRank(left.strengthTier) ||
        costTierRank(left.costTier) - costTierRank(right.costTier) ||
        latencyTierRank(left.latencyTier) - latencyTierRank(right.latencyTier)
      );
    }

    if (priority === "latency") {
      return (
        latencyTierRank(left.latencyTier) - latencyTierRank(right.latencyTier) ||
        costTierRank(left.costTier) - costTierRank(right.costTier) ||
        strengthTierRank(left.strengthTier) - strengthTierRank(right.strengthTier)
      );
    }

    if (priority === "cost") {
      return (
        costTierRank(left.costTier) - costTierRank(right.costTier) ||
        latencyTierRank(left.latencyTier) - latencyTierRank(right.latencyTier) ||
        strengthTierRank(left.strengthTier) - strengthTierRank(right.strengthTier)
      );
    }

    return (
      costTierRank(left.costTier) - costTierRank(right.costTier) ||
      strengthTierRank(right.strengthTier) - strengthTierRank(left.strengthTier) ||
      latencyTierRank(left.latencyTier) - latencyTierRank(right.latencyTier)
    );
  }

  private preferenceScore(value: string, preferredValues: readonly string[]): number {
    return preferredValues.includes(value) ? 1 : 0;
  }

  private preferenceScoreForAny(values: readonly string[], preferredValues: readonly string[]): number {
    return values.some((value) => preferredValues.includes(value)) ? 1 : 0;
  }

  private isProviderUsable(
    profile: ModelCapabilityProfile,
    providers: ReadonlyMap<string, ProviderAdapter>,
  ): boolean {
    const adapter = providers.get(profile.providerId);

    return Boolean(adapter?.isEnabled() && adapter.supportsModel(profile));
  }

  private isDataPolicyCompatible(
    profile: ModelCapabilityProfile,
    requestPolicy: DataPolicy,
  ): boolean {
    const providerPolicy = resolveDataPolicy(profile.dataPolicy);

    if (
      requestPolicy.requiredResidency &&
      providerPolicy.requiredResidency &&
      requestPolicy.requiredResidency !== providerPolicy.requiredResidency
    ) {
      return false;
    }

    if (!requestPolicy.providerMayStorePrompts && providerPolicy.providerMayStorePrompts) {
      return false;
    }

    if (!requestPolicy.providerMayTrainOnPrompts && providerPolicy.providerMayTrainOnPrompts) {
      return false;
    }

    if (!requestPolicy.crossRegionTransferAllowed && providerPolicy.crossRegionTransferAllowed) {
      return false;
    }

    return true;
  }

  private isDeploymentCompatible(
    profile: ModelCapabilityProfile,
    deploymentPolicy: DeploymentPolicy,
  ): boolean {
    if (deploymentPolicy.blockedProviders.includes(profile.providerId)) {
      return false;
    }

    if (deploymentPolicy.blockedModelIds.includes(profile.modelId)) {
      return false;
    }

    if (!deploymentPolicy.permittedProviderPaths.includes(profile.providerPath)) {
      return false;
    }

    if (!deploymentPolicy.allowOptInOnlyProviders && profile.requiresExplicitOptIn) {
      return false;
    }

    if (
      deploymentPolicy.blockedRegions.length > 0 &&
      profile.regions.every((region) => deploymentPolicy.blockedRegions.includes(region))
    ) {
      return false;
    }

    return true;
  }
}

export function ensureMinimumStrength(
  minimumStrength: StrengthTier,
  candidate: ModelCapabilityProfile,
): boolean {
  return meetsMinimumStrength(candidate.strengthTier, minimumStrength);
}
