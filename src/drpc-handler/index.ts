import type { VerifiedDrpcRecord, VerifiedDrpcResponse } from '../modules/verified-drpc/index.js'

export const verifiedDrpcRequestHandler = async (request: VerifiedDrpcRecord): Promise<VerifiedDrpcResponse> => {
  return { jsonrpc: '2.0', result: { a: 123, b: 456 }, id: request.id }
}
