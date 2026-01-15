import type {
  AnonCredsCredentialFormat,
  AnonCredsCredentialFormatService,
  AnonCredsProofFormat,
  AnonCredsProofFormatService,
} from '@credo-ts/anoncreds'
import type { V2CredentialProtocol, V2ProofProtocol } from '@credo-ts/core'

export type CredentialProtocols = [V2CredentialProtocol<[AnonCredsCredentialFormatService]>]
export type CredentialFormats = [AnonCredsCredentialFormat]

export type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService]>]
export type ProofFormats = [AnonCredsProofFormat]
