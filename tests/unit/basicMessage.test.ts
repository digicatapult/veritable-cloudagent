/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { spy, restore as sinonRestore } from 'sinon'

import type { Agent, BasicMessageRecord, ConnectionRecord } from '@credo-ts/core'

import { AddressInfo, Server } from 'node:net'
import { BasicMessageEventTypes } from '@credo-ts/core'
import request from 'supertest'
import WebSocket from 'ws'

import { getTestAgent, getTestServer, objectToJson } from './utils/helpers.js'

describe('BasicMessageController', () => {
  let port: number
  let server: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let bobConnectionToAlice: ConnectionRecord

  before(async () => {
    aliceAgent = await getTestAgent('Basic Message REST Agent Test Alice', 3002)
    bobAgent = await getTestAgent('Basic Message REST Agent Test Bob', 5034)
    server = await getTestServer(bobAgent)
    port = (server.address() as AddressInfo).port

    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation()
    const { outOfBandRecord: bobOOBRecord } = await bobAgent.oob.receiveInvitation(outOfBandInvitation)

    const [bobConnectionAtBobAlice] = await bobAgent.connections.findAllByOutOfBandId(bobOOBRecord.id)
    bobConnectionToAlice = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)
  })

  afterEach(() => {
    sinonRestore()
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
        .post(`/v1/basic-messages/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Basic Message WebSocket event', () => {
    test('should return basic message event sent from test agent to clients', async () => {
      const client = new WebSocket(`ws://localhost:${port}`)

      const waitForMessagePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const event = JSON.parse(data.toString())

          if (event.type === BasicMessageEventTypes.BasicMessageStateChanged) {
            expect(event.payload.basicMessageRecord.connectionId).to.be.equal(bobConnectionToAlice.id)
            client.terminate()
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
      const findAllByQuerySpy = spy(bobAgent.basicMessages, 'findAllByQuery')
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
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    server.close()
  })
})
