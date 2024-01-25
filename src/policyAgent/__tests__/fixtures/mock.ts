import { before, after } from 'mocha'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, Dispatcher } from 'undici'

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

export const withEvaluateResponse = (packageId: string, success: boolean) => {
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
        result: { allow: success },
      })
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { origin }
}
