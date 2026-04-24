import { expect } from 'chai'
import { fetch } from 'undici'
import {
  ALICE_DID_WEB_URL,
  BOB_DID_WEB_URL,
  CHARLIE_DID_WEB_URL,
  DID_WEB_ALICE,
  DID_WEB_BOB,
  DID_WEB_CHARLIE,
} from './utils/fixtures.js'

const agents = [ALICE_DID_WEB_URL, BOB_DID_WEB_URL, CHARLIE_DID_WEB_URL]
const dids = [DID_WEB_ALICE, DID_WEB_BOB, DID_WEB_CHARLIE]

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
