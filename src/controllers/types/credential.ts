/**
 * Credential Issuance (Proposal, Offer, Request) types.
 */
import type {
  CredentialProtocolVersionType,
  DidCommAutoAcceptCredential,
  DidCommCredentialFormatPayload,
  DidCommCredentialPreviewAttributeOptions,
} from '@credo-ts/didcomm'
import type { UUID } from './common.js'
import type { CredentialFormats, CredentialProtocols } from './protocols.js'

export interface CredentialFormatData {
  proposalAttributes?: DidCommCredentialPreviewAttributeOptions[]
  offerAttributes?: DidCommCredentialPreviewAttributeOptions[]
  requestAttributes?: DidCommCredentialPreviewAttributeOptions[]
  proposal?: Record<string, unknown>
  offer?: Record<string, unknown>
  request?: Record<string, unknown>
  credential?: Record<string, unknown>
}

export interface ProposeCredentialOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormats, 'createProposal'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
  connectionId: UUID
}

export interface AcceptCredentialProposalOptions {
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormats, 'acceptProposal'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
}

export interface CreateOfferOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormats, 'createOffer'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
}

export interface OfferCredentialOptions {
  protocolVersion: CredentialProtocolVersionType<CredentialProtocols>
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormats, 'createOffer'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
  connectionId: UUID
}

export interface AcceptCredentialOfferOptions {
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormats, 'acceptOffer'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
}

export interface AcceptCredentialRequestOptions {
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormats, 'acceptRequest'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
}
