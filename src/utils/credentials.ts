import type { GetCredentialFormatDataReturn } from '@credo-ts/core'

import type { CredentialFormatData, CredentialFormats } from '../controllers/types/index.js'

export function transformToCredentialFormatData(
  formatData: GetCredentialFormatDataReturn<CredentialFormats>
): CredentialFormatData {
  const toGeneric = (obj: unknown): Record<string, unknown> | undefined => {
    if (!obj) return undefined
    // Cast strict Credo types to a JSON-ish object for controller DTOs
    return obj as Record<string, unknown>
  }

  return {
    proposalAttributes: formatData.proposalAttributes,
    offerAttributes: formatData.offerAttributes,
    proposal: toGeneric(formatData.proposal),
    offer: toGeneric(formatData.offer),
    request: toGeneric(formatData.request),
    credential: toGeneric(formatData.credential),
  }
}
