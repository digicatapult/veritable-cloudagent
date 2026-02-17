import request from 'supertest'
import type { UUID } from '../../../src/controllers/types/index.js'

type WaitOptions = {
  maxAttempts?: number
  intervalMs?: number
}

export type TestClient = ReturnType<typeof request>

const DEFAULT_MAX_ATTEMPTS = 40
const DEFAULT_INTERVAL_MS = 1000

const getWaitOptions = (options?: WaitOptions) => ({
  maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  intervalMs: options?.intervalMs ?? DEFAULT_INTERVAL_MS,
})

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitForConnectionByOob = async (client: TestClient, oobRecordId: UUID, options?: WaitOptions) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)

  for (let i = 0; i < maxAttempts; i++) {
    const response = await client.get('/v1/connections').query({ outOfBandId: oobRecordId }).expect(200)
    if (response.body.length > 0 && response.body[0].id) {
      return response.body[0].id as UUID
    }
    await sleep(intervalMs)
  }

  throw new Error('Timed out waiting for connection')
}

export const waitForConnectionState = async (
  client: TestClient,
  connectionId: UUID,
  expectedStates: string[] | string,
  options?: WaitOptions
) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)
  const states = Array.isArray(expectedStates) ? expectedStates : [expectedStates]

  for (let i = 0; i < maxAttempts; i++) {
    const response = await client.get(`/v1/connections/${connectionId}`).expect(200)
    if (states.includes(response.body.state)) return response.body.state as string
    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for connection state ${states.join(', ')}`)
}

export const waitForCredentialRecord = async (
  client: TestClient,
  connectionId: UUID,
  state?: string,
  options?: WaitOptions
) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)

  for (let i = 0; i < maxAttempts; i++) {
    const query = state ? { connectionId, state } : { connectionId }
    const response = await client.get('/v1/credentials').query(query).expect(200)
    const records = response.body as { id: UUID; state?: string }[]

    if (records.length > 0) {
      // When state is provided, the API should already have filtered by state.
      // Keep a defensive check to avoid changing behavior if that assumption changes.
      if (!state || records[0].state === state) {
        return records[0]
      }
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for credential record${state ? ` in state ${state}` : ''}`)
}

export const waitForCredentialState = async (
  client: TestClient,
  credentialId: UUID,
  expectedStates: string[] | string,
  options?: WaitOptions
) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)
  const states = Array.isArray(expectedStates) ? expectedStates : [expectedStates]

  for (let i = 0; i < maxAttempts; i++) {
    const response = await client.get(`/v1/credentials/${credentialId}`).expect(200)
    if (states.includes(response.body.state)) return response.body.state as string
    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for credential state ${states.join(', ')}`)
}

export const waitForProofRecordByThread = async (
  client: TestClient,
  threadId: UUID,
  state?: string,
  options?: WaitOptions
) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)

  for (let i = 0; i < maxAttempts; i++) {
    const response = await client.get('/v1/proofs').query({ threadId }).expect(200)
    const records = response.body as { id: UUID; state?: string; threadId?: string }[]

    if (records.length > 0) {
      if (!state) return records[0]

      const record = records.find((r) => r.state === state)
      if (record) return record
    }

    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for proof record${state ? ` in state ${state}` : ''}`)
}

export const waitForProofState = async (
  client: TestClient,
  proofId: UUID,
  expectedStates: string[] | string,
  options?: WaitOptions
) => {
  const { maxAttempts, intervalMs } = getWaitOptions(options)
  const states = Array.isArray(expectedStates) ? expectedStates : [expectedStates]

  for (let i = 0; i < maxAttempts; i++) {
    const response = await client.get(`/v1/proofs/${proofId}`).expect(200)
    if (states.includes(response.body.state)) return response.body.state as string
    await sleep(intervalMs)
  }

  throw new Error(`Timed out waiting for proof state ${states.join(', ')}`)
}
