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
  DidCommCredentialV2Protocol,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommJsonLdCredentialFormat,
  DidCommJsonLdCredentialFormatService,
  DidCommProofV2Protocol,
} from '@credo-ts/didcomm'
import type { DifPresentationExchangeProofFormat } from './pex.js'

export type CredentialProtocols = [
  DidCommCredentialV2Protocol<[AnonCredsDidCommCredentialFormatService, DidCommJsonLdCredentialFormatService]>,
]
export type CredentialFormats = [AnonCredsDidCommCredentialFormat, DidCommJsonLdCredentialFormat]

export type ProofProtocols = [
  DidCommProofV2Protocol<[AnonCredsDidCommProofFormatService, DidCommDifPresentationExchangeProofFormatService]>,
]
export type ProofFormats = [AnonCredsDidCommProofFormat, DifPresentationExchangeProofFormat]
