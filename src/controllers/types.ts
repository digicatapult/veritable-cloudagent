import type {
  AnonCredsCredentialDefinition,
  AnonCredsCredentialFormat,
  AnonCredsCredentialFormatService,
  AnonCredsProof,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicate,
  AnonCredsRequestedPredicateMatch,
  AnonCredsRequestProofFormat,
  AnonCredsSchema,
} from '@credo-ts/anoncreds'

import type {
  AutoAcceptCredential,
  AutoAcceptProof,
  CredentialFormatPayload,
  CredentialProtocolVersionType,
  DidDocument,
  DidDocumentMetadata,
  DidResolutionMetadata,
  HandshakeProtocol,
  KeyType,
  OutOfBandDidCommService,
  ProofExchangeRecord,
  ProofFormatPayload,
  ProofsProtocolVersionType,
  ReceiveOutOfBandInvitationConfig,
  V2CredentialProtocol,
  V2ProofProtocol,
} from '@credo-ts/core'

/**
 * Recursive JSON types for TSOA compatibility.
 * Defined locally to avoid TSOA errors with imported specific types.
 *
 * NOTE: The extensive type and interface definitions in this file (specifically explicitly
 * recursive types like ApiJsonObject) are required to satisfy TSOA's schema generation.
 * TSOA struggles with generic 'Record<string, any>' or complex union types imported
 * from @credo-ts/core, often throwing 'Index Type' or 'Reference' errors during spec generation.
 * By defining strict, self-contained recursive structures here, we ensure Swagger/OpenAPI
 * specs are generated correctly.
 */
export type ApiJsonValue = string | number | boolean | null | ApiJsonObject | ApiJsonArray | undefined
export type ApiJsonArray = Array<ApiJsonValue>
export interface ApiJsonObject {
  [key: string]: ApiJsonValue
}

export type GenericRecord = ApiJsonObject

// --- W3C / JSON-LD Types ---

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

// --- Presentation Exchange Types ---

export interface PexSchema extends ApiJsonObject {
  uri: string
}

export interface InputDescriptorV1 extends ApiJsonObject {
  id: string
  schema: PexSchema[]
  name?: string
  purpose?: string
  group?: string[]
}

export interface PresentationDefinitionV1 extends ApiJsonObject {
  id: string
  input_descriptors: InputDescriptorV1[]
  name?: string
  purpose?: string
  format?: GenericRecord
}

export interface PresentationExchangeCreateProposal {
  presentationDefinition: PresentationDefinitionV1
}

export interface PresentationExchangeAcceptProposal {
  options?: {
    challenge?: string
    domain?: string
  }
}

