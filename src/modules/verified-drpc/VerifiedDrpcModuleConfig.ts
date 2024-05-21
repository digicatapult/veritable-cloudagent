import type { CreateProofRequestOptions, ProofProtocol } from '@credo-ts/core'
//import type { ProofProtocols } from './types.js'

export interface VerifiedDrpcModuleConfigOptions {
  proofTimeoutMs?: number
  requestTimeoutMs?: number
  proofRequestOptions: CreateProofRequestOptions<ProofProtocol[]>
}

export class VerifiedDrpcModuleConfig {
  proofTimeoutMs: number
  requestTimeoutMs: number
  proofRequestOptions: CreateProofRequestOptions<ProofProtocol[]>

  public constructor(options: VerifiedDrpcModuleConfigOptions) {
    this.proofTimeoutMs = options.proofTimeoutMs ?? 5000
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000
    this.proofRequestOptions = options.proofRequestOptions
  }
}
