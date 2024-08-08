import type {
  AcceptProofProposalOptions,
  CreateProofRequestOptions,
  ProposeProofOptions,
  RequestProofOptions,
} from '../../src/controllers/types.js'
import type { Agent, ProofStateChangedEvent } from '@credo-ts/core'
import type { AddressInfo, Server } from 'node:net'

import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import { AgentMessage, ProofEventTypes, ProofExchangeRecord, ProofRole, ProofState } from '@credo-ts/core'
import request from 'supertest'
import WebSocket from 'ws'

import { setupServer } from '../../src/server.js'

import { getTestAgent, getTestProof, getTestProofResponse, getTestServer, objectToJson } from './utils/helpers.js'

describe('ProofController', () => {
  let port: number
  let app: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let testMessage: AgentMessage
  let testProof: ProofExchangeRecord
  let testProofResponse: ProofExchangeRecord

  before(async () => {
    aliceAgent = await getTestAgent('Proof REST Agent Test Alice', 3032)
    bobAgent = await getTestAgent('Proof REST Agent Test Bob', 3912)
    app = await getTestServer(bobAgent)
    port = (app.address() as AddressInfo).port

    testProof = getTestProof()
    testProofResponse = getTestProofResponse()
    testMessage = new AgentMessage()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Get all proofs', () => {
    test('should return all proofs', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<ProofExchangeRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/v1/proofs')
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should optionally filter on threadId', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<ProofExchangeRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/v1/proofs').query({ threadId: testProof.threadId })
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should return empty array if nothing found', async () => {
      const getAllStub = stub(bobAgent.proofs, 'getAll')
      getAllStub.resolves([testProof])

      const response = await request(app).get('/v1/proofs').query({ threadId: 'string' })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([])
    })
  })

  describe('Get by proof by id', () => {
    test('should return proof record', async () => {
      const getByIdStub = stub(bobAgent.proofs, 'getById')
      getByIdStub.resolves(testProof)
      const getResult = (): Promise<ProofExchangeRecord> => getByIdStub.firstCall.returnValue

      const response = await request(app).get(`/v1/proofs/${testProof.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testProof.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should return 404 not found when proof record not found', async () => {
      const response = await request(app).get(`/v1/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Delete proof by id', () => {
    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).delete('/v1/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Propose proof', () => {
    const proposalRequest: ProposeProofOptions = {
      connectionId: '123456aa-aa78-90a1-aa23-456a7da89010',
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          attributes: [
            {
              name: 'test',
              credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            },
          ],
          predicates: [],
        },
      },
      comment: 'test',
    }
    test('should return proof record', async () => {
      const proposeProofStub = stub(bobAgent.proofs, 'proposeProof')
      proposeProofStub.resolves(testProof)
      const getResult = (): Promise<ProofExchangeRecord> => proposeProofStub.firstCall.returnValue

      const response = await request(app).post('/v1/proofs/propose-proof').send(proposalRequest)

      expect(proposeProofStub.calledWithMatch(proposalRequest)).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).post('/v1/proofs/propose-proof').send(proposalRequest)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept proof proposal', () => {
    const acceptRequest: AcceptProofProposalOptions = {
      proofFormats: {
        anoncreds: {
          name: 'string',
          version: 'string',
        },
      },
      comment: 'string',
    }

    test('should return proof record', async () => {
      const acceptProposalStub = stub(bobAgent.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)
      const getResult = (): Promise<ProofExchangeRecord> => acceptProposalStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-proposal`).send(acceptRequest)

      expect(
        acceptProposalStub.calledWithMatch({
          proofRecordId: testProof.id,
          ...acceptRequest,
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-proposal`).send(acceptRequest)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Request out of band proof', () => {
    const proofRequest: CreateProofRequestOptions = {
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          name: 'string',
          version: '1.0',
          requested_attributes: {
            additionalProp1: {
              name: 'string',
            },
          },
        },
      },
    }

    test('should return proof record', async () => {
      const mockValue = { message: testMessage, proofRecord: testProof }
      const createRequestStub = stub(bobAgent.proofs, 'createRequest')
      createRequestStub.resolves(mockValue)
      const getResult = (): Promise<typeof mockValue> => createRequestStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/create-request`).send(proofRequest)

      expect(response.statusCode).to.equal(200)

      const result = await getResult()
      expect(response.body.message).to.deep.equal(objectToJson(result.message))
      expect(response.body.proofRecord).to.deep.equal(objectToJson(result.proofRecord))
    })
  })

  describe('Request proof', () => {
    const requestProofRequest: RequestProofOptions = {
      connectionId: 'string',
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          name: 'string',
          version: '1.0',
          requested_attributes: {
            additionalProp1: {
              name: 'string',
            },
          },
        },
      },
    }
    const requestProofRequestWithAttr: RequestProofOptions = {
      connectionId: 'string',
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          name: 'string',
          version: '1.0',
          requested_attributes: {
            additionalProp1: {
              name: 'string',
              restrictions: [
                {
                  attributeMarkers: { a: true, b: false },
                  attributeValues: { c: 'd', e: 'f' },
                },
              ],
            },
          },
        },
      },
    }

    test('should return proof record', async () => {
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)
      const getResult = (): Promise<ProofExchangeRecord> => requestProofStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestProofRequest)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should transform proof request attribute restrictions', async () => {
      const requestProofStub = stub(bobAgent.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestProofRequestWithAttr)

      expect(response.statusCode).to.be.equal(200)
      expect(
        requestProofStub.calledWithMatch({
          connectionId: 'string',
          protocolVersion: 'v2',
          proofFormats: {
            anoncreds: {
              name: 'string',
              version: '1.0',
              requested_attributes: {
                additionalProp1: {
                  name: 'string',
                  restrictions: [
                    {
                      'attr::a::marker': '1',
                      'attr::b::marker': '0',
                      'attr::c::value': 'd',
                      'attr::e::value': 'f',
                    },
                  ],
                },
              },
            },
          },
        })
      ).equals(true)
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestProofRequest)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept proof request', () => {
    test('should accept proof request', async () => {
      const selectCredentialForRequestStub = stub(bobAgent.proofs, 'selectCredentialsForRequest')
      selectCredentialForRequestStub.resolves({ proofFormats: {} })
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')

      acceptProofStub.resolves(testProofResponse)
      const getResult = async (): Promise<ProofExchangeRecord> => await acceptProofStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/${testProofResponse.id}/accept-request`)

      expect(
        acceptProofStub.calledWithMatch({
          proofRecordId: testProofResponse.id,
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when proof request is not found', async () => {
      const selectCredentialForRequestStub = stub(bobAgent.proofs, 'selectCredentialsForRequest')
      selectCredentialForRequestStub.resolves({ proofFormats: {} })
      const response = await request(app).post('/v1/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-request')

      expect(response.statusCode).to.be.equal(404)
    })
  })
  describe('Accept proof presentation', () => {
    test('should return proof record', async () => {
      const acceptPresentationStub = stub(bobAgent.proofs, 'acceptPresentation')
      acceptPresentationStub.resolves(testProof)
      const getResult = (): Promise<ProofExchangeRecord> => acceptPresentationStub.firstCall.returnValue
      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-presentation`)

      expect(
        acceptPresentationStub.calledWithMatch({
          proofRecordId: testProof.id,
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).post('/v1/proofs/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-presentation')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Proof WebSocket event', () => {
    test('should return proof event sent from test agent to websocket client', async () => {
      const now = new Date()

      const proofRecord = new ProofExchangeRecord({
        id: 'testest',
        protocolVersion: 'v2',
        state: ProofState.ProposalSent,
        threadId: 'random',
        createdAt: now,
        role: ProofRole.Verifier,
      })

      // Start client and wait for it to be opened
      const client = new WebSocket(`ws://localhost:${port}`)
      await new Promise((resolve) => client.once('open', resolve))

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        client.on('message', (data) => {
          client.terminate()
          resolve(JSON.parse(data.toString()))
        })
      )

      bobAgent.events.emit<ProofStateChangedEvent>(bobAgent.context, {
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
            protocolVersion: 'v2',
            createdAt: now.toISOString(),
            state: 'proposal-sent',
            threadId: 'random',
            role: ProofRole.Verifier,
          },
        },
        metadata: {
          contextCorrelationId: 'default',
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
