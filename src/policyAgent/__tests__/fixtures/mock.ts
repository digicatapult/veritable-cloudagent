import { before, after } from 'mocha'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, Dispatcher } from 'undici'

export const withGetPoliciesResponse = () => {
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
        result: [
          {
            id: 'example.rego',
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
          },
        ],
      })
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { origin }
}
