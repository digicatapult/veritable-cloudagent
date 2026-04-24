import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import { useFakeTimers, type SinonFakeTimers } from 'sinon'
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher, type Dispatcher } from 'undici'

import Ipfs from '../index.js'
import { withIpfsAddResponse, withIpfsCatResponse } from './fixtures/ipfs.js'

const ipfsTimeoutMs = 15000
const shortTimeoutMs = 1
const delayedBeyondTimeoutMs = shortTimeoutMs + 10
const ipfsOrigin = 'http://ipfs'

const withDelayedIpfsMock = async (
  route: '/api/v0/cat?arg=timeoutCid' | '/api/v0/add?cid-version=1',
  body: Buffer | string | object,
  delayMs: number,
  run: () => Promise<void>
) => {
  const originalDispatcher: Dispatcher = getGlobalDispatcher()
  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  const mockIpfs = mockAgent.get(ipfsOrigin)
  const intercept = mockIpfs.intercept({
    path: route,
    method: 'POST',
    ...(route === '/api/v0/add?cid-version=1'
      ? {
          body: (calledBody: string) => {
            const asBuf = calledBody as unknown as FormData
            const asArr = [...asBuf.entries()]
            return asArr.length === 1 && asArr[0][0] === 'file'
          },
        }
      : {}),
  })

  intercept.reply(200, body).delay(delayMs)

  try {
    await run()
    mockAgent.assertNoPendingInterceptors()
  } finally {
    setGlobalDispatcher(originalDispatcher)
    await mockAgent.close()
  }
}

const withIpfsAddStatusMock = async (statusCode: number, body: string, run: () => Promise<void>) => {
  const originalDispatcher: Dispatcher = getGlobalDispatcher()
  const mockAgent = new MockAgent()
  mockAgent.disableNetConnect()
  setGlobalDispatcher(mockAgent)

  const mockIpfs = mockAgent.get(ipfsOrigin)
  mockIpfs
    .intercept({
      path: '/api/v0/add?cid-version=1',
      method: 'POST',
      body: (calledBody: string) => {
        const asBuf = calledBody as unknown as FormData
        const asArr = [...asBuf.entries()]
        return asArr.length === 1 && asArr[0][0] === 'file'
      },
    })
    .reply(statusCode, body)

  try {
    await run()
    mockAgent.assertNoPendingInterceptors()
  } finally {
    setGlobalDispatcher(originalDispatcher)
    await mockAgent.close()
  }
}

describe('ipfs', function () {
  it('creates an IPFS instance when origin is a valid URL', function () {
    const ipfs = new Ipfs('https://example.com', ipfsTimeoutMs)
    expect(ipfs).instanceOf(Ipfs)
  })

  it('should throw if origin is invalid', function () {
    expect(() => new Ipfs('wibble', ipfsTimeoutMs)).to.throw()
  })

  describe('getFile', function () {
    let clock: SinonFakeTimers | undefined
    const { ipfsOrigin: mockIpfsOrigin } = withIpfsCatResponse([
      { cid: 'okCid', code: 200, body: Buffer.from('1234', 'hex') },
      { cid: 'badCid', code: 400, body: Buffer.from('1234', 'hex') },
    ])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
    })

    it('returns buffer contents', async function () {
      const ipfs = new Ipfs(mockIpfsOrigin, ipfsTimeoutMs)
      const result = await ipfs.getFile('okCid')
      expect(result.toString('hex')).to.equal('1234')
    })

    it('throws when request fails', async function () {
      const ipfs = new Ipfs(mockIpfsOrigin, ipfsTimeoutMs)
      const error = await ipfs.getFile('badCid').then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      expect(error.message).to.equal(`Error calling IPFS`)
    })

    it('throws timeout when request exceeds timeout', async function () {
      clock = useFakeTimers({ toFake: ['setTimeout'] })
      await withDelayedIpfsMock(
        '/api/v0/cat?arg=timeoutCid',
        Buffer.from('1234', 'hex'),
        delayedBeyondTimeoutMs,
        async () => {
          const ipfs = new Ipfs(ipfsOrigin, shortTimeoutMs)
          const errorPromise = ipfs.getFile('timeoutCid').then(
            () => {
              throw new Error('Expected an error')
            },
            (caughtError: unknown) => caughtError as Error
          )

          await clock?.tickAsync(shortTimeoutMs)
          const error = await errorPromise

          expect(error.message).to.equal('Timeout fetching file timeoutCid from IPFS')
        }
      )
    })
  })

  describe('uploadFile', function () {
    const uploadBuffer = Buffer.from('hello', 'utf8')
    let clock: SinonFakeTimers | undefined
    const { ipfsOrigin: mockIpfsOrigin } = withIpfsAddResponse([{ cid: 'testCid', code: 200, body: uploadBuffer }])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
    })

    it('returns uploaded CID on success', async function () {
      const ipfs = new Ipfs(mockIpfsOrigin, ipfsTimeoutMs)
      const result = await ipfs.uploadFile(uploadBuffer)
      expect(result).to.equal('testCid')
    })

    it('throws when request fails (code 400)', async function () {
      await withIpfsAddStatusMock(400, '{}', async () => {
        const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
        const error = await ipfs.uploadFile(uploadBuffer).then(
          () => {
            throw new Error('Expected an error')
          },
          (caughtError: unknown) => caughtError as Error
        )

        expect(error.message).to.equal(`Error calling IPFS`)
      })
    })

    it('throws when response payload is invalid', async function () {
      await withIpfsAddStatusMock(200, '{"Hash":null}', async () => {
        const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
        const error = await ipfs.uploadFile(uploadBuffer).then(
          () => {
            throw new Error('Expected an error')
          },
          (caughtError: unknown) => caughtError as Error
        )

        expect(error.message).to.contain(`Error calling IPFS`)
      })
    })

    it('throws timeout when upload exceeds timeout', async function () {
      clock = useFakeTimers({ toFake: ['setTimeout'] })
      await withDelayedIpfsMock('/api/v0/add?cid-version=1', '{"Hash":"late"}', delayedBeyondTimeoutMs, async () => {
        const ipfs = new Ipfs(ipfsOrigin, shortTimeoutMs)
        const errorPromise = ipfs.uploadFile(uploadBuffer).then(
          () => {
            throw new Error('Expected an error')
          },
          (caughtError: unknown) => caughtError as Error
        )

        await clock?.tickAsync(shortTimeoutMs)
        const error = await errorPromise

        expect(error).instanceOf(Error)
        expect(error.message).to.equal('Timeout uploading file to IPFS')
      })
    })
  })
})
