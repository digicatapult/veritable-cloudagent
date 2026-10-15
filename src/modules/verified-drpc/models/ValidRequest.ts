import { z } from 'zod'

import type { VerifiedDrpcRequestObject } from '../messages/VerifiedDrpcRequestMessage.js'

const jsonValueSchema: z.ZodType<unknown> = z.json()
const requestObjectSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    method: z.string(),
    params: z.union([z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]).optional(),
    id: z.union([z.string(), z.number(), z.null()]),
  })
  .passthrough()
  .refine((request) => !('params' in request) || request.params !== undefined, {
    message: 'Request params must be omitted or contain a JSON value',
  })

export const verifiedDrpcRequestSchema = z.union([requestObjectSchema, z.array(requestObjectSchema).min(1)])

export function isValidVerifiedDrpcRequest(value: unknown): value is VerifiedDrpcRequestObject {
  return requestObjectSchema.safeParse(value).success
}

export type { VerifiedDrpcRequestObject }
