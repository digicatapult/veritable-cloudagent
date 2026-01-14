/**
 * W3C Verifiable Credential and JSON-LD credential format types.
 */
import type { ApiJsonObject, ApiJsonValue, GenericRecord } from './common'

export interface W3cCredential extends ApiJsonObject {
  '@context': string[] | GenericRecord
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
