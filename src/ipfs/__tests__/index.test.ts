import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import { useFakeTimers, type SinonFakeTimers } from 'sinon'

import Ipfs from '../index.js'
import { withIpfsAddResponse, withIpfsCatResponse } from './fixtures/ipfs.js'

const ipfsTimeoutMs = 15000
const shortTimeoutMs = 1
const delayedBeyondTimeoutMs = shortTimeoutMs + 10

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
      { cid: 'timeoutCid', code: 200, body: Buffer.from('1234', 'hex'), delayMs: delayedBeyondTimeoutMs },
    ])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
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

      const ipfs = new Ipfs(ipfsOrigin, shortTimeoutMs)
      const errorPromise = ipfs.getFile('timeoutCid').then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      await clock.tickAsync(shortTimeoutMs)
      const error = await errorPromise

      expect(error.message).to.equal('Timeout fetching file timeoutCid from IPFS')
    })
  })

  describe('uploadFile', function () {
    const uploadBuffer = Buffer.from('hello', 'utf8')
    let clock: SinonFakeTimers | undefined
    const { ipfsOrigin } = withIpfsAddResponse([
      { cid: 'testCid', code: 200 },
      { cid: 'ignoredFor400', code: 400, body: '{}' },
      { cid: 'ignoredInvalid', code: 200, body: '{"Hash":null}' },
      { cid: 'ignoredTimeout', code: 200, body: '{"Hash":"late"}', delayMs: delayedBeyondTimeoutMs },
    ])

    beforeEach(function () {
      clock = undefined
    })

    afterEach(function () {
      clock?.restore()
    })

    it('returns uploaded CID on success', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
      const result = await ipfs.uploadFile(uploadBuffer)
      expect(result).to.equal('testCid')
    })

    it('throws when request fails (code 400)', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
      const error = await ipfs.uploadFile(uploadBuffer).then(
        () => {
          throw new Error('Expected an error')
        },
        (caughtError: unknown) => caughtError as Error
      )

      expect(error.message).to.equal(`Error calling IPFS`)
    })

    it('throws when response payload is invalid', async function () {
      const ipfs = new Ipfs(ipfsOrigin, ipfsTimeoutMs)
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

      const ipfs = new Ipfs(ipfsOrigin, shortTimeoutMs)
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
