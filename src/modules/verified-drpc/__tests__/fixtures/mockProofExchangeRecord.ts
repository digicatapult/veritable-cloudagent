import { DidCommProofExchangeRecord, DidCommProofRole, DidCommProofState } from '@credo-ts/didcomm'

export const withMockProofExchangeRecord = (props: Partial<DidCommProofExchangeRecord>) => {
  return new DidCommProofExchangeRecord({
    id: props.id,
    createdAt: props.createdAt,
    protocolVersion: props.protocolVersion ?? '2.0',
    isVerified: props.isVerified,
    state: props.state ?? DidCommProofState.ProposalSent,
    role: props.role ?? DidCommProofRole.Prover,
    connectionId: props.connectionId,
    threadId: props.threadId ?? 'test-thread-id',
    parentThreadId: props.parentThreadId,
    autoAcceptProof: props.autoAcceptProof,
    errorMessage: props.errorMessage,
  })
}
