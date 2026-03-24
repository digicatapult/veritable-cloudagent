import type { AnonCredsCredentialInfo, AnonCredsProof, AnonCredsProofRequest } from '@credo-ts/anoncreds'
import type { AddressInfo, Server } from 'node:net'
import type {
  AcceptProofProposalOptions,
  CreateProofRequestOptions,
  MatchingCredentialsResponse,
  NegotiateProofProposalOptions,
  ProofFormats,
  ProposeProofOptions,
  RequestProofOptions,
} from '../../src/controllers/types/index.js'

import { expect } from 'chai'
import { after, afterEach, before, describe, test } from 'mocha'
import { restore as sinonRestore, stub } from 'sinon'

import {
  DidCommMessage,
  DidCommProofEventTypes,
  DidCommProofExchangeRecord,
  DidCommProofRole,
  DidCommProofState,
  type DidCommProofFormatPayload,
  type DidCommProofStateChangedEvent,
  type GetProofFormatDataReturn,
} from '@credo-ts/didcomm'

import request from 'supertest'
import type WebSocket from 'ws'
import { redactProofFormats } from '../../src/utils/proofs.js'

import {
  closeWebSocket,
  deleteAgentStore,
  getTestAgent,
  getTestProof,
  getTestProofResponse,
  getTestServer,
  objectToJson,
  openWebSocket,
  type TestAgent,
} from './utils/helpers.js'

