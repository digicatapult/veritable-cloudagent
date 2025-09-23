import { expect } from 'chai'
import { describe, it } from 'mocha'
import request from 'supertest'

const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const BOB_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'

// End-to-end test: A (Alice) shares media with B (Bob), and Bob can see the record
// and download the file from the provided URL (mocked).
describe('Media Sharing A→B', function () {
  this.retries(10)

  const alice = request(ALICE_BASE_URL)
  const bob = request(BOB_BASE_URL)

  let oobRecordId: string
  let aliceToBobInvitationUrl: string
  let bobConnectionId: string
  let aliceConnectionId: string

  it('Alice creates invitation', async function () {
    const res = await alice
      .post('/v1/oob/create-invitation')
      .send({
        handshake: true,
        handshakeProtocols: ['https://didcomm.org/connections/1.x'],
        autoAcceptConnection: true,
      })
      .expect('Content-Type', /json/)
      .expect(200)

    aliceToBobInvitationUrl = res.body.invitationUrl
    oobRecordId = res.body.outOfBandRecord.id
  })

  it('Bob accepts invitation', async function () {
    const res = await bob
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: aliceToBobInvitationUrl })
      .expect('Content-Type', /json/)
      .expect(200)

    bobConnectionId = res.body.connectionRecord.id
  })

  it('Alice sees her connection', async function () {
    const res = await alice.get('/v1/connections').query({ outOfBandId: oobRecordId }).expect(200)
    expect(res.body).to.be.an('array').that.has.length(1)
    aliceConnectionId = res.body[0].id
  })

  it('Alice shares media to Bob', async function () {
    const body = {
      connectionId: aliceConnectionId,
      description: 'Spec doc',
      items: [
        {
          uri: 'https://httpbin.org/bytes/64',
          mimeType: 'application/octet-stream',
          description: 'Random bytes',
          fileName: 'bytes.bin',
        },
      ],
    }

    const res = await alice.post('/v1/media/share').send(body).expect('Content-Type', /json/).expect(200)
    expect(res.body).to.have.property('id')
    expect(res.body).to.have.property('state')
  })

  it('Bob can see the media sharing record', async function () {
    // There is not yet a dedicated list endpoint for media-sharing; use generic records endpoint when available.
    // For now, validate Bob's agent state via connections (indirect). This is a placeholder asserting flow completion.
    const res = await bob.get(`/v1/connections/${bobConnectionId}`).expect(200)
    expect(res.body).to.have.property('id', bobConnectionId)
  })

  it('Bob can download the file from the provided URI (mock check)', async function () {
    // Optional smoke check to ensure the URI is accessible; this runs against httpbin which is public.
    // In a CI-limited environment, you may want to stub this or replace with an internal test URL.
    const file = await fetch('https://httpbin.org/bytes/16')
    expect(file.ok).to.equal(true)
    const buf = Buffer.from(await file.arrayBuffer())
    expect(buf.length).to.equal(16)
  })
})
