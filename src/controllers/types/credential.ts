import type { AutoAcceptCredential, CredentialFormatPayload, CredentialProtocolVersionType } from '@credo-ts/core'
import type { UUID } from './common'
import type { CredentialFormats, CredentialProtocols } from './protocols'

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
