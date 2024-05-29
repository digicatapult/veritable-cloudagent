import { VerifiedDrpcRecord } from '../../repository/VerifiedDrpcRecord.js'
import { VerifiedDrpcRole, VerifiedDrpcState } from '../../models/index.js'

export const withMockVerifiedDrpcRecord = (props: Partial<VerifiedDrpcRecord>) => {
  return new VerifiedDrpcRecord({
    id: props.id ?? 'test-verified-drpc-id',
    request: props.request,
    response: props.response,
    connectionId: props.connectionId ?? 'test-connection-id',
    role: props.role ?? VerifiedDrpcRole.Client,
    state: props.state ?? VerifiedDrpcState.ServerProofRequestSent,
    threadId: props.threadId ?? 'test-thread-id',
  })
}
