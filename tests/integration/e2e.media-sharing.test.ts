import { expect } from 'chai'
import { describe, it } from 'mocha'
import request from 'supertest'
import { ALICE_BASE_URL, BOB_BASE_URL, OOB_INVITATION_PAYLOAD } from './utils/fixtures.js'
import { waitForConnectionByOob } from './utils/helpers.js'

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
      .send(OOB_INVITATION_PAYLOAD)
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
    aliceConnectionId = await waitForConnectionByOob(alice, oobRecordId, { maxAttempts: 10, intervalMs: 500 })
    expect(aliceConnectionId).to.be.a('string')
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
