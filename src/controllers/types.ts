import type {
  AnonCredsCredentialDefinition,
  AnonCredsCredentialFormat,
  AnonCredsCredentialFormatService,
  AnonCredsNonRevokedInterval,
  AnonCredsPredicateType,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
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
import type { DIDDocument } from 'did-resolver'

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
  didDocument: DIDDocument | null
  didDocumentMetadata: DidDocumentMetadata
}

export interface ProofRequestMessageResponse {
  message: string
  proofRecord: ProofExchangeRecord
}

type CredentialProtocols = [V2CredentialProtocol<[AnonCredsCredentialFormatService]>]
type CredentialFormats = [AnonCredsCredentialFormat]

type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat]

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
  credentialFormats: {
    [key in CredentialFormats[number] as key['formatKey']]?: CredentialFormats[number]['credentialFormats']['createProposal']
  }
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  connectionId: UUID
}

export interface AcceptCredentialProposalOptions {
  credentialFormats?: {
    [key in CredentialFormats[number] as key['formatKey']]?: CredentialFormats[number]['credentialFormats']['acceptProposal']
  }
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
        credentialId: string
        revealed: boolean
      }
    >
    predicates?: Record<
      string,
      {
        credentialId: string
      }
    >
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

export interface AnonCredsRequestedAttributeOptions {
  name?: string
  names?: string[]
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
  non_revoked?: AnonCredsNonRevokedInterval
}
export interface AnonCredsRequestedPredicateOptions {
  name: string
  p_type: AnonCredsPredicateType
  p_value: number
  restrictions?: AnonCredsProofRequestRestrictionOptions[]
  non_revoked?: AnonCredsNonRevokedInterval
}

export interface AnonCredsRequestProofFormatOptions {
  name: string
  version: Version
  non_revoked?: AnonCredsNonRevokedInterval
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
    [key in ProofFormats[number] as key['formatKey']]?: AnonCredsRequestProofFormatOptions
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
