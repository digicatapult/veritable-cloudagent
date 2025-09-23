import { expect } from 'chai'
import { readFileSync } from 'fs'
import { Agent, fetch } from 'undici'

const ca = readFileSync('/rootCA.pem')
const aliceDid = readFileSync('/dids/alice.json')
const bobDid = readFileSync('/dids/bob.json')
const charlieDid = readFileSync('/dids/charlie.json')

const agents = ['https://alice:8443', 'https://bob:8443', 'https://charlie:8443']
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
      expect(body).to.deep.equal(JSON.parse([aliceDid, bobDid, charlieDid][index].toString('utf8')))
    })
  })

  it(`should return 404 for non-existent DID`, async function () {
    const res = await fetch(`${agents[0]}/non-existent/did.json`, { dispatcher: httpsAgent })
    expect(res.status).to.equal(404)
  })
})
