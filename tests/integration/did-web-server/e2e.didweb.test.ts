import { expect } from 'chai'
import { readFileSync } from 'fs'
import { Agent, fetch } from 'undici'

const ca = readFileSync('/rootCA.pem')

const agents = ['https://alice:8443', 'https://bob:8443', 'https://charlie:8443']
const dids = ['did:web:alice%3A8443', 'did:web:bob%3A8443', 'did:web:charlie%3A8443']
const httpsAgent = new Agent({
  connect: {
    ca: ca,
  },
})

describe('DID:web health', function () {
  agents.forEach((baseUrl) => {
    it(`should return ok for ${baseUrl} DID:web health endpoint`, async function () {
      const res = await fetch(`${baseUrl}/health`, { dispatcher: httpsAgent })
      const body = await res.json()
      expect(body).to.have.property('status', 'ok')
    })
  })
})

describe('get did:web', function () {
  agents.forEach((baseUrl, index) => {
    it(`should return test DID from ${baseUrl}`, async function () {
      const res = await fetch(`${baseUrl}/did.json`, { dispatcher: httpsAgent })
      const body = await res.json()
      expect(body).to.deep.include({ id: dids[index] })
    })
  })

  it(`should return 404 for non-existent DID`, async function () {
    const res = await fetch(`${agents[0]}/non-existent/did.json`, { dispatcher: httpsAgent })
    expect(res.status).to.equal(404)
  })
})
