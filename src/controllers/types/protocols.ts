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
  DidCommDifPresentationExchangeProofFormatService as DifPresentationExchangeProofFormatService,
  DidCommJsonLdCredentialFormat as JsonLdCredentialFormat,
  DidCommJsonLdCredentialFormatService as JsonLdCredentialFormatService,
  DidCommCredentialV2Protocol as V2CredentialProtocol,
  DidCommProofV2Protocol as V2ProofProtocol,
} from '@credo-ts/didcomm'
import type { DifPresentationExchangeProofFormat } from './pex.js'

export type CredentialProtocols = [
  V2CredentialProtocol<[AnonCredsCredentialFormatService, JsonLdCredentialFormatService]>,
]
export type CredentialFormats = [AnonCredsCredentialFormat, JsonLdCredentialFormat]

export type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService, DifPresentationExchangeProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat, DifPresentationExchangeProofFormat]
