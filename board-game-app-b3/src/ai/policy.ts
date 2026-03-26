import { combineUnique, type ProviderPath } from "./types";

export type DataClassification = "public" | "internal" | "confidential" | "restricted";
export type DataResidency = "global" | "us" | "eu" | "cn" | "regional" | "customer-managed";

export interface DataPolicy {
  classification: DataClassification;
  providerMayStorePrompts: boolean;
  providerMayTrainOnPrompts: boolean;
  crossRegionTransferAllowed: boolean;
  requiredResidency?: DataResidency;
  redactionRequired: boolean;
}

export interface DeploymentPolicy {
  permittedProviderPaths: readonly ProviderPath[];
  preferredProviders: readonly string[];
  blockedProviders: readonly string[];
  explicitlyEnabledModelIds: readonly string[];
  blockedModelIds: readonly string[];
  preferredRegions: readonly string[];
  blockedRegions: readonly string[];
  allowOptInOnlyProviders: boolean;
  allowDisabledModels: boolean;
}

export const DEFAULT_DATA_POLICY: DataPolicy = {
  classification: "internal",
  providerMayStorePrompts: false,
  providerMayTrainOnPrompts: false,
  crossRegionTransferAllowed: true,
  redactionRequired: false,
};

export const DEFAULT_DEPLOYMENT_POLICY: DeploymentPolicy = {
  permittedProviderPaths: ["primary", "secondary", "self-hosted"],
  preferredProviders: [],
  blockedProviders: [],
  explicitlyEnabledModelIds: [],
  blockedModelIds: [],
  preferredRegions: [],
  blockedRegions: [],
  allowOptInOnlyProviders: false,
  allowDisabledModels: false,
};

export function resolveDataPolicy(...overrides: Array<Partial<DataPolicy> | undefined>): DataPolicy {
  return Object.assign({}, DEFAULT_DATA_POLICY, ...overrides);
}

export function resolveDeploymentPolicy(
  ...overrides: Array<Partial<DeploymentPolicy> | undefined>
): DeploymentPolicy {
  return Object.assign({}, DEFAULT_DEPLOYMENT_POLICY, ...overrides);
}

export function allowProviderPath(
  providerPath: ProviderPath,
  basePolicy?: Partial<DeploymentPolicy>,
): DeploymentPolicy {
  const resolved = resolveDeploymentPolicy(basePolicy);

  return {
    ...resolved,
    permittedProviderPaths: combineUnique(resolved.permittedProviderPaths, [providerPath]),
  };
}

// Use this narrow helper when a deployment intentionally opts into catalog entries
// that are not part of the default routing pool, such as regional-optional models.
export function optIntoModels(
  modelIds: readonly string[],
  basePolicy?: Partial<DeploymentPolicy>,
): DeploymentPolicy {
  const resolved = resolveDeploymentPolicy(basePolicy);

  return {
    ...resolved,
    explicitlyEnabledModelIds: combineUnique(resolved.explicitlyEnabledModelIds, modelIds),
    allowOptInOnlyProviders: true,
    allowDisabledModels: true,
  };
}
