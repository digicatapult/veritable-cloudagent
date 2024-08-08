import { after, before } from 'mocha'
import { Dispatcher, getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'

import { Env } from '../../../env.js'

const examplePolicy = (id: string) => ({
  id,
  raw: 'package example',
  ast: {
    package: {
      path: [
        {
          type: 'var',
          value: 'data',
        },
        {
          type: 'string',
          value: 'example',
        },
      ],
    },
  },
})

export const mockEnv = (origin: string): Env => {
  return {
    get: (name: string) => {
      if (name !== 'OPA_ORIGIN') {
        throw new Error('env value not provided')
      }
      return origin
    },
  } as Env
}

export const withGetPoliciesResponse = (id: string) => {
  const origin = `http://policy-agent`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockPolicyAgent = mockAgent.get(origin)

    mockPolicyAgent
      .intercept({
        path: `/v1/policies`,
        method: 'GET',
      })
      .reply(200, {
        result: [examplePolicy(id)],
      })
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { origin }
}

export const withGetPolicyResponse = (id: string) => {
  const origin = `http://policy-agent`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockPolicyAgent = mockAgent.get(origin)

    mockPolicyAgent
      .intercept({
        path: `/v1/policies/${id}`,
        method: 'GET',
      })
      .reply(200, {
        result: examplePolicy(id),
      })
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { origin }
}

export const withEvaluateResponse = (packageId: string) => {
  const origin = `http://policy-agent`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockPolicyAgent = mockAgent.get(origin)

    mockPolicyAgent
      .intercept({
        path: `/v1/data/${packageId}`,
        method: 'POST',
      })
      .reply(200, {
        result: { allow: true },
      })
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { origin }
}
