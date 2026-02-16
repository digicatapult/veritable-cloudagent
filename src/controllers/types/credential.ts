/**
 * Credential Issuance (Proposal, Offer, Request) types.
 */
import type {
  AutoAcceptCredential,
  CredentialFormatPayload,
  CredentialPreviewAttributeOptions,
  CredentialProtocolVersionType,
} from '@credo-ts/core'
import type { UUID } from './common.js'
import type { CredentialFormats, CredentialProtocols } from './protocols.js'

export type CredentialAttribute = CredentialPreviewAttributeOptions

export interface CredentialFormatData {
  proposalAttributes?: CredentialAttribute[]
  offerAttributes?: CredentialAttribute[]
  requestAttributes?: CredentialAttribute[]
  proposal?: Record<string, unknown>
  offer?: Record<string, unknown>
  request?: Record<string, unknown>
  credential?: Record<string, unknown>
}

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
