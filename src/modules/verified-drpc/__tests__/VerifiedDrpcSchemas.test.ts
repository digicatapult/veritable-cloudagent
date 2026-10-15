import { expect } from 'chai'
import { describe, it } from 'mocha'

import { isValidVerifiedDrpcRequest, verifiedDrpcRequestSchema } from '../models/ValidRequest.js'
import { isValidVerifiedDrpcResponse, verifiedDrpcResponseSchema } from '../models/ValidResponse.js'

describe('verifiedDrpcRequestSchema', () => {
  it('accepts a valid request object', () => {
    const request = {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    }

    expect(verifiedDrpcRequestSchema.safeParse(request).success).to.equal(true)
  })

  it('rejects an invalid request object', () => {
    expect(verifiedDrpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'hello' }).success).to.equal(false)
    expect(verifiedDrpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 42, id: 1 }).success).to.equal(false)
    expect(verifiedDrpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'hello', id: {} }).success).to.equal(false)
    expect(
      verifiedDrpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'hello', params: 42, id: 1 }).success
    ).to.equal(false)
    expect(
      verifiedDrpcRequestSchema.safeParse({ jsonrpc: '2.0', method: 'hello', params: undefined, id: 1 }).success
    ).to.equal(false)
  })

  it('rejects request batches, including single-item batches', () => {
    const validRequest = { jsonrpc: '2.0', method: 'hello', id: 1 }

    expect(verifiedDrpcRequestSchema.safeParse([validRequest]).success).to.equal(false)
    expect(verifiedDrpcRequestSchema.safeParse([validRequest, validRequest]).success).to.equal(false)
    expect(verifiedDrpcRequestSchema.safeParse([]).success).to.equal(false)
  })
})

describe('isValidVerifiedDrpcRequest', () => {
  it('returns true for valid request objects and false for batches and invalid values', () => {
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '2.0', method: 'hello', id: 1 })).to.equal(true)
    expect(isValidVerifiedDrpcRequest([{ jsonrpc: '2.0', method: 'hello', id: 1 }])).to.equal(false)
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '1.0', method: 'hello', id: 1 })).to.equal(false)
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '2.0', method: 'hello' })).to.equal(false)
    expect(isValidVerifiedDrpcRequest([])).to.equal(false)
    expect(isValidVerifiedDrpcRequest(null)).to.equal(false)
    expect(isValidVerifiedDrpcRequest('not-an-object')).to.equal(false)
  })
})

describe('verifiedDrpcResponseSchema', () => {
  it('accepts valid result and error response objects', () => {
    const response = { jsonrpc: '2.0', result: 'hello', id: 1 }
    const errorResponse = { jsonrpc: '2.0', error: { code: -32601, message: 'method not found' }, id: 2 }

    expect(verifiedDrpcResponseSchema.safeParse(response).success).to.equal(true)
    expect(verifiedDrpcResponseSchema.safeParse(errorResponse).success).to.equal(true)
  })

  it('rejects invalid responses and response batches', () => {
    expect(verifiedDrpcResponseSchema.safeParse({ jsonrpc: '1.0', id: 1 }).success).to.equal(false)
    expect(verifiedDrpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1 }).success).to.equal(false)
    expect(verifiedDrpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: 'ok', error: {} }).success).to.equal(
      false
    )
    expect(verifiedDrpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, result: undefined }).success).to.equal(false)
    expect(verifiedDrpcResponseSchema.safeParse([]).success).to.equal(false)
    expect(verifiedDrpcResponseSchema.safeParse([{ jsonrpc: '2.0', result: 'ok', id: 1 }]).success).to.equal(false)
    expect(
      verifiedDrpcResponseSchema.safeParse([
        { jsonrpc: '2.0', result: 'ok', id: 1 },
        { jsonrpc: '2.0', result: 'other', id: 2 },
      ]).success
    ).to.equal(false)
  })

  it('rejects response errors with invalid code and message fields', () => {
    expect(verifiedDrpcResponseSchema.safeParse({ jsonrpc: '2.0', id: 1, error: { code: -1 } }).success).to.equal(false)
    expect(
      verifiedDrpcResponseSchema.safeParse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: 'bad', message: 'custom error' },
      }).success
    ).to.equal(false)
    expect(
      verifiedDrpcResponseSchema.safeParse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32001, message: 'custom error' },
      }).success
    ).to.equal(true)
  })
})

describe('isValidVerifiedDrpcResponse', () => {
  it('returns true for valid response objects and false for batches and invalid values', () => {
    expect(isValidVerifiedDrpcResponse({ jsonrpc: '2.0', result: 'hello', id: 1 })).to.equal(true)
    expect(
      isValidVerifiedDrpcResponse({ jsonrpc: '2.0', error: { code: -32601, message: 'not found' }, id: 2 })
    ).to.equal(true)
    expect(isValidVerifiedDrpcResponse([{ jsonrpc: '2.0', result: 'hello', id: 1 }])).to.equal(false)
    expect(isValidVerifiedDrpcResponse({ jsonrpc: '2.0', id: 1 })).to.equal(false)
    expect(isValidVerifiedDrpcResponse({ jsonrpc: '2.0', id: 1, result: 'ok', error: {} })).to.equal(false)
    expect(isValidVerifiedDrpcResponse([])).to.equal(false)
    expect(isValidVerifiedDrpcResponse(null)).to.equal(false)
    expect(isValidVerifiedDrpcResponse('not-an-object')).to.equal(false)
  })
})
