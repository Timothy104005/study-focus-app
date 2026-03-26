import type { InferenceRequest, InferenceUsage } from "./contracts";
import type { ModelCapabilityProfile } from "./model-registry";
import type { CostTier } from "./types";
import { costTierRank } from "./types";

export type BudgetDecisionStatus = "allow" | "warn" | "block";

export interface BudgetCheckContext {
  request: InferenceRequest;
  candidate: ModelCapabilityProfile;
  attemptNumber: number;
}

export interface BudgetCheckResult {
  status: BudgetDecisionStatus;
  reason?: string;
  estimatedCostUsd?: number;
  suggestedMaxCostTier?: CostTier;
}

export interface BudgetRecordContext extends BudgetCheckContext {
  usage?: InferenceUsage;
}

// Keep this interface small so teams can swap in anything from a no-op guard
// to tenant-aware spend accounting without changing router code.
export interface BudgetGuard {
  preflight(context: BudgetCheckContext): Promise<BudgetCheckResult> | BudgetCheckResult;
  record?(context: BudgetRecordContext): Promise<void> | void;
}

export class NoopBudgetGuard implements BudgetGuard {
  preflight(): BudgetCheckResult {
    return { status: "allow" };
  }
}

export interface StaticBudgetGuardOptions {
  maximumCostTier: CostTier;
  warnAtCostTier?: CostTier;
}

export class StaticBudgetGuard implements BudgetGuard {
  constructor(private readonly options: StaticBudgetGuardOptions) {}

  preflight(context: BudgetCheckContext): BudgetCheckResult {
    const candidateRank = costTierRank(context.candidate.costTier);
    const maximumRank = costTierRank(this.options.maximumCostTier);

    if (candidateRank > maximumRank) {
      return {
        status: "block",
        reason: `Model ${context.candidate.modelId} exceeds the configured budget tier.`,
        suggestedMaxCostTier: this.options.maximumCostTier,
      };
    }

    if (
      this.options.warnAtCostTier &&
      candidateRank >= costTierRank(this.options.warnAtCostTier)
    ) {
      return {
        status: "warn",
        reason: `Model ${context.candidate.modelId} is at or above the budget warning tier.`,
        suggestedMaxCostTier: this.options.warnAtCostTier,
      };
    }

    return { status: "allow" };
  }
}
