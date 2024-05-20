import {
  ProofProtocol,
  V2ProofProtocol
} from '@credo-ts/core'
import type { AnonCredsProofFormatService } from '@credo-ts/anoncreds'

export type ProofProtocols = [V2ProofProtocol<[AnonCredsProofFormatService]>]
