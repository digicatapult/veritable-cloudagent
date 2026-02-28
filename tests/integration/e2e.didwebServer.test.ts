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

interface DidWebJson {
  id: string
  verificationMethod: Array<{
    id: string
    type: string
    controller: string
    publicKeyJwk?: { kty?: string; crv?: string; x?: string }
  }>
  authentication: string[]
  assertionMethod: string[]
  keyAgreement: string[]
  capabilityInvocation: string[]
  service: Array<{
    id: string
    type: string
    recipientKeys: string[]
  }>
}

describe('DID:web server', function () {
  agents.forEach((baseUrl, index) => {
    it(`should return ok for ${baseUrl} DID:web health endpoint`, async function () {
      const res = await fetch(`${baseUrl}/health`)
      const body = await res.json()
      expect(body).to.have.property('status', 'ok')
    })

    it(`should return test DID from ${baseUrl}`, async function () {
      const res = await fetch(`${baseUrl}/did.json`)
      const body = (await res.json()) as DidWebJson
      const did = dids[index]

      expect(body).to.deep.include({ id: did })
      expect(body).to.have.property('verificationMethod').that.is.an('array').with.length(3)

      const verificationMethods = body.verificationMethod

      const authKey = verificationMethods.find((method) => method.id === `${did}#auth-key`)
      const assertionKey = verificationMethods.find((method) => method.id === `${did}#assertion-key`)
      const agreementKey = verificationMethods.find((method) => method.id === `${did}#agreement-key`)

      expect(authKey).to.not.equal(undefined)
      expect(authKey?.type).to.equal('JsonWebKey2020')
      expect(authKey?.controller).to.equal(did)
      expect(authKey?.publicKeyJwk?.kty).to.equal('OKP')
      expect(authKey?.publicKeyJwk?.crv).to.equal('Ed25519')
      expect(authKey?.publicKeyJwk?.x).to.be.a('string')
      expect((authKey?.publicKeyJwk?.x ?? '').length).to.be.greaterThan(0)

      expect(assertionKey).to.not.equal(undefined)
      expect(assertionKey?.type).to.equal('JsonWebKey2020')
      expect(assertionKey?.controller).to.equal(did)
      expect(assertionKey?.publicKeyJwk?.kty).to.equal('OKP')
      expect(assertionKey?.publicKeyJwk?.crv).to.equal('Ed25519')
      expect(assertionKey?.publicKeyJwk?.x).to.be.a('string')
      expect((assertionKey?.publicKeyJwk?.x ?? '').length).to.be.greaterThan(0)

      expect(agreementKey).to.not.equal(undefined)
      expect(agreementKey?.type).to.equal('JsonWebKey2020')
      expect(agreementKey?.controller).to.equal(did)
      expect(agreementKey?.publicKeyJwk?.kty).to.equal('OKP')
      expect(agreementKey?.publicKeyJwk?.crv).to.equal('X25519')
      expect(agreementKey?.publicKeyJwk?.x).to.be.a('string')
      expect((agreementKey?.publicKeyJwk?.x ?? '').length).to.be.greaterThan(0)

      expect(body.authentication).to.deep.equal([`${did}#auth-key`])
      expect(body.assertionMethod).to.deep.equal([`${did}#assertion-key`])
      expect(body.keyAgreement).to.deep.equal([`${did}#agreement-key`])
      expect(body.capabilityInvocation).to.deep.equal([`${did}#auth-key`])

      expect(body).to.have.property('service').that.is.an('array').with.length.greaterThan(0)
      expect(body.service[0]).to.deep.include({ id: `${did}#did-communication`, type: 'did-communication' })
      expect(body.service[0].recipientKeys).to.deep.equal([`${did}#auth-key`])
    })

    it(`should return 404 for non-existent DID on ${baseUrl}`, async function () {
      const res = await fetch(`${baseUrl}/non-existent/did.json`)
      expect(res.status).to.equal(404)
    })
  })
})
