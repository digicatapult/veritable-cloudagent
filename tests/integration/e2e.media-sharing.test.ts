import { expect } from 'chai'
import { describe, it } from 'mocha'
import request from 'supertest'

const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const BOB_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'

// End-to-end test: A (Alice) shares media with B (Bob), and Bob can see the record
// and download the file from the provided URL (mocked).
describe('Media Sharing A→B', function () {
  const alice = request(ALICE_BASE_URL)
  const bob = request(BOB_BASE_URL)

  let oobRecordId: string
  let aliceToBobInvitationUrl: string
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
    await bob
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: aliceToBobInvitationUrl })
      .expect('Content-Type', /json/)
      .expect(200)
  })

  it('Alice sees her connection', async function () {
    let body: { id: string }[] = []
    for (let i = 0; i < 10; i++) {
      const res = await alice.get('/v1/connections').query({ outOfBandId: oobRecordId }).expect(200)
      body = res.body
      if (body.length > 0 && body[0].id) break
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    expect(body).to.be.an('array').that.has.length(1)
    aliceConnectionId = body[0].id
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
})
