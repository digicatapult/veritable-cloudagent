import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { UUID } from '../../src/controllers/types/index.js'
import { ALICE_BASE_URL, BOB_BASE_URL, OOB_INVITATION_PAYLOAD } from './utils/fixtures.js'
import { sleep, waitForBasicMessageContent, waitForConnectionByOob, waitForConnectionState } from './utils/helpers.js'

describe('DIDComm WebSocket endpoint transport', function () {
  this.timeout(120000)

  const aliceClient = request(ALICE_BASE_URL)
  const bobClient = request(BOB_BASE_URL)

  let aliceOobRecordId: UUID
  let bobConnectionId: UUID
  let aliceConnectionId: UUID
  let wsOnlyInvitationUrl: string
  let wsServiceEndpoint: string
  let messageContent: string

  beforeEach(async function () {
    await sleep(200)
  })

  it('should create an invitation that can be rewritten to WS-only /didcomm-ws service endpoints', async function () {
    const oobResponse = await aliceClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect('Content-Type', /json/)
      .expect(200)

    aliceOobRecordId = oobResponse.body.outOfBandRecord.id

    const invitationUrl = new URL(oobResponse.body.invitationUrl as string)
    const encodedInvitation = invitationUrl.searchParams.get('oob')

    if (!encodedInvitation) {
      throw new Error('Expected invitationUrl to contain an oob parameter')
    }

    const invitation = JSON.parse(Buffer.from(encodedInvitation, 'base64url').toString('utf8')) as {
      services?: Array<{ serviceEndpoint?: string }>
    }

    if (!invitation.services || invitation.services.length === 0) {
      throw new Error('Expected invitation to contain at least one service entry')
    }

    const wsServices = invitation.services.filter((service) => service.serviceEndpoint?.endsWith('/didcomm-ws'))
    if (wsServices.length === 0) {
      throw new Error('Expected invitation to contain a /didcomm-ws service endpoint')
    }

    invitation.services = wsServices
    wsServiceEndpoint = wsServices[0].serviceEndpoint as string

    invitationUrl.searchParams.set('oob', Buffer.from(JSON.stringify(invitation), 'utf8').toString('base64url'))
    wsOnlyInvitationUrl = invitationUrl.toString()

    expect(wsServiceEndpoint).to.match(/^ws:\/\/.*\/didcomm-ws$/)
  })

  it('should allow Bob to accept the WS-only invitation URL', async function () {
    const receiveResponse = await bobClient
      .post('/v1/oob/receive-invitation-url')
      .send({
        invitationUrl: wsOnlyInvitationUrl,
        label: 'Bob (Invitee)',
      })
      .expect('Content-Type', /json/)
      .expect(200)

    bobConnectionId = receiveResponse.body.connectionRecord.id
    expect(bobConnectionId).to.be.a('string')
  })

  it('should establish the connection on both Alice and Bob', async function () {
    aliceConnectionId = await waitForConnectionByOob(aliceClient, aliceOobRecordId)

    const aliceState = await waitForConnectionState(aliceClient, aliceConnectionId, 'completed')
    const bobState = await waitForConnectionState(bobClient, bobConnectionId, 'completed')
    expect(aliceState).to.equal('completed')
    expect(bobState).to.equal('completed')
  })

  it('should allow Bob to send a basic message over the established connection', async function () {
    messageContent = `ws didcomm message ${Date.now()}`
    await bobClient.post(`/v1/basic-messages/${bobConnectionId}`).send({ content: messageContent }).expect(204)
  })

  it("should persist the sent basic message on Alice's side", async function () {
    const receivedMessage = await waitForBasicMessageContent(aliceClient, aliceConnectionId, messageContent)
    expect(receivedMessage.content).to.equal(messageContent)
  })
})