describe('ProofController', () => {
  let port: number
  let app: Server
  let socket: WebSocket
  let aliceAgent: TestAgent
  let bobAgent: TestAgent
  let testMessage: DidCommMessage
  let testProof: DidCommProofExchangeRecord
  let testProofResponse: DidCommProofExchangeRecord

  before(async () => {
    aliceAgent = await getTestAgent('Proof REST Agent Test Alice', 3032)
    bobAgent = await getTestAgent('Proof REST Agent Test Bob', 3912)
    app = await getTestServer(bobAgent)
    port = (app.address() as AddressInfo).port

    testProof = getTestProof()
    testProofResponse = getTestProofResponse()
    testMessage = new DidCommMessage()
  })

  afterEach(async () => {
    sinonRestore()
    await closeWebSocket(socket)
  })

  describe('Get all proofs', () => {
    test('should return all proofs', async () => {
      const getAllStub = stub(bobAgent.didcomm.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<DidCommProofExchangeRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/v1/proofs')
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should optionally filter on threadId', async () => {
      const getAllStub = stub(bobAgent.didcomm.proofs, 'getAll')
      getAllStub.resolves([testProof])
      const getResult = (): Promise<DidCommProofExchangeRecord[]> => getAllStub.firstCall.returnValue

      const response = await request(app).get('/v1/proofs').query({ threadId: testProof.threadId })
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(result.map(objectToJson))
    })

    test('should return empty array if nothing found', async () => {
      const getAllStub = stub(bobAgent.didcomm.proofs, 'getAll')
      getAllStub.resolves([testProof])

      const response = await request(app).get('/v1/proofs').query({ threadId: 'aaaaaaaa-aaaa-4aaa-aaaa-222222222222' })

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([])
    })
  })

  describe('Get by proof by id', () => {
    test('should return proof record', async () => {
      const getByIdStub = stub(bobAgent.didcomm.proofs, 'getById')
      getByIdStub.resolves(testProof)

      const getResult = (): Promise<DidCommProofExchangeRecord> => getByIdStub.firstCall.returnValue

      const response = await request(app).get(`/v1/proofs/${testProof.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testProof.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should return proof record with content when includeContent is true', async () => {
      const getByIdStub = stub(bobAgent.didcomm.proofs, 'getById')
      getByIdStub.resolves(testProof)

      const formatData = { proposal: { anoncreds: { attributes: {}, predicates: {} } } }
      const getFormatDataStub = stub(bobAgent.didcomm.proofs, 'getFormatData')
      getFormatDataStub.resolves(formatData as unknown as GetProofFormatDataReturn)

      const getResult = (): Promise<DidCommProofExchangeRecord> => getByIdStub.firstCall.returnValue

      const response = await request(app).get(`/v1/proofs/${testProof.id}`).query({ includeContent: true })

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testProof.id)).equals(true)
      expect(getFormatDataStub.calledWithMatch(testProof.id)).equals(true)

      const expectedBody = {
        ...objectToJson(await getResult()),
        content: formatData,
      }
      expect(response.body).to.deep.equal(expectedBody)
    })

    test('should return 404 not found when proof record not found', async () => {
      const response = await request(app).get(`/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Get proof content', () => {
    test('should return proof content', async () => {
      const formatData = { proposal: { anoncreds: { attributes: {}, predicates: {} } } }
      const getFormatDataStub = stub(bobAgent.didcomm.proofs, 'getFormatData')
      getFormatDataStub.resolves(formatData as unknown as GetProofFormatDataReturn)

      const response = await request(app).get(`/v1/proofs/${testProof.id}/content`)

      expect(response.statusCode).to.be.equal(200)
      expect(getFormatDataStub.calledWithMatch(testProof.id)).equals(true)
      expect(response.body).to.deep.equal(formatData)
    })

    test('should return simplified proof content when view is simplified', async () => {
      const formatData: GetProofFormatDataReturn = {
        request: {
          anoncreds: {
            name: 'proof-request',
            version: '1.0',
            nonce: '1234567890',
            requested_attributes: {
              attr1_referent: { name: 'name', restrictions: [] },
              attr2_referent: { names: ['age', 'gender'], restrictions: [] },
            },
            requested_predicates: {},
          } as unknown as AnonCredsProofRequest,
        },
        presentation: {
          anoncreds: {
            proof: {
              proofs: [],
              aggregated_proof: { c_hash: '', c_list: [] },
            },
            requested_proof: {
              revealed_attrs: {
                attr1_referent: { sub_proof_index: 0, raw: 'Alice', encoded: '123' },
              },
              revealed_attr_groups: {
                attr2_referent: {
                  sub_proof_index: 1,
                  values: {
                    age: { raw: '30', encoded: '30' },
                    gender: { raw: 'Female', encoded: '456' },
                  },
                },
              },
              self_attested_attrs: {},
              unrevealed_attrs: {},
              predicates: {},
            },
            identifiers: [],
          } as unknown as AnonCredsProof,
        },
      }

      const getFormatDataStub = stub(bobAgent.didcomm.proofs, 'getFormatData')
      getFormatDataStub.resolves(formatData)

      const response = await request(app).get(`/v1/proofs/${testProof.id}/content`).query({ view: 'simplified' })

      expect(response.statusCode).to.be.equal(200)
      expect(getFormatDataStub.calledWithMatch(testProof.id)).equals(true)

      const expectedSimplified = {
        name: 'Alice',
        age: '30',
        gender: 'Female',
      }
      expect(response.body).to.deep.equal(expectedSimplified)
    })

    test('should return 404 not found when proof record not found', async () => {
      const response = await request(app).get('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/content')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Get matching credentials for proof request', () => {
    test('should return matching credentials', async () => {
      const credentials: MatchingCredentialsResponse = {
        proofFormats: {
          anoncreds: {
            attributes: {
              referent1: [
                {
                  credentialId: 'test-credential-id',
                  revealed: true,
                  credentialInfo: {
                    schemaId: 'test-schema-id',
                    credentialDefinitionId: 'test-cred-def-id',
                    attributes: {
                      name: 'Alice',
                      age: '30',
                    },
                    credentialId: 'test-credential-id',
                    revocationRegistryId: null,
                    credentialRevocationId: null,
                    methodName: 'anoncreds',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    linkSecretId: 'test-link-secret-id',
                  },
                },
              ],
            },
          },
        },
      }

      const getCredentialsForRequestStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsForRequestStub.resolves(credentials)

      const response = await request(app).get(`/v1/proofs/${testProof.id}/credentials`)

      expect(response.statusCode).to.be.equal(200)
      expect(getCredentialsForRequestStub.calledWithMatch({ proofExchangeRecordId: testProof.id })).equals(true)
      expect(response.body).to.deep.equal(JSON.parse(JSON.stringify(credentials)))
    })

    test('should return 404 not found when proof record not found', async () => {
      const response = await request(app).get('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/credentials')

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
      const proposeProofStub = stub(bobAgent.didcomm.proofs, 'proposeProof')
      proposeProofStub.resolves(testProof)
      const getResult = (): Promise<DidCommProofExchangeRecord> => proposeProofStub.firstCall.returnValue

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
      const acceptProposalStub = stub(bobAgent.didcomm.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)
      const getResult = (): Promise<DidCommProofExchangeRecord> => acceptProposalStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-proposal`).send(acceptRequest)

      expect(
        acceptProposalStub.calledWithMatch({
          proofExchangeRecordId: testProof.id,
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

    test('should pass through presentation exchange accept-proposal options', async () => {
      const acceptProposalStub = stub(bobAgent.didcomm.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)

      const body: AcceptProofProposalOptions = {
        proofFormats: {
          anoncreds: {
            name: 'proof-name',
            version: '1.0',
          },
          presentationExchange: {
            options: {
              challenge: 'challenge',
              domain: 'domain',
            },
          },
        },
        comment: 'string',
      }

      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-proposal`).send(body)

      expect(response.statusCode).to.be.equal(200)
      expect(
        acceptProposalStub.calledWithMatch({
          proofExchangeRecordId: testProof.id,
          ...body,
        })
      ).equals(true)
    })

    test('should reject anoncreds request-stage payload in accept-proposal (422)', async () => {
      const acceptProposalStub = stub(bobAgent.didcomm.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)

      const response = await request(app)
        .post(`/v1/proofs/${testProof.id}/accept-proposal`)
        .send({
          proofFormats: {
            anoncreds: {
              name: 'proof-name',
              version: '1.0',
              requested_attributes: {
                additionalProp1: {
                  name: 'string',
                },
              },
            },
          },
        })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProposalStub.called).equals(false)
    })

    test('should reject presentation definition in accept-proposal (422)', async () => {
      const acceptProposalStub = stub(bobAgent.didcomm.proofs, 'acceptProposal')
      acceptProposalStub.resolves(testProof)

      const response = await request(app)
        .post(`/v1/proofs/${testProof.id}/accept-proposal`)
        .send({
          proofFormats: {
            presentationExchange: {
              presentationDefinition: {
                id: 'pd-id',
                input_descriptors: [],
              },
            },
          },
        })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProposalStub.called).equals(false)
    })
  })

  describe('Negotiate proof proposal', () => {
    test('should transform anoncreds restrictions and return proof record', async () => {
      const negotiateProposalStub = stub(bobAgent.didcomm.proofs, 'negotiateProposal')
      negotiateProposalStub.resolves(testProof)
      const getResult = (): Promise<DidCommProofExchangeRecord> => negotiateProposalStub.firstCall.returnValue

      const body: NegotiateProofProposalOptions = {
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

      const response = await request(app).post(`/v1/proofs/${testProof.id}/negotiate-proposal`).send(body)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
      expect(
        negotiateProposalStub.calledWithMatch({
          proofExchangeRecordId: testProof.id,
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

    test('should reject presentation exchange proof format with unexpected top-level keys (422)', async () => {
      const negotiateProposalStub = stub(bobAgent.didcomm.proofs, 'negotiateProposal')
      negotiateProposalStub.resolves(testProof)

      // Intentionally bypass DTO typing here: we want to test runtime validation
      // when a client sends unexpected PEX keys.
      const body = {
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'test-id',
              input_descriptors: [],
              unexpected: 'nope',
            },
          },
        },
      } as unknown as NegotiateProofProposalOptions

      const response = await request(app).post(`/v1/proofs/${testProof.id}/negotiate-proposal`).send(body)

      expect(response.statusCode).to.be.equal(422)
      expect(negotiateProposalStub.called).to.equal(false)
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
      const createRequestStub = stub(bobAgent.didcomm.proofs, 'createRequest')
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
      const requestProofStub = stub(bobAgent.didcomm.proofs, 'requestProof')
      requestProofStub.resolves(testProof)
      const getResult = (): Promise<DidCommProofExchangeRecord> => requestProofStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestProofRequest)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should transform proof request attribute restrictions', async () => {
      const requestProofStub = stub(bobAgent.didcomm.proofs, 'requestProof')
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

    test('should pass through presentation exchange proof format', async () => {
      const requestProofStub = stub(bobAgent.didcomm.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      const requestWithPex: RequestProofOptions = {
        connectionId: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000000',
        protocolVersion: 'v2',
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'test-id',
              input_descriptors: [],
            },
          },
        },
      }

      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestWithPex)

      expect(response.statusCode).to.be.equal(200)
      expect(
        requestProofStub.calledWithMatch({
          proofFormats: {
            presentationExchange: {
              presentationDefinition: {
                id: 'test-id',
                input_descriptors: [],
              },
            },
          },
        })
      ).to.equal(true)
    })

    test('should reject presentation exchange proof format with unexpected top-level keys (422)', async () => {
      const requestProofStub = stub(bobAgent.didcomm.proofs, 'requestProof')
      requestProofStub.resolves(testProof)

      // Intentionally bypass DTO typing here: we want to test runtime validation
      // when a client sends unexpected PEX keys.
      const requestWithPex = {
        connectionId: 'aaaaaaaa-aaaa-4aaa-aaaa-000000000000',
        protocolVersion: 'v2',
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'test-id',
              input_descriptors: [],
              unexpected: 'nope',
            },
          },
        },
      } as unknown as RequestProofOptions

      const response = await request(app).post(`/v1/proofs/request-proof`).send(requestWithPex)

      expect(response.statusCode).to.be.equal(422)
      expect(requestProofStub.called).to.equal(false)
    })
  })

  describe('Accept proof request', () => {
    test('should accept proof request', async () => {
      const selectCredentialForRequestStub = stub(bobAgent.didcomm.proofs, 'selectCredentialsForRequest')
      selectCredentialForRequestStub.resolves({ proofFormats: {} })
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')

      acceptProofStub.resolves(testProofResponse)
      const getResult = async (): Promise<DidCommProofExchangeRecord> => await acceptProofStub.firstCall.returnValue

      const response = await request(app).post(`/v1/proofs/${testProofResponse.id}/accept-request`).send({})

      expect(
        acceptProofStub.calledWithMatch({
          proofExchangeRecordId: testProofResponse.id,
        })
      ).equals(true)
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should accept proof request with provided proofFormats', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const getResult = async (): Promise<DidCommProofExchangeRecord> => await acceptProofStub.firstCall.returnValue

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
          proofExchangeRecordId: testProofResponse.id,
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
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body.message).to.equal('Proof format hydration failed')
      expect(response.body.details.errors[0]).to.include(
        "Attribute 'attr1' cannot be revealed. The proof request or credential requires this attribute to be hidden."
      )
    })

    test('should return 404 when simplified proof format requests an attribute that is not available', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const proofFormats = {
        anoncreds: {
          attributes: {
            attr2: { credentialId: 'cred-2', revealed: true }, // Requesting unavailable attribute
          },
          predicates: {},
        },
      }

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({ proofFormats })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes: attr2 (credId: cred-2)'
      )
    })

    test('should return 400 when verifier requests plaintext for an attribute that prover wants to keep secret', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body.message).to.equal('Proof format hydration failed')
      expect(response.body.details.errors[0]).to.include(
        "Attribute 'attr1' cannot be hidden. The proof request or credential requires this attribute to be revealed."
      )
    })

    test('should return 404 when requested credentialId not found in available credentials', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes: attr1 (credId: cred-not-found)'
      )
    })

    test('should return 404 when requested attribute name not in the proof request', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes: nonExistentAttr (credId: cred-1)'
      )
    })

    test('should return 404 when at least one requested credential is not found among available credentials', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested attributes: attr2 (credId: cred-wrong)'
      )
    })

    test('should return 404 when predicate credentialId not found in available credentials', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested predicates: pred1 (credId: cred-not-found)'
      )
    })

    test('should return 404 when requested predicate name not in the proof request', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include(
        'Could not hydrate proof formats: no matching credentials found for requested predicates: nonExistentPred (credId: cred-1)'
      )
    })

    test('should return 400 when format has empty attributes (treated as invalid full format)', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
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
      const selectCredentialForRequestStub = stub(bobAgent.didcomm.proofs, 'selectCredentialsForRequest')
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
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const response = await request(app).post(`/v1/proofs/${testProofResponse.id}/accept-request`).send({})

      expect(response.statusCode).to.be.equal(200)
      expect(selectCredentialForRequestStub.calledOnce).to.equal(true)
    })

    test('should successfully hydrate when same credential is used for both attribute and predicate', async () => {
      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      const sharedCredentialId = 'shared-cred-id'

      getCredentialsStub.resolves({
        proofFormats: {
          anoncreds: {
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
      } as unknown as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
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
      const hydratedFormats = (callArgs.proofFormats as DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>)
        ?.anoncreds
      expect(hydratedFormats?.attributes?.attr1.credentialId).to.equal(sharedCredentialId)
      expect(hydratedFormats?.predicates?.pred1.credentialId).to.equal(sharedCredentialId)
    })

    test('should return 404 when no available credentials found (anoncreds field missing)', async () => {
      const getCredentialsStub = stub(bobAgent.didcomm.proofs, 'getCredentialsForRequest')
      getCredentialsStub.resolves({
        proofFormats: {},
      } as { proofFormats: DidCommProofFormatPayload<ProofFormats, 'getCredentialsForRequest'> })

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
      expect(response.body).to.be.an('object')
      expect(response.body.message).to.include('no available credentials found')
    })

    test('should reject simplified format with credentialInfo in attributes (security check)', async () => {
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
    })

    test('should reject simplified format with extra keys in attributes (security check)', async () => {
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
    })

    test('should reject simplified format with credentialInfo in predicates (security check)', async () => {
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
    })

    test('should return 422 when client supplies presentationExchange credentials for accept-request', async () => {
      const acceptProofStub = stub(bobAgent.didcomm.proofs, 'acceptRequest')
      acceptProofStub.resolves(testProofResponse)

      const response = await request(app)
        .post(`/v1/proofs/${testProofResponse.id}/accept-request`)
        .send({
          proofFormats: {
            presentationExchange: {
              credentials: {
                descriptor1: [{ id: 'record-id-1' }],
              },
            },
          },
        })

      expect(response.statusCode).to.be.equal(422)
      expect(acceptProofStub.called).to.equal(false)
    })

    test('should give 404 not found when proof request is not found', async () => {
      const response = await request(app)
        .post('/v1/proofs/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-request')
        .send({})

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Proof format redaction', () => {
    test('should redact presentationExchange credentials', async () => {
      const redacted = redactProofFormats({
        presentationExchange: {
          credentials: {
            descriptor1: [{ id: 'record-id-1', extra: 'value' }],
          },
        },
      } as unknown as DidCommProofFormatPayload<ProofFormats, 'acceptRequest'>)

      expect(redacted).to.deep.equal({
        presentationExchange: {
          credentials: '[REDACTED]',
        },
      })
    })
  })

  describe('Accept proof presentation', () => {
    test('should return proof record', async () => {
      const acceptPresentationStub = stub(bobAgent.didcomm.proofs, 'acceptPresentation')
      acceptPresentationStub.resolves(testProof)
      const getResult = (): Promise<DidCommProofExchangeRecord> => acceptPresentationStub.firstCall.returnValue
      const response = await request(app).post(`/v1/proofs/${testProof.id}/accept-presentation`)

      expect(
        acceptPresentationStub.calledWithMatch({
          proofExchangeRecordId: testProof.id,
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

      const proofRecord = new DidCommProofExchangeRecord({
        id: 'testest',
        protocolVersion: 'v2',
        state: DidCommProofState.ProposalSent,
        threadId: 'random',
        createdAt: now,
        role: DidCommProofRole.Verifier,
      })

      // Start client and wait for it to be opened
      socket = await openWebSocket(port)

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        socket.on('message', (data) => {
          resolve(JSON.parse(data.toString()))
        })
      )

      bobAgent.events.emit<DidCommProofStateChangedEvent>(bobAgent.context, {
        type: DidCommProofEventTypes.ProofStateChanged,
        payload: {
          previousState: null,
          proofRecord,
        },
      })

      // Wait for event on WebSocket
      const event = await waitForEvent
      expect(event).to.deep.equal({
        type: DidCommProofEventTypes.ProofStateChanged,
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
            role: DidCommProofRole.Verifier,
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
    await deleteAgentStore(aliceAgent)
    await bobAgent.shutdown()
    await deleteAgentStore(bobAgent)
    await closeWebSocket(socket)
    app.close()
  })
})