export interface PresentationExchangeCreateRequest {
  presentationDefinition: PresentationDefinitionV1
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

/**
 * Stringified UUIDv4.
 * @pattern [0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}
 * @example "52907745-7672-470e-a803-a2f8feb52944"
 */
export type UUID = string

// Media Sharing
export interface MediaItemRequest {
  uri: string
  mimeType: string
  description?: string
  byteCount?: number
  fileName?: string
  metadata?: Record<string, unknown>
}

export interface CredentialAttribute {
  name: string
  value: string
  mimeType?: string
}

export interface CredentialFormatData {
  proposalAttributes?: CredentialAttribute[]
  offerAttributes?: CredentialAttribute[]
  requestAttributes?: CredentialAttribute[]
  proposal?: Record<string, unknown>
  offer?: Record<string, unknown>
  request?: Record<string, unknown>
  credential?: Record<string, unknown>
}

export interface MediaShareRequest {
  connectionId: UUID
  description?: string
  metadata?: Record<string, unknown>
  items?: MediaItemRequest[]
}

/**
 * W3C Decentralized Identifier format v1.0
 * @pattern did:[A-Za-z0-9:]+
 * @example "did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL"
 */
export type DID = string

/**
 * @example "1.0.0"
 */
export type Version = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:3:CL:20:tag"
 */
export type CredentialDefinitionId = string

/**
 * @example "WgWxqztrNooG92RXvxSTWv:2:schema_name:1.0"
 */
export type SchemaId = string

export interface AgentInfo {
  label: string
  endpoints: string[]
  isInitialized: boolean
}

export interface AgentMessageType {
  '@id': UUID
  '@type': string
  [key: string]: unknown
}

export interface DidResolutionResultProps {
  didResolutionMetadata: DidResolutionMetadata
  didDocument: DidDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

export interface ProofRequestMessageResponse {
  message: string
  proofRecord: ProofExchangeRecord
}

type CredentialProtocols = [V2CredentialProtocol<[AnonCredsCredentialFormatService]>]
type CredentialFormats = [AnonCredsCredentialFormat, JsonLdCredentialFormat]

type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat, DifPresentationExchangeProofFormat]

interface PrivateKey {
  keyType: KeyType
  privateKey: string
}

export interface ImportDidOptions {
  did: DID
  didDocument?: DidDocument
  privateKeys?: PrivateKey[]
  overwrite?: boolean
}

export interface DidCreateOptions {
  method?: string
  did?: DID
  options?: { [x: string]: unknown }
  secret?: { [x: string]: unknown }
  didDocument?: DidDocument
}

export interface DidOperationStateFinished {
  state: 'finished'
  did: DID
  secret?: { [x: string]: unknown }
  didDocument: { [x: string]: unknown }
}
export interface DidOperationStateFailed {
  state: 'failed'
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
  reason: string
}
export interface DidOperationStateWait {
  state: 'wait'
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
}
export interface DidOperationStateActionBase {
  state: 'action'
  action: string
  did?: DID
  secret?: { [x: string]: unknown }
  didDocument?: { [x: string]: unknown }
}

export type DidCreateResult = DidOperationStateWait | DidOperationStateActionBase | DidOperationStateFinished

export interface ProposeCredentialOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: CredentialFormatPayload<CredentialFormats, 'createProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  connectionId: UUID
}

export interface AcceptCredentialProposalOptions {
  credentialFormats?: CredentialFormatPayload<CredentialFormats, 'acceptProposal'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface CreateOfferOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: CredentialFormatPayload<CredentialFormats, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface OfferCredentialOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: CredentialFormatPayload<CredentialFormats, 'createOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  connectionId: UUID
}

