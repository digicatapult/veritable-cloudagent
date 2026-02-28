import { expect } from 'chai'
import { after, afterEach, before, describe, test } from 'mocha'
import { restore as sinonRestore, spy } from 'sinon'

import {
  DidCommBasicMessageEventTypes,
  type DidCommBasicMessageRecord as BasicMessageRecord,
  type DidCommConnectionRecord as ConnectionRecord,
} from '@credo-ts/didcomm'
import { AddressInfo, Server } from 'node:net'
import request from 'supertest'
import type WebSocket from 'ws'

import {
  closeWebSocket,
  deleteAgentStore,
  getTestAgent,
  getTestServer,
  objectToJson,
  openWebSocket,
  type TestAgent,
} from './utils/helpers.js'

describe('BasicMessageController', () => {
  let port: number
  let server: Server
  let socket: WebSocket
  let aliceAgent: TestAgent
  let bobAgent: TestAgent
  let bobConnectionToAlice: ConnectionRecord

  before(async () => {
    aliceAgent = await getTestAgent('Basic Message REST Agent Test Alice', 3002)
    bobAgent = await getTestAgent('Basic Message REST Agent Test Bob', 5034)
    server = await getTestServer(bobAgent)
    port = (server.address() as AddressInfo).port

    const { outOfBandInvitation } = await aliceAgent.didcomm.oob.createInvitation()
    const { outOfBandRecord: bobOOBRecord } = await bobAgent.didcomm.oob.receiveInvitation(outOfBandInvitation, {
      label: 'Bob',
    })

    const [bobConnectionAtBobAlice] = await bobAgent.didcomm.connections.findAllByOutOfBandId(bobOOBRecord.id)
    bobConnectionToAlice = await bobAgent.didcomm.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)
  })

  afterEach(async () => {
    sinonRestore()
    await closeWebSocket(socket)
  })

  describe('Send basic message to connection', () => {
    test('should give 204 no content when message is sent', async () => {
      const response = await request(server)
        .post(`/v1/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(204)
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(server)
        .post(`/v1/basic-messages/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Basic Message WebSocket event', () => {
    test('should return basic message event sent from test agent to clients', async () => {
      socket = await openWebSocket(port)

      const waitForMessagePromise = new Promise((resolve) => {
        socket.on('message', (data) => {
          const event = JSON.parse(data.toString())

          if (event.type === DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged) {
            expect(event.payload.basicMessageRecord.connectionId).to.be.equal(bobConnectionToAlice.id)
            resolve(undefined)
          }
        })
      })

      await request(server).post(`/v1/basic-messages/${bobConnectionToAlice?.id}`).send({ content: 'Hello!' })

      await waitForMessagePromise
    })
  })

  describe('Get basic messages', () => {
    test('should return list of basic messages filtered by connection id', async () => {
      const findAllByQuerySpy = spy(bobAgent.didcomm.basicMessages, 'findAllByQuery')
      const getResult = (): Promise<BasicMessageRecord[]> => findAllByQuerySpy.firstCall.returnValue

      const response = await request(server).get(`/v1/basic-messages/${bobConnectionToAlice.id}`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
      findAllByQuerySpy.restore()
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await deleteAgentStore(aliceAgent)
    await bobAgent.shutdown()
    await deleteAgentStore(bobAgent)
    await closeWebSocket(socket)
    server.close()
  })
})
