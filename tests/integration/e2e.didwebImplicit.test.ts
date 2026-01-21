import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { UUID } from '../../src/controllers/types/index.js'

const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const BOB_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'

const ALICE_DID = 'did:web:alice%3A8443'

describe('DID:web Implicit Connection Flow', function () {
  const aliceClient = request(ALICE_BASE_URL)
  const bobClient = request(BOB_BASE_URL)

  let bobConnectionId: UUID
  let aliceConnectionId: UUID
  let bobDid: string

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
    this.timeout(20000)

    let connectionFound = false
    const maxRetries = 20

    for (let i = 0; i < maxRetries; i++) {
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
    this.timeout(20000)
    let state = ''
    for (let i = 0; i < 20; i++) {
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

  it('should disconnect and delete connection records', async function () {
    await bobClient.delete(`/v1/connections/${bobConnectionId}`).query({ deleteConnectionRecord: true }).expect(204)

    await aliceClient.delete(`/v1/connections/${aliceConnectionId}`).query({ deleteConnectionRecord: true }).expect(204)
  })
})
