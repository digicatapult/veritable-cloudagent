import { z } from 'zod'

import type { VerifiedDrpcRequest, VerifiedDrpcRequestObject } from '../messages/VerifiedDrpcRequestMessage.js'

export const verifiedDrpcRequestSchema = z.custom<VerifiedDrpcRequest>((value) =>
  Array.isArray(value) ? value.every(isValidVerifiedDrpcRequest) : isValidVerifiedDrpcRequest(value)
)

export function isValidVerifiedDrpcRequest(value: unknown): value is VerifiedDrpcRequestObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  return 'jsonrpc' in value && value.jsonrpc === '2.0' && 'method' in value && 'id' in value
}
