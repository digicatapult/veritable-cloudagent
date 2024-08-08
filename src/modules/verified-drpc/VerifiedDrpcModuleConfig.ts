import type { CreateProofRequestOptions, ProofProtocol } from '@credo-ts/core'

export interface VerifiedDrpcModuleConfigOptions<PPs extends ProofProtocol[]> {
  proofTimeoutMs?: number
  requestTimeoutMs?: number
  proofRequestOptions: CreateProofRequestOptions<PPs>
}

export class VerifiedDrpcModuleConfig<PPs extends ProofProtocol[]> {
  proofTimeoutMs: number
  requestTimeoutMs: number
  proofRequestOptions: CreateProofRequestOptions<PPs>

  public constructor(options: VerifiedDrpcModuleConfigOptions<PPs>) {
    this.proofTimeoutMs = options.proofTimeoutMs ?? 5000
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000
    this.proofRequestOptions = options.proofRequestOptions
  }
}
