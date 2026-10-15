import { z } from 'zod'

import type { VerifiedDrpcResponse, VerifiedDrpcResponseObject } from '../messages/VerifiedDrpcResponseMessage.js'

export const verifiedDrpcResponseSchema = z.custom<VerifiedDrpcResponse>((value) =>
  Array.isArray(value)
    ? value.length > 0 && value.every(isValidVerifiedDrpcResponse)
    : isValidVerifiedDrpcResponse(value)
)

export function isValidVerifiedDrpcResponse(
  value: unknown
): value is VerifiedDrpcResponseObject | Record<string, never> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (Object.keys(value).length === 0) {
    return true
  }

  if (Array.isArray(value)) {
    return false
  }

  if (!('jsonrpc' in value) || value.jsonrpc !== '2.0' || !('id' in value)) {
    return false
  }

  if ('result' in value && typeof value.result === 'undefined') {
    return false
  }

  if ('error' in value && !isValidVerifiedDrpcResponseError(value.error)) {
    return false
  }

  return true
}

function isValidVerifiedDrpcResponseError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}
