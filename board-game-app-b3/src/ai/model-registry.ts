import type { DataPolicy } from "./policy";
import type {
  CapabilityRequirement,
  CostTier,
  InferenceTaskType,
  LatencyTier,
  ProviderPath,
  StrengthTier,
} from "./types";
import { costTierRank, meetsMinimumStrength } from "./types";

export interface ModelCapabilityFlags {
  toolCalls: boolean;
  jsonMode: boolean;
  vision: boolean;
  audioInput: boolean;
  streaming: boolean;
}

// This is the provider-neutral routing record. Keep modelId stable for app code,
// even if providerModelId changes later to track a vendor rename or upgrade.
export interface ModelCapabilityProfile {
  modelId: string;
  providerId: string;
  providerModelId?: string;
  displayName: string;
  providerPath: ProviderPath;
  costTier: CostTier;
  strengthTier: StrengthTier;
  latencyTier: LatencyTier;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportedTasks: readonly InferenceTaskType[];
  capabilities: ModelCapabilityFlags;
  regions: readonly string[];
  enabledByDefault: boolean;
  requiresExplicitOptIn?: boolean;
  tags?: readonly string[];
  dataPolicy?: Partial<DataPolicy>;
}

export interface ModelSelectionCriteria {
  taskType?: InferenceTaskType;
  capabilityRequirements?: CapabilityRequirement;
  blockedProviderIds?: readonly string[];
  explicitlyEnabledModelIds?: readonly string[];
  blockedModelIds?: readonly string[];
  minimumStrength?: StrengthTier;
  targetCostTier?: CostTier;
  permittedProviderPaths?: readonly ProviderPath[];
  allowOptInModels?: boolean;
  allowDisabledModels?: boolean;
}

export class ModelCapabilityRegistry {
  private readonly profiles = new Map<string, ModelCapabilityProfile>();

  constructor(seedProfiles: readonly ModelCapabilityProfile[] = []) {
    this.registerMany(seedProfiles);
  }

  register(profile: ModelCapabilityProfile): void {
    this.profiles.set(profile.modelId, profile);
  }

  registerMany(profiles: readonly ModelCapabilityProfile[]): void {
    for (const profile of profiles) {
      this.register(profile);
    }
  }

  get(modelId: string): ModelCapabilityProfile | undefined {
    return this.profiles.get(modelId);
  }

  list(): ModelCapabilityProfile[] {
    return Array.from(this.profiles.values());
  }

  findEligible(criteria: ModelSelectionCriteria = {}): ModelCapabilityProfile[] {
    return this.list().filter((profile) => this.matchesCriteria(profile, criteria));
  }

  private matchesCriteria(profile: ModelCapabilityProfile, criteria: ModelSelectionCriteria): boolean {
    if (criteria.taskType && !profile.supportedTasks.includes(criteria.taskType)) {
      return false;
    }

    if (criteria.blockedProviderIds?.includes(profile.providerId)) {
      return false;
    }

    if (criteria.blockedModelIds?.includes(profile.modelId)) {
      return false;
    }

    if (
      criteria.minimumStrength &&
      !meetsMinimumStrength(profile.strengthTier, criteria.minimumStrength)
    ) {
      return false;
    }

    if (
      criteria.targetCostTier &&
      costTierRank(profile.costTier) > costTierRank(criteria.targetCostTier)
    ) {
      return false;
    }

    if (
      criteria.permittedProviderPaths &&
      !criteria.permittedProviderPaths.includes(profile.providerPath)
    ) {
      return false;
    }

    const isExplicitlyEnabled = criteria.explicitlyEnabledModelIds?.includes(profile.modelId) ?? false;

    if (!criteria.allowDisabledModels && !profile.enabledByDefault && !isExplicitlyEnabled) {
      return false;
    }

    if (!criteria.allowOptInModels && profile.requiresExplicitOptIn && !isExplicitlyEnabled) {
      return false;
    }

    if (!supportsCapabilityRequirements(profile, criteria.capabilityRequirements)) {
      return false;
    }

    return true;
  }
}

export function supportsCapabilityRequirements(
  profile: ModelCapabilityProfile,
  requirements?: CapabilityRequirement,
): boolean {
  if (!requirements) {
    return true;
  }

  if (requirements.requiresToolCalls && !profile.capabilities.toolCalls) {
    return false;
  }

  if (requirements.requiresJsonMode && !profile.capabilities.jsonMode) {
    return false;
  }

  if (requirements.requiresVision && !profile.capabilities.vision) {
    return false;
  }

  if (requirements.requiresAudioInput && !profile.capabilities.audioInput) {
    return false;
  }

  if (
    requirements.minimumContextWindow &&
    profile.maxContextTokens < requirements.minimumContextWindow
  ) {
    return false;
  }

  if (
    requirements.minimumStrength &&
    !meetsMinimumStrength(profile.strengthTier, requirements.minimumStrength)
  ) {
    return false;
  }

  return true;
}
