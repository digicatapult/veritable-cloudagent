/**
 * Credential and Proof protocol version definitions.
 */
import type {
  AnonCredsDidCommCredentialFormat,
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormat,
  AnonCredsDidCommProofFormatService,
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
  V2CredentialProtocol<[AnonCredsDidCommCredentialFormatService, JsonLdCredentialFormatService]>,
]
export type CredentialFormats = [AnonCredsDidCommCredentialFormat, JsonLdCredentialFormat]

export type ProofProtocols = [
  V2ProofProtocol<[AnonCredsDidCommProofFormatService, DifPresentationExchangeProofFormatService]>,
]
export type ProofFormats = [AnonCredsDidCommProofFormat, DifPresentationExchangeProofFormat]
