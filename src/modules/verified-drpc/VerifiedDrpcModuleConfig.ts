import type { CreateProofRequestOptions, DidCommProofProtocol } from '@credo-ts/didcomm'

export interface VerifiedDrpcModuleConfigOptions<PPs extends DidCommProofProtocol[]> {
  proofTimeoutMs?: number
  requestTimeoutMs?: number
  proofRequestOptions: CreateProofRequestOptions<PPs>
}

export class VerifiedDrpcModuleConfig<PPs extends DidCommProofProtocol[]> {
  proofTimeoutMs: number
  requestTimeoutMs: number
  proofRequestOptions: CreateProofRequestOptions<PPs>

  public constructor(options: VerifiedDrpcModuleConfigOptions<PPs>) {
    this.proofTimeoutMs = options.proofTimeoutMs ?? 5000
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000
    this.proofRequestOptions = options.proofRequestOptions
  }
}
