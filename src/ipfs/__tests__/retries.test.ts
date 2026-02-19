import { expect } from 'chai'
import { describe, it } from 'mocha'

import Ipfs from '../index.js'
import { withIpfsCatResponse } from './fixtures/ipfs.js'

describe('ipfs retries', function () {
  describe('getFile success on first attempt', function () {
    const { ipfsOrigin } = withIpfsCatResponse([{ cid: 'testOk', code: 200, body: Buffer.from('ok', 'utf8') }])

    it('should return buffer contents without retry', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      const result = await ipfs.getFile('testOk')
      expect(result.toString('utf8')).to.equal('ok')
    })
  })

  describe('getFile retry success after network error', function () {
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'testNetErr', error: new Error('Network Error') },
      { cid: 'testNetErr', code: 200, body: Buffer.from('ok', 'utf8') },
    ])

    it('should retry on network error and succeed', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      const result = await ipfs.getFile('testNetErr')
      expect(result.toString('utf8')).to.equal('ok')
    })
  })

  describe('getFile retry success after 5xx error', function () {
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'test500', code: 500, body: 'Internal Server Error' },
      { cid: 'test500', code: 200, body: Buffer.from('ok', 'utf8') },
    ])

    it('should retry upon receiving 500 status code', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      const result = await ipfs.getFile('test500')
      expect(result.toString('utf8')).to.equal('ok')
    })
  })

  describe('getFile immediate failure on 4xx error', function () {
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'test400', code: 400, body: 'Bad Request' },
      // The second response should NOT be reached if logic is correct
      { cid: 'test400', code: 200, body: Buffer.from('ok', 'utf8') },
    ])

    it('should throw immediately on 400 error without retry', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      let error: Error | null = null
      try {
        await ipfs.getFile('test400')
      } catch (err) {
        error = err as Error
      }
      expect(error).to.be.instanceOf(Error)
      expect(error!.message).to.contain('Error calling IPFS: 400 Bad Request')
    })
  })

  describe('getFile failure after max retries (network error)', function () {
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'testMaxRetryNet', error: new Error('Network Error 1') },
      { cid: 'testMaxRetryNet', error: new Error('Network Error 2') },
      { cid: 'testMaxRetryNet', error: new Error('Network Error 3') },
    ])

    it('should throw last network error after max retries', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      let error: Error | null = null
      try {
        await ipfs.getFile('testMaxRetryNet')
      } catch (err) {
        error = err as Error
      }
      expect(error).to.be.instanceOf(Error)
      // The last error thrown might be wrapped in 'fetch failed'
      if (error!.message === 'fetch failed') {
        expect(error).to.have.property('cause')
        expect((error!.cause as Error).message).to.equal('Network Error 3')
      } else {
        expect(error!.message).to.equal('Network Error 3')
      }
    })
  })

  describe('getFile failure after max retries (5xx error)', function () {
    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'testMaxRetry500', code: 500, body: 'Error 1' },
      { cid: 'testMaxRetry500', code: 502, body: 'Error 2' },
      { cid: 'testMaxRetry500', code: 503, body: 'Error 3' },
    ])

    it('should throw last 5xx error after max retries', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 1 })
      let error: Error | null = null
      try {
        await ipfs.getFile('testMaxRetry500')
      } catch (err) {
        error = err as Error
      }
      expect(error).to.be.instanceOf(Error)
      expect(error!.message).to.contain('Error calling IPFS: 503')
    })
  })

  describe('exponential backoff check', function () {
    // We can't easily check timing precisely in unit tests without sinon fake timers or similar,
    // which might conflict with integration test setups if global hooks are used incorrectly.
    // But we can check retry sequence.
    // For timing, we rely on `initialDelay` parameter being respected, but validating delay time is tricky with current fixture.
    // We'll trust the logic if retry count is correct.

    const { ipfsOrigin } = withIpfsCatResponse([
      { cid: 'testBackoff', code: 500, body: 'Err 1' },
      { cid: 'testBackoff', code: 500, body: 'Err 2' },
      { cid: 'testBackoff', code: 200, body: Buffer.from('ok', 'utf8') },
    ])

    it('should retry twice and then succeed', async function () {
      const start = Date.now()
      // Use a small delay to make test fast but measurable if needed (though tricky in shared env)
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 3, initialDelay: 10 })
      const result = await ipfs.getFile('testBackoff')
      const duration = Date.now() - start

      expect(result.toString('utf8')).to.equal('ok')
      // 1st retry delay: 10ms
      // 2nd retry delay: 20ms
      // total wait >= 30ms
      expect(duration).to.be.greaterThan(25)
    })
  })
})
