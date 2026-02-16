import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { UUID } from '../../src/controllers/types/index.js'

const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const BOB_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'

const ALICE_DID = 'did:web:alice%3A8443'
const BOB_DID = 'did:web:bob%3A8443'

describe('DID:web Implicit Connection Flow + Credential Issuance', function () {
  this.timeout(60000)

  const aliceClient = request(ALICE_BASE_URL)
  const bobClient = request(BOB_BASE_URL)

  let bobConnectionId: UUID
  let aliceConnectionId: UUID
  let bobDid: string

  let aliceCredentialRecordId: UUID
  let bobCredentialRecordId: UUID

  beforeEach(function (done) {
    setTimeout(done, 200)
  })

  it('should allow Bob to connect to Alice via Implicit Invitation using her DID:web', async function () {
    await bobClient.get(`/v1/dids/${encodeURIComponent(ALICE_DID)}`).expect(200)

    const payload = {
      did: ALICE_DID,
      alias: 'Alice (Implicit)',
      autoAcceptConnection: true,
    }

    const response = await bobClient
      .post('/v1/oob/receive-implicit-invitation')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.nested.property('connectionRecord.id')
    expect(response.body.connectionRecord.state).to.match(/request-sent|completed/)

    bobConnectionId = response.body.connectionRecord.id
    bobDid = response.body.connectionRecord.did
  })

  it("should eventually result in a completed connection on Alice's side", async function () {
    let connectionFound = false

    for (let i = 0; i < 60; i++) {
      const res = await aliceClient.get('/v1/connections').expect(200)
      const connections = res.body as { state: string; theirDid?: string; id: UUID }[]

      // Alice should see an incoming connection from Bob's DID
      const match = connections.find((c) => c.theirDid === bobDid)

      if (match) {
        aliceConnectionId = match.id

        if (match.state === 'request-received') {
          await aliceClient.post(`/v1/connections/${aliceConnectionId}/accept-request`).send({}).expect(200)
          // Wait for next iteration to check for completion
          continue
        }

        if (match.state === 'completed') {
          connectionFound = true
          break
        }
      }
      await new Promise((r) => setTimeout(r, 1000))
    }

    if (!connectionFound) {
      throw new Error('Connection never reached completed state on Alice side')
    }
  })

  it('Bob should reach "completed" state', async function () {
    let state = ''
    for (let i = 0; i < 60; i++) {
      const res = await bobClient.get(`/v1/connections/${bobConnectionId}`).expect(200)
      state = res.body.state
      if (state === 'completed') break
      await new Promise((r) => setTimeout(r, 1000))
    }
    expect(state).to.equal('completed')
  })

  it('Bob should be able to ping Alice', async function () {
    const res = await bobClient
      .post(`/v1/connections/${bobConnectionId}/send-ping`)
      .query({ responseRequested: true })
      .expect(200)

    expect(res.body).to.have.property('@type', 'https://didcomm.org/trust_ping/1.0/ping')
    expect(res.body).to.have.property('@id')
  })

  it('Alice should be able to offer Bob a W3C (JSON-LD) credential', async function () {
    const offerCredentialPayload = {
      protocolVersion: 'v2',
      connectionId: aliceConnectionId,
      credentialFormats: {
        jsonld: {
          credential: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential'],
            issuer: ALICE_DID,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
              id: BOB_DID,
            },
          },
          options: {
            proofType: 'Ed25519Signature2020',
            proofPurpose: 'assertionMethod',
          },
        },
      },
    }

    const response = await aliceClient
      .post('/v1/credentials/offer-credential')
      .send(offerCredentialPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'offer-sent')
    expect(response.body).to.have.property('id')
    aliceCredentialRecordId = response.body.id
  })

  it('Bob should be able to receive the W3C credential offer', async function () {
    let received = false
    for (let i = 0; i < 60; i++) {
      const response = await bobClient.get('/v1/credentials').query({ connectionId: bobConnectionId }).expect(200)
      const records = response.body as { state: string; id: UUID }[]

      const record = records.find((r) => r.state === 'offer-received')
      if (record) {
        bobCredentialRecordId = record.id
        received = true
        break
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(received).to.equal(true)
  })

  it('Bob should be able to accept the W3C credential offer', async function () {
    const acceptPayload = {
      credentialFormats: {
        jsonld: {
          // Invoke jsonld format service with default options
        },
      },
    }

    const response = await bobClient
      .post(`/v1/credentials/${bobCredentialRecordId}/accept-offer`)
      .send(acceptPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'request-sent')
  })

  it('Bob should be able to accept the issued W3C credential (done state)', async function () {
    let credentialReceived = false
    for (let i = 0; i < 60; i++) {
      const response = await bobClient.get(`/v1/credentials/${bobCredentialRecordId}`).expect(200)
      if (response.body.state === 'credential-received') {
        credentialReceived = true
        break
      }
      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(credentialReceived).to.equal(true, 'Bob should have reached state credential-received')

    const response = await bobClient
      .post(`/v1/credentials/${bobCredentialRecordId}/accept-credential`)
      .send({})
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'done')
  })

  it('Alice should reach done state for the W3C credential issuance', async function () {
    let issuerDone = false
    for (let i = 0; i < 60; i++) {
      const response = await aliceClient.get(`/v1/credentials/${aliceCredentialRecordId}`).expect(200)
      if (response.body.state === 'done') {
        issuerDone = true
        break
      }
      await new Promise((r) => setTimeout(r, 1000))
    }

    expect(issuerDone).to.equal(true)
  })
})
