import { ProofExchangeRecord, ProofState, ProofRole } from '@credo-ts/core'

export const withMockProofExchangeRecord = (props: Partial<ProofExchangeRecord>) => {
  return new ProofExchangeRecord({
    id: props.id,
    createdAt: props.createdAt,
    protocolVersion: props.protocolVersion ?? '2.0',
    isVerified: props.isVerified,
    state: props.state ?? ProofState.ProposalSent,
    role: props.role ?? ProofRole.Prover,
    connectionId: props.connectionId,
    threadId: props.threadId ?? 'test-thread-id',
    parentThreadId: props.parentThreadId,
    autoAcceptProof: props.autoAcceptProof,
    errorMessage: props.errorMessage,
  })
}
