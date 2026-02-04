/**
 * Presentation Exchange (PEX) and Input Descriptor types.
 */

/**
 * Recursive JSON-ish types for PEX DTOs.
 *
 * NOTE: These types are used in controller request/response DTOs, so TSOA must be able to
 * generate OpenAPI schemas for them. Importing Credo's PEX types is not currently viable
 * because Credo's PEX model types ultimately come from Sphereon (`@sphereon/pex-models`).
 * In this codebase, bringing those types into controller signatures has caused TSOA to:
 * - report duplicate model definitions (e.g., conflicting `PresentationDefinitionV2` models)
 * - emit diagnostics like "The type Object is discouraged" during schema generation
 *
 * To keep spec generation stable, we keep a TSOA-friendly, PEX-v2-shaped approximation here
 * and only bridge to Credo/Sphereon types at runtime boundaries.
 */
type PexJsonValue = string | number | boolean | null | PexJsonObject | PexJsonValue[]

interface PexJsonObject {
  [key: string]: PexJsonValue | undefined
}

/**
 * PEX v2 Input Descriptor typing.
 *
 * Keeps TSOA stable (no Sphereon imports) while retaining some structure and schema
 * for API consumers and generated clients.
 */
export interface InputDescriptorV2 {
  id: string
  name?: string
  purpose?: string
  group?: string[]
  constraints?: PexJsonObject
  format?: PexJsonObject
}

/**
 * TSOA-safe approximation of a PEX v2 Presentation Definition.
 *
 * We intentionally avoid importing Sphereon types here to prevent TSOA warnings/errors
 * (e.g., discouraged `Object` types and model-definition clashes).
 */
export interface PresentationDefinitionV2 {
  id: string
  input_descriptors: InputDescriptorV2[]
  name?: string
  purpose?: string
  format?: PexJsonObject
}

export interface PresentationExchangeCreateProposal {
  presentationDefinition: PresentationDefinitionV2
}

export interface PresentationExchangeAcceptProposal {
  options?: {
    challenge?: string
    domain?: string
  }
}

export interface PresentationExchangeCreateRequest {
  presentationDefinition: PresentationDefinitionV2
  options?: {
    challenge?: string
    domain?: string
  }
}

export interface PresentationExchangeAcceptRequest {
  credentials?: Record<string, unknown[]>
}

export interface DifPresentationExchangeProofFormat {
  formatKey: 'presentationExchange'
  proofFormats: {
    createProposal: PresentationExchangeCreateProposal
    acceptProposal: PresentationExchangeAcceptProposal
    createRequest: PresentationExchangeCreateRequest
    acceptRequest: PresentationExchangeAcceptRequest
    getCredentialsForRequest: { input: PexJsonObject; output: PexJsonObject }
    selectCredentialsForRequest: { input: PexJsonObject; output: PexJsonObject }
  }
  formatData: {
    proposal: PexJsonObject
    request: PexJsonObject
    presentation: PexJsonObject
  }
}
