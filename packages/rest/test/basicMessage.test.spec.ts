/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'

import type { Agent, BasicMessageRecord, ConnectionRecord } from '@aries-framework/core'
import type { Server } from 'net'

import { BasicMessageEventTypes } from '@aries-framework/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../src'

import { getTestAgent, objectToJson } from './utils/helpers'

// STUFF
// class Paulius {
//   getText(txt: string) {
//     return 'text' + txt
//   }
// }

describe('BasicMessageController', () => {
  let server: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let bobConnectionToAlice: ConnectionRecord

  // const pauliusInstance = new Paulius()

  before(async () => {
    aliceAgent = await getTestAgent('Basic Message REST Agent Test Alice', 3002)
    bobAgent = await getTestAgent('Basic Message REST Agent Test Bob', 5034)
    server = await startServer(bobAgent, { port: 5033 })

    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation()
    const { outOfBandRecord: bobOOBRecord } = await bobAgent.oob.receiveInvitation(outOfBandInvitation)

    const [bobConnectionAtBobAlice] = await bobAgent.connections.findAllByOutOfBandId(bobOOBRecord.id)
    bobConnectionToAlice = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('Send basic message to connection', () => {
    test('should give 204 no content when message is sent', async () => {
      const response = await request(server)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(204)
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(server)
        .post(`/basic-messages/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Basic Message WebSocket event', () => {
    test('should return basic message event sent from test agent to clients', async () => {
      const client = new WebSocket('ws://localhost:5033')

      const waitForMessagePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const event = JSON.parse(data as string)

          if (event.type === BasicMessageEventTypes.BasicMessageStateChanged) {
            expect(event.payload.basicMessageRecord.connectionId).to.be.equal(bobConnectionToAlice.id)
            client.terminate()
            resolve(undefined)
          }
        })

      })

      await request(server).post(`/basic-messages/${bobConnectionToAlice?.id}`).send({ content: 'Hello!' })

      await waitForMessagePromise
    })
  })

  describe('Get basic messages', () => {
    test('should return list of basic messages filtered by connection id1', async () => {
      const spy = sinon.spy(bobAgent.basicMessages, 'findAllByQuery')
      const getResult = (): Promise<BasicMessageRecord[]> => spy.firstCall.returnValue

      const response = await request(server).get(`/basic-messages/${bobConnectionToAlice.id}`)
      const result = await getResult()

      // console.log('EXAMPLE')
      // const getTextStub = sinon.stub(pauliusInstance, 'getText')
      // getTextStub.returns('andyText') //
      // 
      // const p = pauliusInstance.getText('myText')
      // 
      // console.log(typeof getTextStub)
      // expect(getTextStub.firstCall.args[0]).to.equal('myText')
      // expect(p).to.equal('andyText')
      // console.log('END_EXAMPLE')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
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
