import { describe, before, beforeEach, after, afterEach, test } from 'mocha'
import { expect, use as chaiUse, Assertion as assertion } from 'chai'
import chaiAssertionsCount from 'chai-assertions-count'
import { stub, match, restore as sinonRestore } from 'sinon'

import type { Agent, ProofStateChangedEvent } from '@aries-framework/core'
import type { Server } from 'net'

import { ProofEventTypes, ProofRecord, ProofState } from '@aries-framework/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../src'

import { getTestAgent, getTestProof, objectToJson } from './utils/helpers'

chaiUse(chaiAssertionsCount)

describe('ProofController', () => {
  let app: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let testProof: ProofRecord

  before(async () => {
    aliceAgent = await getTestAgent('Proof REST Agent Test Alice', 3032)
    bobAgent = await getTestAgent('Proof REST Agent Test Bob', 3912)
    app = await startServer(bobAgent, { port: 3033 })

    testProof = getTestProof()
  })

  beforeEach(() => {
    assertion.resetAssertsCheck()
  })

  afterEach(() => {
    sinonRestore()

    assertion.checkExpectsCount()
  })

  describe('Get all proofs', () => {
    test('should return all proofs', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<ProofRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/proofs')
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should optionally filter on threadId', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<ProofRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/proofs').query({ threadId: testProof.threadId })
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should return empty array if nothing found', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])

      const response = await request(app).get('/proofs').query({ threadId: 'string' })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([])
    })
  })

  describe('Get by proof by id', () => {
    test('should return proof record', async () => {
      const getByIdStub = stub(bobAgent.proofs, 'getById')
      getByIdStub.resolves(testProof)
      const getResult = (): Promise<ProofRecord> => getByIdStub.firstCall.returnValue

      const response = await request(app).get(`/proofs/${testProof.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testProof.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should return 404 not found when proof record not found', async () => {
      const response = await request(app).get(`/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Delete proof by id', () => {
    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).delete('/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Propose proof', () => {
    const proposalRequest = {
      connectionId: '123456aa-aa78-90a1-aa23-456a7da89010',
      attributes: [
        {
          name: 'test',
          credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
        },
      ],
      predicates: [],
      comment: 'test',
    }

    test('should return proof record', async () => {
      const proposeProofStub = stub(bobAgent.proofs, 'proposeProof')
      proposeProofStub.resolves(testProof)
      const getResult = (): Promise<ProofRecord> => proposeProofStub.firstCall.returnValue

      const response = await request(app).post('/proofs/propose-proof').send(proposalRequest)

      expect(proposeProofStub.calledWith(
        match(proposalRequest.connectionId),
        match.hasNested('attributes[0].credentialDefinitionId', 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test'),
        match.has('comment', proposalRequest.comment)
      )).equals(true)

      // expect(proposeProofStub.calledWith(
        // match(proposalRequest.connectionId),
        // match.hasNested('attributes[0]', match(proposalRequest.attributes[0])),
        // match({ comment: proposalRequest.comment })
      // )).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).post('/proofs/propose-proof').send(proposalRequest)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept proof proposal', () => {
    const acceptRequest = {
      request: {
        name: 'string',
        version: 'string',
        nonce: 'string',
      },
      comment: 'string',
    }

    test('should return proof record', async () => {
      const acceptProposalStub = stub(bobAgent.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)
      const getResult = (): Promise<ProofRecord> => acceptProposalStub.firstCall.returnValue

      const response = await request(app).post(`/proofs/${testProof.id}/accept-proposal`).send(acceptRequest)

      expect(acceptProposalStub.calledWith(
        match(testProof.id),
        match.has('request', acceptRequest.request)
      )).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).post(`/proofs/${testProof.id}/accept-proposal`).send(acceptRequest)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Request out of band proof', () => {
    test('should return proof record', async () => {
      const response = await request(app)
        .post(`/proofs/request-outofband-proof`)
        .send({
          proofRequestOptions: {
            name: 'string',
            version: '1.0',
            requestedAttributes: {
              additionalProp1: {
                name: 'string',
              },
            },
          },
        })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body.proofUrl).to.not.be.undefined
      expect(response.body.proofRecord).to.not.be.undefined
    })
  })

  describe('Request proof', () => {
    test('should return proof record', async () => {
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)
      const getResult = (): Promise<ProofRecord> => requestProofStub.firstCall.returnValue

      const response = await request(app)
        .post(`/proofs/request-proof`)
        .send({
          connectionId: 'string',
          proofRequestOptions: {
            name: 'string',
            version: '1.0',
            requestedAttributes: {
              additionalProp1: {
                name: 'string',
              },
            },
            requestedPredicates: {},
          },
        })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app)
        .post(`/proofs/request-proof`)
        .send({
          connectionId: 'string',
          proofRequestOptions: {
            name: 'string',
            version: '1.0',
            requestedAttributes: {
              additionalProp1: {
                name: 'string',
              },
            },
            requestedPredicates: {},
          },
        })

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept proof presentation', () => {
    test('should return proof record', async () => {
      const acceptPresentationStub = stub(bobAgent.proofs, 'acceptPresentation')
      acceptPresentationStub.resolves(testProof)
      const getResult = (): Promise<ProofRecord> => acceptPresentationStub.firstCall.returnValue

      const response = await request(app).post(`/proofs/${testProof.id}/accept-presentation`)

      expect(acceptPresentationStub.calledWith(testProof.id)).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).post('/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-presentation')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Proof WebSocket event', () => {
    test('should return proof event sent from test agent to websocket client', async () => {
      assertion.expectExpects(1)

      const now = new Date()

      const proofRecord = new ProofRecord({
        id: 'testest',
        state: ProofState.ProposalSent,
        threadId: 'random',
        createdAt: now,
      })

      // Start client and wait for it to be opened
      const client = new WebSocket('ws://localhost:3033')
      await new Promise((resolve) => client.once('open', resolve))

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        client.on('message', (data) => {
          client.terminate()
          resolve(JSON.parse(data as string))
        })
      )

      bobAgent.events.emit<ProofStateChangedEvent>({
        type: ProofEventTypes.ProofStateChanged,
        payload: {
          previousState: null,
          proofRecord,
        },
      })

      // Wait for event on WebSocket
      const event = await waitForEvent
      expect(event).to.deep.equal({
        type: 'ProofStateChanged',
        payload: {
          previousState: null,
          proofRecord: {
            _tags: {},
            metadata: {},
            id: 'testest',
            createdAt: now.toISOString(),
            state: 'proposal-sent',
            threadId: 'random',
          },
        },
      })
    })
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    app.close()
  })
})
