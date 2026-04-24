import { after, before } from 'mocha'
import { Dispatcher, getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'

type IpfsMockResponse = {
  code: number
  body?: string | object | Buffer
  delayMs?: number
}

export const withIpfsCatResponse = (responses: ({ cid: string } & IpfsMockResponse)[]) => {
  const ipfsOrigin = `http://ipfs`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://ipfs`)

    for (const { cid, code, body, delayMs } of responses) {
      const scope = mockIpfs
        .intercept({
          path: `/api/v0/cat?arg=${cid}`,
          method: 'POST',
        })
        .reply(code, body ?? '')

      if (delayMs !== undefined) {
        scope.delay(delayMs)
      }
    }
  })

  after(async function () {
    try {
      mockAgent.assertNoPendingInterceptors()
    } finally {
      setGlobalDispatcher(originalDispatcher)
      await mockAgent.close()
    }
  })

  return { ipfsOrigin }
}
export const withIpfsAddResponse = (responses: ({ cid: unknown } & IpfsMockResponse)[]) => {
  const ipfsOrigin = `http://ipfs`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://ipfs`)

    for (const { code, cid, body, delayMs } of responses) {
      const scope = mockIpfs
        .intercept({
          path: '/api/v0/add?cid-version=1',
          method: 'POST',
          body: (calledBody) => {
            // ugly hack as undici mock doesn't allow mocking of Buffer bodies only strings
            const asBuf = calledBody as unknown as FormData
            const asArr = [...asBuf.entries()]
            return asArr.length === 1 && asArr[0][0] === 'file'
          },
        })
        .reply(code, body ?? { Hash: cid })

      if (delayMs !== undefined) {
        scope.delay(delayMs)
      }
    }
  })

  after(async function () {
    try {
      mockAgent.assertNoPendingInterceptors()
    } finally {
      setGlobalDispatcher(originalDispatcher)
      await mockAgent.close()
    }
  })

  return { ipfsOrigin }
}
