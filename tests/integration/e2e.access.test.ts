import request from 'supertest'
import { describe, it } from 'mocha'
import { expect } from 'chai'

const HOLDER_BASE_URL = process.env.BOB_BASE_URL ?? ''

describe('Access checks', function () {
  const holderClient = request(HOLDER_BASE_URL)
  const verifierDid = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'
  const packageId = 'suppliers' // from samples/suppliers.rego

  it("should return true if a supplier is one of OEM's suppliers", async function () {
    const query = {
      input: {
        method: 'query',
        did: verifierDid,
        suppliers: [verifierDid],
      },
    }

    const response = await holderClient
      .post(`/v1/access/data/${packageId}/eval`)
      .send(query)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('allow')
    expect(response.body.allow).to.equal(true)
  })

  it("should return false if a supplier is NOT one of OEM's suppliers", async function () {
    const query = {
      input: {
        method: 'query',
        did: verifierDid,
        suppliers: ['did:key:someOther'],
      },
    }

    const response = await holderClient
      .post(`/v1/access/data/${packageId}/eval`)
      .send(query)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('allow')
    expect(response.body.allow).to.equal(false)
  })
})
