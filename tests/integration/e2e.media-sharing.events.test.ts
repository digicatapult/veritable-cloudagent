import { expect } from 'chai'
import { describe, it } from 'mocha'
import request from 'supertest'
import WebSocket from 'ws'
import PinoLogger from '../../src/utils/logger.js'
import { ALICE_BASE_URL, BOB_BASE_URL, OOB_INVITATION_PAYLOAD } from './utils/fixtures.js'
import { sleep, waitForConnectionByOob } from './utils/helpers.js'

const ALICE_WS_URL = ALICE_BASE_URL.replace('http', 'ws')

const logger = new PinoLogger('trace')

// Integration test validating websocket media-sharing events for create/share lifecycle
// Assumes media-sharing module forwards events on topic 'media-sharing' via WebSocket

describe('Media Sharing Events (WS)', function () {
  this.timeout(60000)

  const alice = request(ALICE_BASE_URL)
  const bob = request(BOB_BASE_URL)

  let oobRecordId: string
  let invitationUrl: string
  let aliceConnectionId: string

  interface CapturedEvent {
    type: string
    // raw event object from websocket
    payload: unknown
  }

  const received: CapturedEvent[] = []

  let ws: WebSocket

  it('Connects WebSocket to Alice', function (done) {
    const wsPort = process.env.ALICE_WS_PORT ?? '5003'
    ws = new WebSocket(ALICE_WS_URL.replace('/:\\d+$/', `:${wsPort}`))

    ws.on('open', () => done())
    ws.on('message', (data) => {
      try {
        const evt = JSON.parse(data.toString())
        if (evt?.payload?.mediaSharingRecord) {
          received.push({ type: evt.type ?? evt.payload?.mediaSharingRecord?.state, payload: evt })
        }
      } catch {
        logger.error('Failed to parse WebSocket message', { data })
      }
    })
    ws.on('error', (err) => done(err))
  })

  it('Alice creates invitation', async function () {
    const res = await alice.post('/v1/oob/create-invitation').send(OOB_INVITATION_PAYLOAD).expect(200)

    invitationUrl = res.body.invitationUrl
    oobRecordId = res.body.outOfBandRecord.id
  })

  it('Bob accepts invitation', async function () {
    await bob.post('/v1/oob/receive-invitation-url').send({ invitationUrl }).expect(200)
  })

  it('Alice fetches her connection', async function () {
    aliceConnectionId = await waitForConnectionByOob(alice, oobRecordId)
    expect(aliceConnectionId).to.be.a('string')
  })

  it('Alice shares media to Bob and receives events', async function () {
    const body = {
      connectionId: aliceConnectionId,
      description: 'Spec doc',
      items: [
        {
          uri: 'https://httpbin.org/bytes/8',
          mimeType: 'application/octet-stream',
          description: 'Random bytes',
          fileName: 'bytes.bin',
        },
      ],
    }

    await alice.post('/v1/media/share').send(body).expect(200)

    // Wait/poll for expected events
    const start = Date.now()
    const states: string[] = []
    while (Date.now() - start < 8000) {
      for (const evt of received) {
        const payloadObj = evt.payload as { payload?: { mediaSharingRecord?: { state?: string } } }
        const state = payloadObj?.payload?.mediaSharingRecord?.state
        if (state && !states.includes(state)) states.push(state)
      }
      if (states.includes('init') && states.includes('media-shared')) break
      await sleep(250)
    }

    expect(states, `States captured: ${states.join(',')}`).to.include('init')
    expect(states, `States captured: ${states.join(',')}`).to.include('media-shared')
  })

  it('Closes WebSocket', function () {
    ws.close()
  })
})
