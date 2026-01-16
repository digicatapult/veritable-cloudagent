/**
 * Presentation Exchange (PEX) and Input Descriptor types.
 */
import type { ApiJsonArray, ApiJsonObject, GenericRecord } from './common'

// --- Presentation Exchange Types ---

export interface PexField extends ApiJsonObject {
  path: string[]
  id?: string
  purpose?: string
  name?: string
  filter?: ApiJsonObject
  predicate?: 'required' | 'preferred'
}

export interface PexConstraints extends ApiJsonObject {
  fields?: PexField[]
  limit_disclosure?: 'required' | 'preferred'
}

export interface InputDescriptorV2 extends ApiJsonObject {
  id: string
  name?: string
  purpose?: string
  group?: string[]
  constraints?: PexConstraints
}

export interface PresentationDefinitionV2 extends ApiJsonObject {
  id: string
  input_descriptors: InputDescriptorV2[]
  name?: string
  purpose?: string
  format?: GenericRecord
  submission_requirements?: ApiJsonArray
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
    getCredentialsForRequest: { input: GenericRecord; output: GenericRecord }
    selectCredentialsForRequest: { input: GenericRecord; output: GenericRecord }
  }
  formatData: {
    proposal: GenericRecord
    request: GenericRecord
    presentation: GenericRecord
  }
}
