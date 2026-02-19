import { after, before } from 'mocha'
import { Dispatcher, getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici'

export const withIpfsCatResponse = (
  responses: { cid: string; code?: number; body?: string | object | Buffer; error?: Error }[]
) => {
  const ipfsOrigin = `http://ipfs`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://ipfs`)

    for (const { cid, code, body, error } of responses) {
      const scope = mockIpfs.intercept({
        path: `/api/v0/cat?arg=${cid}`,
        method: 'POST',
      })

      if (error) {
        scope.replyWithError(error)
      } else {
        scope.reply(code!, body!)
      }
    }
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { ipfsOrigin }
}
export const withIpfsAddResponse = (responses: { code: number; cid: unknown; body: Buffer }[]) => {
  const ipfsOrigin = `http://ipfs`
  let originalDispatcher: Dispatcher
  let mockAgent: MockAgent
  before(function () {
    originalDispatcher = getGlobalDispatcher()
    mockAgent = new MockAgent()
    setGlobalDispatcher(mockAgent)
    const mockIpfs = mockAgent.get(`http://ipfs`)

    for (const { code, cid } of responses) {
      mockIpfs
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
        .reply(code, { Hash: cid })
    }
  })

  after(function () {
    setGlobalDispatcher(originalDispatcher)
  })

  return { ipfsOrigin }
}
