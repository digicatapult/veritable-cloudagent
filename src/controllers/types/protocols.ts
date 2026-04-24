/**
 * Credential and Proof protocol version definitions.
 */
import type {
  AnonCredsCredentialFormat,
  AnonCredsCredentialFormatService,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
} from '@credo-ts/anoncreds'
import type {
  DifPresentationExchangeProofFormatService,
  JsonLdCredentialFormat,
  JsonLdCredentialFormatService,
  V2CredentialProtocol,
  V2ProofProtocol,
} from '@credo-ts/core'
import type { DifPresentationExchangeProofFormat } from './pex.js'

export type CredentialProtocols = [
  V2CredentialProtocol<[AnonCredsCredentialFormatService, JsonLdCredentialFormatService]>,
]
export type CredentialFormats = [AnonCredsCredentialFormat, JsonLdCredentialFormat]

export type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService, DifPresentationExchangeProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat, DifPresentationExchangeProofFormat]
