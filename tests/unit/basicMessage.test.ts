/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { spy, stub, restore as sinonRestore } from 'sinon'

import type { Agent, BasicMessageRecord, ConnectionRecord, ProofStateChangedEvent } from '@credo-ts/core'
import type { Server } from 'net'

import { BasicMessageEventTypes, ProofEventTypes, ProofExchangeRecord, ProofRole, ProofState } from '@credo-ts/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../../src/index.js'
import { getRequestProof, getTestAgent, getTestProof, getTestSchema, objectToJson } from './utils/helpers.js'

describe('BasicMessageController', () => {
  let server: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let bobConnectionToAlice: ConnectionRecord
  let credDefId: string

  const testSchema = getTestSchema()

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
    sinonRestore()
  })

  describe('Send basic message to connection', () => {
    test('should give 204 no content when message is sent', async () => {
      const response = await request(server)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).to.be.equal(204)
    })

    test('should give 204 no content when message a verified agent', async () => {
      const testProof = getTestProof()
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      setTimeout(
        () =>
          bobAgent.events.emit<ProofStateChangedEvent>(bobAgent.context, {
            type: ProofEventTypes.ProofStateChanged,
            payload: {
              previousState: null,
              proofRecord: new ProofExchangeRecord({
                id: testProof.id,
                protocolVersion: 'v2',
                state: ProofState.Done,
                threadId: 'random',
                role: ProofRole.Verifier,
                isVerified: true,
              }),
            },
          }),
        500
      )

      const response = await request(server)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!', requestProof: getRequestProof(), timeoutMs: 1000 })

      expect(response.statusCode).to.be.equal(204)
    })

    test('should give 500 when proof verification times out', async () => {
      const testProof = getTestProof()
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      // intentionally don't emit a proof event

      const response = await request(server)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!', requestProof: getRequestProof(), timeoutMs: 1000 })

      expect(response.statusCode).to.be.equal(500)
      expect(response.body).to.contain('timed out')
    })

    test('should give 400 when attempt to message an unverified agent ', async () => {
      const testProof = getTestProof()
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      setTimeout(
        () =>
          bobAgent.events.emit<ProofStateChangedEvent>(bobAgent.context, {
            type: ProofEventTypes.ProofStateChanged,
            payload: {
              previousState: null,
              proofRecord: new ProofExchangeRecord({
                id: testProof.id,
                protocolVersion: 'v2',
                state: ProofState.Done,
                threadId: 'random',
                role: ProofRole.Verifier,
                isVerified: false,
              }),
            },
          }),
        500
      )

      const response = await request(server)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!', requestProof: getRequestProof(), timeoutMs: 1000 })

      expect(response.statusCode).to.be.equal(400)
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
    test('should return list of basic messages filtered by connection id', async () => {
      const findAllByQuerySpy = spy(bobAgent.basicMessages, 'findAllByQuery')
      const getResult = (): Promise<BasicMessageRecord[]> => findAllByQuerySpy.firstCall.returnValue

      const response = await request(server).get(`/basic-messages/${bobConnectionToAlice.id}`)
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
