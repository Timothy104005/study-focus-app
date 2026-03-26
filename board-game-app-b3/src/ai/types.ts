export const COST_TIER_ORDER = ["ultra-low", "low", "medium", "high"] as const;
export type CostTier = (typeof COST_TIER_ORDER)[number];

export const STRENGTH_TIER_ORDER = ["bulk", "balanced", "strong", "frontier"] as const;
export type StrengthTier = (typeof STRENGTH_TIER_ORDER)[number];

export const LATENCY_TIER_ORDER = ["low", "medium", "high"] as const;
export type LatencyTier = (typeof LATENCY_TIER_ORDER)[number];

export type ProviderPath = "primary" | "secondary" | "regional-optional" | "self-hosted";

export type InferenceTaskType =
  | "classification"
  | "extraction"
  | "summarization"
  | "generation"
  | "planning"
  | "tool-use"
  | "reasoning"
  | "evaluation"
  | "other";

export type OutputMode = "text" | "json" | "tool-plan";
export type RoutingTaskCategory =
  | "cheap-bulk-extraction"
  | "ambiguity-escalation"
  | "multimodal-assist"
  | "bot-policy-decision";

export interface CapabilityRequirement {
  requiresToolCalls?: boolean;
  requiresJsonMode?: boolean;
  requiresVision?: boolean;
  requiresAudioInput?: boolean;
  minimumContextWindow?: number;
  minimumStrength?: StrengthTier;
}

export function costTierRank(tier: CostTier): number {
  return COST_TIER_ORDER.indexOf(tier);
}

export function strengthTierRank(tier: StrengthTier): number {
  return STRENGTH_TIER_ORDER.indexOf(tier);
}

export function latencyTierRank(tier: LatencyTier): number {
  return LATENCY_TIER_ORDER.indexOf(tier);
}

export function meetsMinimumStrength(candidate: StrengthTier, minimum: StrengthTier): boolean {
  return strengthTierRank(candidate) >= strengthTierRank(minimum);
}

export function combineUnique<T>(...groups: ReadonlyArray<ReadonlyArray<T> | undefined>): T[] {
  const values = new Set<T>();

  for (const group of groups) {
    if (!group) {
      continue;
    }

    for (const value of group) {
      values.add(value);
    }
  }

  return Array.from(values);
}
