import { expect } from 'chai'
import { fetch } from 'undici'

const ALICE_DID_WEB_URL = process.env.ALICE_DID_WEB_URL ?? 'https://localhost:8443'
const BOB_DID_WEB_URL = process.env.BOB_DID_WEB_URL ?? 'https://localhost:8444'
const CHARLIE_DID_WEB_URL = process.env.CHARLIE_DID_WEB_URL ?? 'https://localhost:8445'

const agents = [ALICE_DID_WEB_URL, BOB_DID_WEB_URL, CHARLIE_DID_WEB_URL]
const dids = ['did:web:alice%3A8443', 'did:web:bob%3A8443', 'did:web:charlie%3A8443']

describe('DID:web server', function () {
  agents.forEach((baseUrl, index) => {
    it(`should return ok for ${baseUrl} DID:web health endpoint`, async function () {
      const res = await fetch(`${baseUrl}/health`)
      const body = await res.json()
      expect(body).to.have.property('status', 'ok')
    })

    it(`should return test DID from ${baseUrl}`, async function () {
      const res = await fetch(`${baseUrl}/did.json`)
      const body = await res.json()
      expect(body).to.deep.include({ id: dids[index] })
    })

    it(`should return 404 for non-existent DID on ${baseUrl}`, async function () {
      const res = await fetch(`${baseUrl}/non-existent/did.json`)
      expect(res.status).to.equal(404)
    })
  })
})
