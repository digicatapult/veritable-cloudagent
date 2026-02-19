import { expect } from 'chai'
import { describe, it } from 'mocha'

import Ipfs from '../index.js'
import { withIpfsAddResponse, withIpfsCatResponse } from './fixtures/ipfs.js'

describe('ipfs', function () {
  describe('ctor', function () {
    it('should construct an IPFS if origin is valid', function () {
      const ipfs = new Ipfs('https://example.com')
      expect(ipfs).instanceOf(Ipfs)
    })

    it('should throw if origin is invalid', function () {
      let error: Error | null = null
      try {
        new Ipfs('wibble')
      } catch (err) {
        error = err as Error
      }

      if (error === null) {
        expect.fail('Expected an error')
      }
      expect(error).instanceOf(Error)
    })
  })

  describe('getFile success', function () {
    const { ipfsOrigin } = withIpfsCatResponse([{ cid: 'testCid', code: 200, body: Buffer.from('1234', 'hex') }])

    it('should return buffer contents', async function () {
      const ipfs = new Ipfs(ipfsOrigin)
      const result = await ipfs.getFile('testCid')
      expect(result.toString('hex')).to.equal('1234')
    })
  })

  describe('getFile error', function () {
    const { ipfsOrigin } = withIpfsCatResponse([{ cid: 'testCid', code: 400, body: Buffer.from('1234', 'hex') }])

    it('should throw if request fails', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 1 })

      let error: Error | null = null
      try {
        await ipfs.getFile('testCid')
      } catch (err) {
        error = err as Error
      }

      if (error === null) {
        expect.fail('Expected an error')
      }
      expect(error).instanceOf(Error)
      expect(error.message).to.contain(`Error calling IPFS`)
    })
  })

  describe('uploadFile success', function () {
    const { ipfsOrigin } = withIpfsAddResponse([{ cid: 'testCid', code: 200, body: Buffer.from('hello', 'utf8') }])

    it('should return buffer contents', async function () {
      const ipfs = new Ipfs(ipfsOrigin)
      const result = await ipfs.uploadFile(Buffer.from('hello', 'utf8'))
      expect(result).to.equal('testCid')
    })
  })

  describe('uploadFile error (code 400)', function () {
    const { ipfsOrigin } = withIpfsAddResponse([{ cid: 'testCid', code: 400, body: Buffer.from('hello', 'utf8') }])

    it('should throw if request fails', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 1 })

      let error: Error | null = null
      try {
        await ipfs.uploadFile(Buffer.from('hello', 'utf8'))
      } catch (err) {
        error = err as Error
      }

      if (error === null) {
        expect.fail('Expected an error')
      }
      expect(error).instanceOf(Error)
      expect(error.message).to.contain(`Error calling IPFS`)
    })
  })

  describe('uploadFile error (response invalid)', function () {
    const { ipfsOrigin } = withIpfsAddResponse([{ cid: null, code: 200, body: Buffer.from('hello', 'utf8') }])

    it('should throw if Hash is not returned', async function () {
      const ipfs = new Ipfs(ipfsOrigin, { maxRetries: 1 })

      let error: Error | null = null
      try {
        await ipfs.uploadFile(Buffer.from('hello', 'utf8'))
      } catch (err) {
        error = err as Error
      }

      if (error === null) {
        expect.fail('Expected an error')
      }
      expect(error).instanceOf(Error)
      expect(error.message).to.contain(`Error calling IPFS`)
    })
  })
})
