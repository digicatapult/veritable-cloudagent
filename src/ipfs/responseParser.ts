import zod from 'zod'

export const addResponseParser = zod.object({
  Hash: zod.string(),
})
