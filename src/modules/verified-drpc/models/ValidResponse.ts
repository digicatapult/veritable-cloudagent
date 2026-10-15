import { z } from 'zod'

import type { VerifiedDrpcResponse } from '../messages/VerifiedDrpcResponseMessage.js'

const jsonValueSchema: z.ZodType<unknown> = z.json()
const responseBaseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
})

const resultResponseSchema = responseBaseSchema
  .extend({ result: jsonValueSchema })
  .loose()
  .refine((response) => !('error' in response), {
    message: 'A JSON-RPC response cannot contain both result and error',
  })

const errorResponseSchema = responseBaseSchema
  .extend({
    error: z
      .object({
        code: z.number().int(),
        message: z.string(),
        data: jsonValueSchema.optional(),
      })
      .loose(),
  })
  .loose()
  .refine((response) => !('result' in response), {
    message: 'A JSON-RPC response cannot contain both result and error',
  })

export const verifiedDrpcResponseSchema = z.union([resultResponseSchema, errorResponseSchema])

export function isValidVerifiedDrpcResponse(value: unknown): value is VerifiedDrpcResponse {
  return verifiedDrpcResponseSchema.safeParse(value).success
}

export type { VerifiedDrpcResponse }
