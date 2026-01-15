import { RestAgent } from '../agent.js'
import { CredentialFormatData, GenericRecord } from '../controllers/types.js'

type GetCredentialFormatDataReturn = Awaited<ReturnType<RestAgent['credentials']['getFormatData']>>

export function transformToCredentialFormatData(formatData: GetCredentialFormatDataReturn): CredentialFormatData {
  const toGeneric = (obj: unknown): GenericRecord | undefined => {
    if (!obj) return undefined
    // Cast strict Credo types to GenericRecord (ApiJsonObject) to satisfy TSOA
    return obj as GenericRecord
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
