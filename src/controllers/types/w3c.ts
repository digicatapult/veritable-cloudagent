/**
 * W3C Verifiable Credential and JSON-LD credential format types.
 */
import type { ApiJsonObject, ApiJsonValue, GenericRecord } from './common'

/**
 * enforce the first element is a string
 * Note: TSOA 6.x doesn't support variadic tuples ([string, ...rest[]]) so we fallback to array
 * TODO: Revisit when TSOA 7.x is released which supports variadic tuples
 */
export type JsonLdContext = (string | GenericRecord)[]

export interface W3cCredential extends ApiJsonObject {
  '@context': JsonLdContext
  id?: string
  type: string[]
  issuer: string | { id: string; [key: string]: ApiJsonValue }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: GenericRecord | GenericRecord[]
  proof?: GenericRecord
}

export interface JsonLdCredentialDetailFormat {
  credential: W3cCredential
  options: {
    proofPurpose: string
    proofType: string
    created?: string
    domain?: string
    challenge?: string
  }
}

export interface JsonLdAcceptRequestFormat {
  verificationMethod?: string
}

export interface JsonLdCredentialFormat {
  formatKey: 'jsonld'
  credentialRecordType: 'w3c'
  credentialFormats: {
    createProposal: JsonLdCredentialDetailFormat
    // TSOA friendly empty object replacement
    acceptProposal: Record<string, never>
    createOffer: JsonLdCredentialDetailFormat
    acceptOffer: Record<string, never>
    createRequest: JsonLdCredentialDetailFormat
    acceptRequest: JsonLdAcceptRequestFormat
  }
  formatData: {
    proposal: GenericRecord
    offer: GenericRecord
    request: GenericRecord
    credential: GenericRecord
  }
}
