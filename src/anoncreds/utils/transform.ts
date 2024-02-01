import {
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
} from '@aries-framework/anoncreds/build/models/registry'

export type RevocationRegistryDelta = {
  accum: string
  issued: number[]
  revoked: number[]
  txnTime: number
}
enum RevocationState {
  Active,
  Revoked,
}
export async function anonCredsRevocationStatusListFromIPFS(
  revocationRegistryDefinitionId: string,
  revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition,
  delta: RevocationRegistryDelta,
  isIssuanceByDefault: boolean
): Promise<AnonCredsRevocationStatusList> {
  // Check whether the highest delta index is supported in the `maxCredNum` field of the
  // revocation registry definition. This will likely also be checked on other levels as well
  // by the ledger or the indy-vdr library itself
  if (Math.max(...delta.issued, ...delta.revoked) >= revocationRegistryDefinition.value.maxCredNum) {
    throw new Error(
      `Highest delta index '${Math.max(
        ...delta.issued,
        ...delta.revoked
      )}' is too large for the Revocation registry maxCredNum '${revocationRegistryDefinition.value.maxCredNum}' `
    )
  }

  // 0 means unrevoked, 1 means revoked
  const defaultState = isIssuanceByDefault ? RevocationState.Active : RevocationState.Revoked

  // Fill with default value
  const revocationList = new Array(revocationRegistryDefinition.value.maxCredNum).fill(defaultState)

  // Set all `issuer` indexes to 0 (not revoked)
  for (const issued of delta.issued ?? []) {
    revocationList[issued] = RevocationState.Active
  }

  // Set all `revoked` indexes to 1 (revoked)
  for (const revoked of delta.revoked ?? []) {
    revocationList[revoked] = RevocationState.Revoked
  }

  return {
    issuerId: revocationRegistryDefinition.issuerId,
    currentAccumulator: delta.accum,
    revRegDefId: revocationRegistryDefinitionId,
    revocationList,
    timestamp: delta.txnTime,
  }
}
