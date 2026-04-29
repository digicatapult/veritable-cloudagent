import { expect } from 'chai'
import { describe, it } from 'mocha'

import { validateSync } from 'class-validator'

import { IsValidVerifiedDrpcRequest, isValidVerifiedDrpcRequest } from '../models/ValidRequest.js'

class RequestContainer {
  @IsValidVerifiedDrpcRequest()
  public request!: unknown
}

describe('IsValidVerifiedDrpcRequest', () => {
  it('accepts a valid single request object', () => {
    const dto = new RequestContainer()
    dto.request = {
      jsonrpc: '2.0',
      method: 'hello',
      id: 1,
    }

    const errors = validateSync(dto)

    expect(errors).to.have.length(0)
  })

  it('returns a validation error for an invalid single request object', () => {
    const dto = new RequestContainer()
    dto.request = {
      jsonrpc: '2.0',
      method: 'hello',
    }

    expect(() => validateSync(dto)).not.to.throw()

    const errors = validateSync(dto)
    expect(errors).to.have.length(1)
    expect(errors[0]?.property).to.equal('request')
    expect(Object.values(errors[0]?.constraints ?? {})).to.include('request is not a valid VerifiedDrpcRequest')
  })

  it('returns a validation error for an array containing an invalid request object', () => {
    const dto = new RequestContainer()
    dto.request = [
      {
        jsonrpc: '2.0',
        method: 'hello',
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'hello',
      },
    ]

    expect(() => validateSync(dto)).not.to.throw()

    const errors = validateSync(dto)
    expect(errors).to.have.length(1)
    expect(errors[0]?.property).to.equal('request')
    expect(Object.values(errors[0]?.constraints ?? {})).to.include('request is not a valid VerifiedDrpcRequest')
  })
})

describe('isValidVerifiedDrpcRequest', () => {
  it('returns true for valid request objects and false for invalid values', () => {
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '2.0', method: 'hello', id: 1 })).to.equal(true)
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '1.0', method: 'hello', id: 1 })).to.equal(false)
    expect(isValidVerifiedDrpcRequest({ jsonrpc: '2.0', method: 'hello' })).to.equal(false)
    expect(isValidVerifiedDrpcRequest([{ jsonrpc: '2.0', method: 'hello', id: 1 }])).to.equal(false)
    expect(isValidVerifiedDrpcRequest(null)).to.equal(false)
    expect(isValidVerifiedDrpcRequest('not-an-object')).to.equal(false)
  })
})
