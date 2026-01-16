/**
 * Credential and Proof protocol version definitions.
 */
import type {
  AnonCredsCredentialFormat,
  AnonCredsCredentialFormatService,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
} from '@credo-ts/anoncreds'
import type { V2CredentialProtocol, V2ProofProtocol } from '@credo-ts/core'
import type { DifPresentationExchangeProofFormat } from './pex'
import type { JsonLdCredentialFormat } from './w3c'

export type CredentialProtocols = [V2CredentialProtocol<[AnonCredsCredentialFormatService]>]
export type CredentialFormats = [AnonCredsCredentialFormat, JsonLdCredentialFormat]

export type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat, DifPresentationExchangeProofFormat]