export interface AcceptCredentialOfferOptions {
  credentialFormats?: CredentialFormatPayload<CredentialFormats, 'acceptOffer'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface AcceptCredentialRequestOptions {
  credentialFormats?: CredentialFormatPayload<CredentialFormats, 'acceptRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

type ReceiveOutOfBandInvitationProps = Omit<ReceiveOutOfBandInvitationConfig, 'routing'>

export interface ReceiveInvitationProps extends ReceiveOutOfBandInvitationProps {
  invitation: Omit<OutOfBandInvitationSchema, 'appendedAttachments'>
}

export interface ReceiveInvitationByUrlProps extends ReceiveOutOfBandInvitationProps {
  invitationUrl: string
}

export interface AcceptInvitationConfig {
  autoAcceptConnection?: boolean
  reuseConnection?: boolean
  label?: string
  alias?: string
  imageUrl?: string
  mediatorId?: string
}

export interface OutOfBandInvitationSchema {
  '@id'?: UUID
  '@type': string
  label: string
  goalCode?: string
  goal?: string
  accept?: string[]
  handshake_protocols?: HandshakeProtocol[]
  services: Array<OutOfBandDidCommService | string>
  imageUrl?: string
}

export interface ConnectionInvitationSchema {
  id?: UUID
  '@type': string
  label: string
  did?: DID
  recipientKeys?: string[]
  serviceEndpoint?: string
  routingKeys?: string[]
  imageUrl?: string
}

export interface ProposeProofOptions {
  connectionId: UUID
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: ProofFormatPayload<ProofFormats, 'createProposal'>
  goalCode?: string
  parentThreadId?: UUID
  autoAcceptProof?: AutoAcceptProof
  comment?: string
}

export interface AcceptProofProposalOptions {
  proofFormats?: {
    anoncreds?: AnonCredsRequestProofFormatOptions
  }
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: AutoAcceptProof
  comment?: string
}

export interface SimpleProofFormats {
  anoncreds?: {
    attributes?: Record<
      string,
      {
        /**
         * The ID of the credential to use for this attribute.
         * NOTE: This object must contain EXACTLY 'credentialId' and 'revealed' keys.
         * Additional properties are not allowed and will cause validation failure.
         *
         * TO EXTEND: If adding new properties, you MUST update the validation logic
         * in `src/utils/proofs.ts` (isSimpleProofFormats method) to accept the new key count.
         */
        credentialId: string
        /**
         * Whether to reveal the attribute value.
         */
        revealed: boolean
      }
    >
    predicates?: Record<
      string,
      {
        /**
         * The ID of the credential to use for this predicate.
         * NOTE: This object must contain EXACTLY 'credentialId' key.
         * Additional properties are not allowed and will cause validation failure.
         *
         * TO EXTEND: If adding new properties, you MUST update the validation logic
         * in `src/utils/proofs.ts` (isSimpleProofFormats method) to accept the new key count.
         */
        credentialId: string
      }
    >
  }
}

export interface MatchingCredentialsResponse {
  proofFormats: {
    anoncreds?: {
      attributes?: Record<string, AnonCredsRequestedAttributeMatch[]>
      predicates?: Record<string, AnonCredsRequestedPredicateMatch[]>
    }
  }
}

export interface AcceptProofRequestOptions {
  useReturnRoute?: boolean
  goalCode?: string
  willConfirm?: boolean
  autoAcceptProof?: AutoAcceptProof
  comment?: string
  proofFormats?: ProofFormatPayload<ProofFormats, 'acceptRequest'> | SimpleProofFormats
}

export interface AnonCredsProofRequestRestrictionOptions {
  schema_id?: SchemaId
  schema_issuer_id?: DID
  schema_name?: string
  schema_version?: Version
  issuer_id?: DID
  cred_def_id?: CredentialDefinitionId
  rev_reg_id?: string
  schema_issuer_did?: DID
  issuer_did?: DID
  attributeValues?: {
    [key: string]: string
  }
  attributeMarkers?: {
    [key: string]: boolean
  }
}

/**
 * Extends upstream type but overrides `restrictions` to use our API-friendly `AnonCredsProofRequestRestrictionOptions`.
 */
export interface AnonCredsRequestedAttributeOptions extends Omit<AnonCredsRequestedAttribute, 'restrictions'> {
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
}

/**
 * Extends upstream type but overrides `restrictions` to use our API-friendly `AnonCredsProofRequestRestrictionOptions`.
 */
export interface AnonCredsRequestedPredicateOptions extends Omit<AnonCredsRequestedPredicate, 'restrictions'> {
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
}

/**
 * Extends upstream type but overrides attributes/predicates to use our API-friendly Options types.
 */
export interface AnonCredsRequestProofFormatOptions extends Omit<
  AnonCredsRequestProofFormat,
  'requested_attributes' | 'requested_predicates'
> {
  requested_attributes?: {
    [key: string]: AnonCredsRequestedAttributeOptions
  }
  requested_predicates?: {
    [key: string]: AnonCredsRequestedPredicateOptions
  }
}

export interface CreateProofRequestOptions {
  protocolVersion: ProofsProtocolVersionType<ProofProtocols>
  proofFormats: {
    anoncreds?: AnonCredsRequestProofFormatOptions
    presentationExchange?: PresentationExchangeCreateRequest
  }
  goalCode?: string
  parentThreadId?: UUID
  willConfirm?: boolean
  autoAcceptProof?: AutoAcceptProof
  comment?: string
}

export interface RequestProofOptions extends CreateProofRequestOptions {
  connectionId: UUID
}

export interface AnonCredsSchemaResponse extends AnonCredsSchema {
  id: UUID
}

export interface AnonCredsCredentialDefinitionResponse extends AnonCredsCredentialDefinition {
  id: UUID
}

/**
 * Extend the upstream type but narrow the 'proof' property for better DX.
 * The upstream `AnonCredsProof` defines `proof` as `any`, so we override it here
 * with a strict structure to help API consumers.
 */
export interface AnonCredsPresentation extends Omit<AnonCredsProof, 'proof'> {
  proof: {
    proofs: Record<string, unknown>
    aggregated_proof: {
      c_hash: string
      c_list: number[][]
    }
  }
}
