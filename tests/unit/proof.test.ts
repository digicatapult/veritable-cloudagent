import type { AnonCredsCredentialInfo, AnonCredsGetCredentialsForProofRequestOptions } from '@credo-ts/anoncreds'
import type { AddressInfo, Server } from 'node:net'
import type {
  AcceptProofProposalOptions,
  CreateProofRequestOptions,
  ProofFormats,
  ProposeProofOptions,
  RequestProofOptions,
} from '../../src/controllers/types.js'

import { expect } from 'chai'
import { after, afterEach, before, describe, test } from 'mocha'
import { restore as sinonRestore, stub } from 'sinon'

import {
  AgentMessage,
  ProofEventTypes,
  ProofExchangeRecord,
  ProofRole,
  ProofState,
  RecordNotFoundError,
  V2ProposePresentationMessage,
  type Agent,
  type ProofFormatPayload,
  type ProofStateChangedEvent,
} from '@credo-ts/core'

import request from 'supertest'
import WebSocket from 'ws'

import {
  closeWebSocket,
  getTestAgent,
  getTestProof,
  getTestProofResponse,
  getTestServer,
  objectToJson,
  openWebSocket,
} from './utils/helpers.js'

describe('ProofController', () => {
  let port: number
  let app: Server
  let socket: WebSocket
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

  afterEach(async () => {
    sinonRestore()
    await closeWebSocket(socket)
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

      const response = await request(app).get('/v1/proofs').query({ threadId: 'aaaaaaaa-aaaa-4aaa-aaaa-222222222222' })

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
      const response = await request(app).get(`/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Get proposal message', () => {
    test('should return proposal message', async () => {
      const mockMessage = new V2ProposePresentationMessage({
        formats: [],
        proposalAttachments: [],
        id: '123',
      })
      mockMessage.toJSON = () => ({ '@type': 'proposal', '@id': '123' })

      const findProposalMessageStub = stub(bobAgent.proofs, 'findProposalMessage')
      findProposalMessageStub.resolves(Promise.resolve(mockMessage))

      const response = await request(app).get(`/v1/proofs/${testProof.id}/proposal-message`)

      expect(response.statusCode).to.be.equal(200)
      expect(findProposalMessageStub.calledWithMatch(testProof.id)).equals(true)
      expect(response.body).to.deep.equal({ '@type': 'proposal', '@id': '123' })
    })

    test('should return 404 not found when proposal message not found', async () => {
      const findProposalMessageStub = stub(bobAgent.proofs, 'findProposalMessage')
      findProposalMessageStub.resolves(Promise.resolve(null))

      const response = await request(app).get(`/v1/proofs/${testProof.id}/proposal-message`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Delete proof by id', () => {
    test('should give 404 not found when proof is not found', async () => {
      const response = await request(app).delete('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Propose proof', () => {
    const proposalRequest: ProposeProofOptions = {
      connectionId: '123456aa-aa78-40a1-aa23-456a7da89010',
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
      connectionId: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000000',
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
      connectionId: 'aaaaaaaa-aaaa-4aaa-aaaa-111111111111',
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
          connectionId: 'aaaaaaaa-aaaa-4aaa-aaaa-111111111111',
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

      const response = await request(app).post(`/v1/proofs/${testProofResponse.id}/accept-request`).send({})

      expect(
        acceptProofStub.calledWithMatch({
          proofRecordId: testProofResponse.id,
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should accept proof request with provided proofFormats', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const getResult = async (): Promise<ProofExchangeRecord> => await acceptProofStub.firstCall.returnValue

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(
        acceptProofStub.calledWithMatch({
          proofRecordId: testProofResponse.id,
          // We expect the hydrated format here
          proofFormats: {
            anoncreds: {
              attributes: {
                attr1: {
                  credentialId: 'cred-1',
                  revealed: true,
                  credentialInfo: { credentialId: 'cred-1' },
                },
              },
              predicates: {},
              selfAttestedAttributes: {},
            },
          },
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should return 400 when prover tries to reveal an attribute that verifier wants proven in secret', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: false, // Must be unrevealed
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true }, // Trying to reveal
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(400)
      expect(response.body).to.include(
        "Attribute 'attr1' cannot be revealed. The proof request or credential requires this attribute to be hidden (Zero-Knowledge Proof)."
      )
    })

    test('should return 400 when verifier requests plaintext for an attribute that prover wants to keep secret', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true, // Verifier wants reveal
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: false }, // Prover wants secret
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(400)
      expect(response.body).to.include(
        "Attribute 'attr1' cannot be hidden. The proof request requires this attribute to be revealed."
      )
    })

    test('should return 404 when requested credentialId not found in available credentials', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-different',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-different',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-not-found', revealed: true },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
      )
    })

    test('should return 404 when requested attribute name not in the proof request', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            nonExistentAttr: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
      )
    })

    test('should return 404 when at least one requested credential is not found among available credentials', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
                attr2: [
                  {
                    credentialId: 'cred-2',
                    revealed: false,
                    credentialInfo: {
                      credentialId: 'cred-2',
                      attributes: {},
                      schemaId: 'schema-id-2',
                      credentialDefinitionId: 'cred-def-id-2',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
            attr2: { credentialId: 'cred-wrong', revealed: false },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
      )
    })

    test('should return 404 when predicate credentialId not found in available credentials', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {
                pred1: [
                  {
                    credentialId: 'cred-pred-1',
                    credentialInfo: {
                      credentialId: 'cred-pred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {
            pred1: { credentialId: 'cred-not-found' },
          },
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
      )
    })

    test('should return 404 when requested predicate name not in the proof request', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            input: {} as unknown as AnonCredsGetCredentialsForProofRequestOptions,
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: 'cred-1',
                    revealed: true,
                    credentialInfo: {
                      credentialId: 'cred-1',
                      attributes: {},
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {},
            },
          },
        },
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {
            nonExistentPred: { credentialId: 'cred-1' },
          },
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes or predicates'
      )
    })

    test('should return 400 when format has empty attributes (treated as invalid full format)', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.rejects(new Error('Invalid proof format'))

      const proofFormats = {
        anoncreds: {
          attributes: {},
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      // Empty attributes/predicates is not recognized as simplified format
      // and is treated as full format, which fails at acceptRequest validation
      expect(response.statusCode).to.be.equal(400)
    })

    test('should return 422 when attribute is missing credentialId', async () => {
      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { revealed: true },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
    })

    test('should return 422 when attribute is missing revealed field', async () => {
      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1' },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
    })

    test('should return 422 when predicate is missing credentialId', async () => {
      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {
            pred1: {},
          },
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
    })

    test('should use auto-selection when proofFormats is not provided', async () => {
      const selectCredentialForRequestStub = stub(bobAgent.proofs, 'selectCredentialsForRequest')
      selectCredentialForRequestStub.resolves({
        proofFormats: {
          anoncreds: {
            attributes: {
              attr1: {
                credentialId: 'auto-selected-cred',
                revealed: true,
                credentialInfo: {
                  credentialId: 'auto-selected-cred',
                  attributes: {},
                  schemaId: 'schema-id',
                  credentialDefinitionId: 'cred-def-id',
                  revocationRegistryId: null,
                  credentialRevocationId: null,
                  methodName: 'method',
                } as unknown as AnonCredsCredentialInfo,
              },
            },
            predicates: {},
            selfAttestedAttributes: {},
          },
        },
      })
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const response = await request(app).post(`/v1/proofs/${testProofResponse.id}/accept-request`).send({})

      expect(response.statusCode).to.be.equal(200)
      expect(selectCredentialForRequestStub.calledOnce).to.equal(true)
    })

    test('should successfully hydrate when same credential is used for both attribute and predicate', async () => {
      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      const sharedCredentialId = 'shared-cred-id'

      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
            output: {
              attributes: {
                attr1: [
                  {
                    credentialId: sharedCredentialId,
                    revealed: true,
                    credentialInfo: {
                      credentialId: sharedCredentialId,
                      attributes: { attr1: 'value' },
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
              predicates: {
                pred1: [
                  {
                    credentialId: sharedCredentialId,
                    credentialInfo: {
                      credentialId: sharedCredentialId,
                      attributes: { attr1: 'value', pred1: 10 },
                      schemaId: 'schema-id',
                      credentialDefinitionId: 'cred-def-id',
                      revocationRegistryId: null,
                      credentialRevocationId: null,
                      methodName: 'method',
                    } as unknown as AnonCredsCredentialInfo,
                  },
                ],
              },
            },
          },
        },
      } as unknown as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: sharedCredentialId, revealed: true },
          },
          predicates: {
            pred1: { credentialId: sharedCredentialId },
          },
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(200)
      expect(getCredentialsStub.calledOnce).to.equal(true)
      expect(acceptProofStub.calledOnce).to.equal(true)

      // Verify that acceptRequest was called with the hydrated formats containing the same credential info
      const callArgs = acceptProofStub.firstCall.args[0]
      const hydratedFormats = (callArgs.proofFormats as ProofFormatPayload<ProofFormats, 'acceptRequest'>)?.anoncreds
      expect(hydratedFormats?.attributes?.attr1.credentialId).to.equal(sharedCredentialId)
      expect(hydratedFormats?.predicates?.pred1.credentialId).to.equal(sharedCredentialId)
    })

    test('should return 404 when no available credentials found (anoncreds field missing)', async () => {
      const getCredentialsStub = stub(bobAgent.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {},
      } as { proofFormats: ProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: { credentialId: 'cred-1', revealed: true },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.be.a('string')
      expect(response.body).to.include('no available credentials found')
    })

    test('should reject simplified format with credentialInfo in attributes (security check)', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.rejects(new Error('Invalid proof format'))

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: {
              credentialId: 'cred-1',
              revealed: true,
              credentialInfo: { some: 'data' },
            },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProofStub.called).to.equal(false)
    })

    test('should reject simplified format with extra keys in attributes (security check)', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.rejects(new Error('Invalid proof format'))

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr1: {
              credentialId: 'cred-1',
              revealed: true,
              extraKey: 'should-not-be-here',
            },
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProofStub.called).to.equal(false)
    })

    test('should reject simplified format with credentialInfo in predicates (security check)', async () => {
      const acceptProofStub = stub(bobAgent.proofs, 'acceptRequest')
      acceptProofStub.rejects(new Error('Invalid proof format'))

      const proofFormats = {
        anoncreds: {
          attributes: {},
          predicates: {
            pred1: {
              credentialId: 'cred-1',
              credentialInfo: { some: 'data' },
            },
          },
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProofStub.called).to.equal(false)
    })

    test('should give 404 not found when proof request is not found', async () => {
      const selectCredentialForRequestStub = stub(bobAgent.proofs, 'selectCredentialsForRequest')
      selectCredentialForRequestStub.resolves({ proofFormats: {} })
      const response = await request(app)
        .post('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-request')
        .send({})

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Get proposal message', () => {
    test('should return proposal message', async () => {
      const findProposalMessageStub = stub(bobAgent.proofs, 'findProposalMessage')
      const mockMessage = new V2ProposePresentationMessage({
        formats: [],
        proposalAttachments: [],
        id: '123',
      })
      mockMessage.toJSON = () => ({ '@type': 'proposal', '@id': '123' })
      findProposalMessageStub.resolves(Promise.resolve(mockMessage))

      const response = await request(app).get(`/v1/proofs/${testProofResponse.id}/proposal-message`)

      expect(findProposalMessageStub.calledWith(testProofResponse.id)).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal({ '@type': 'proposal', '@id': '123' })
    })

    test('should return 404 when proposal message not found', async () => {
      const findProposalMessageStub = stub(bobAgent.proofs, 'findProposalMessage')
      findProposalMessageStub.resolves(Promise.resolve(null))

      const response = await request(app).get(`/v1/proofs/${testProofResponse.id}/proposal-message`)

      expect(response.statusCode).to.be.equal(404)
    })

    test('should return 404 when proof record not found', async () => {
      const findProposalMessageStub = stub(bobAgent.proofs, 'findProposalMessage')
      findProposalMessageStub.rejects(
        new RecordNotFoundError('Proof record not found', { recordType: 'ProofExchangeRecord' })
      )

      const response = await request(app).get(`/v1/proofs/${testProofResponse.id}/proposal-message`)

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
      const response = await request(app).post('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-presentation')

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
      socket = await openWebSocket(port)

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        socket.on('message', (data) => {
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
    await closeWebSocket(socket)
    app.close()
  })
})
