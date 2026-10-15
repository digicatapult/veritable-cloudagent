import { z } from 'zod'

import type { VerifiedDrpcRequest } from '../messages/VerifiedDrpcRequestMessage.js'

const jsonValueSchema: z.ZodType<unknown> = z.json()
export const verifiedDrpcRequestSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.union([z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]).optional(),
    id: z.union([z.string(), z.number(), z.null()]),
  })
  .loose()
  .refine((request) => !('params' in request) || request.params !== undefined, {
    message: 'Request params must be omitted or contain a JSON value',
  })

export function isValidVerifiedDrpcRequest(value: unknown): value is VerifiedDrpcRequest {
  return verifiedDrpcRequestSchema.safeParse(value).success
}

export type { VerifiedDrpcRequest }
