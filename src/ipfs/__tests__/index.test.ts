import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import { restore as sinonRestore, stub, useFakeTimers, type SinonFakeTimers } from 'sinon'

import Ipfs from '../index.js'
import { withIpfsAddResponse, withIpfsCatResponse } from './fixtures/ipfs.js'

const ipfsTimeoutMs = 15000
const shortTimeoutMs = 1

const stubHangingFetch = () => {
  // Simulate a fetch request that never resolves unless explicitly aborted.
  stub(globalThis, 'fetch').callsFake((_request: URL | RequestInfo, init?: RequestInit) => {
    return new Promise<Response>((_, reject) => {
      const rejectOnAbort = () => reject(init?.signal?.reason ?? new Error('The operation was aborted.'))

      if (init?.signal?.aborted) {
        rejectOnAbort()
        return
      }

      init?.signal?.addEventListener('abort', rejectOnAbort, { once: true })
    })
  })
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
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'okCid', code: 200, body: Buffer.from('1234', 'hex') },
      { cid: 'badCid', code: 400, body: Buffer.from('1234', 'hex') },
    ])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
      sinonRestore()
    })

    it('returns buffer contents', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
      const result = await ipfs.getFile('okCid')
      expect(result.toString('hex')).to.equal('1234')
    })

    it('throws when request fails', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
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
      stubHangingFetch()

      const ipfs = new Ipfs('http://ipfs', shortTimeoutMs)
      const errorPromise = ipfs.getFile('testCid').then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      await clock.tickAsync(shortTimeoutMs)
      const error = await errorPromise

      expect(error.message).to.equal('Timeout fetching file testCid from IPFS')
    })
  })

  describe('uploadFile', function () {
    const uploadBuffer = Buffer.from('hello', 'utf8')
    let clock: SinonFakeTimers | undefined
    const { ipfsOrigin } = withIpfsAddResponse([{ cid: 'testCid', code: 200, body: uploadBuffer }])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
      sinonRestore()
    })

    it('returns uploaded CID on success', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
      const result = await ipfs.uploadFile(uploadBuffer)
      expect(result).to.equal('testCid')
    })

    it('throws when request fails (code 400)', async function () {
      stub(globalThis, 'fetch').resolves(new Response('{}', { status: 400 }))

      const ipfs = new Ipfs('http://ipfs', ipfsTimeoutMs)
      const error = await ipfs.uploadFile(uploadBuffer).then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      expect(error.message).to.equal(`Error calling IPFS`)
    })

    it('throws when response payload is invalid', async function () {
      stub(globalThis, 'fetch').resolves(new Response('{"Hash":null}', { status: 200 }))

      const ipfs = new Ipfs('http://ipfs', ipfsTimeoutMs)
      const error = await ipfs.uploadFile(uploadBuffer).then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      expect(error.message).to.contain(`Error calling IPFS`)
    })

    it('throws timeout when upload exceeds timeout', async function () {
      clock = useFakeTimers({ toFake: ['setTimeout'] })
      stubHangingFetch()

      const ipfs = new Ipfs('http://ipfs', shortTimeoutMs)
      const errorPromise = ipfs.uploadFile(uploadBuffer).then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      await clock.tickAsync(shortTimeoutMs)
      const error = await errorPromise

      expect(error).instanceOf(Error)
      expect(error.message).to.equal('Timeout uploading file to IPFS')
    })
  })
})
