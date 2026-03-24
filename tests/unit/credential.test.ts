import type { AnonCredsDidCommCredentialFormat } from '@credo-ts/anoncreds'
import { JsonTransformer } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommCredentialEventTypes,
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommCredentialPreviewAttribute,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommMessage,
  type DidCommConnectionRecord,
  type DidCommCredentialStateChangedEvent,
  type DidCommOutOfBandRecord,
  type GetCredentialFormatDataReturn,
} from '@credo-ts/didcomm'
import { expect } from 'chai'
import { after, afterEach, before, describe, test } from 'mocha'
import type { AddressInfo, Server } from 'node:net'
import { restore as sinonRestore, stub } from 'sinon'
import request from 'supertest'
import type WebSocket from 'ws'

import type {
  AcceptCredentialProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
} from '../../src/controllers/types/index.js'
import {
  closeWebSocket,
  deleteAgentStore,
  getCredentialFormatData,
  getTestAgent,
  getTestConnection,
  getTestCredential,
  getTestOffer,
  getTestOutOfBandRecord,
  getTestServer,
  objectToJson,
  openWebSocket,
  type TestAgent,
} from './utils/helpers.js'

describe('CredentialController', () => {
  let port: number
  let app: Server
  let socket: WebSocket
  let aliceAgent: TestAgent
  let bobAgent: TestAgent
  let testCredential: DidCommCredentialExchangeRecord
  let testFormatData: GetCredentialFormatDataReturn<[AnonCredsDidCommCredentialFormat]>
  let testOffer: {
    message: DidCommMessage
    credentialExchangeRecord: DidCommCredentialExchangeRecord
  }
  let outOfBandRecord: DidCommOutOfBandRecord
  let connection: DidCommConnectionRecord

  before(async () => {
    aliceAgent = await getTestAgent('Credential REST Agent Test Alice', 3022)
    bobAgent = await getTestAgent('Credential REST Agent Test Bob', 3023)
    app = await getTestServer(bobAgent)
    port = (app.address() as AddressInfo).port

    testCredential = getTestCredential() as DidCommCredentialExchangeRecord
    testFormatData = getCredentialFormatData()
    const helperOffer = getTestOffer()
    testOffer = {
      message: helperOffer.message,
      credentialExchangeRecord: helperOffer.credentialExchangeRecord,
    }
    outOfBandRecord = getTestOutOfBandRecord()
    connection = getTestConnection()
  })

  afterEach(async () => {
    sinonRestore()
    await closeWebSocket(socket)
  })

  describe('Get all credentials', () => {
    test('should return all credentials', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/v1/credentials')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.be.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by state', () => {
    test('should return all credentials by specified state', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/v1/credentials').query({ state: testCredential.state })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          state: testCredential.state,
        })
      ).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by threadId', () => {
    test('should return all credentials by specified threadId', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/v1/credentials').query({ threadId: testCredential.threadId })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          threadId: testCredential.threadId,
        })
      ).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by connectionId', () => {
    test('should return all credentials by connectionId', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(DidCommCredentialExchangeRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/v1/credentials').query({ connectionId: testCredential.connectionId })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          connectionId: testCredential.connectionId,
        })
      ).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get credential by id', () => {
    test('should return single credential', async () => {
      const getByIdStub = stub(bobAgent.didcomm.credentials, 'getById')
      getByIdStub.resolves(testCredential)

      const getResult = (): Promise<DidCommCredentialExchangeRecord> => {
        return getByIdStub.firstCall.returnValue
      }

      const response = await request(app).get(`/v1/credentials/${testCredential.id}`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testCredential.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).get(`/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Get credential format-data by id', () => {
    test('should return format data for a single credential', async () => {
      const getFormatDataStub = stub(bobAgent.didcomm.credentials, 'getFormatData')
      getFormatDataStub.resolves(testFormatData)

      const getResult = (): Promise<typeof testFormatData> => {
        return getFormatDataStub.firstCall.returnValue
      }

      const response = await request(app).get(`/v1/credentials/${testCredential.id}/format-data`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(getFormatDataStub.calledWithMatch(testCredential.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).get(`/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/format-data`)

      expect(response.statusCode).to.be.equal(404)
    })

    test('should give 500 when credential format data contains non-json-compatible values', async () => {
      const getFormatDataStub = stub(bobAgent.didcomm.credentials, 'getFormatData')
      getFormatDataStub.resolves({
        proposalAttributes: [],
        offerAttributes: [],
        proposal: {
          invalid: () => 'not-json-compatible',
        },
      } as unknown as GetCredentialFormatDataReturn<[AnonCredsDidCommCredentialFormat]>)

      const response = await request(app).get(`/v1/credentials/${testCredential.id}/format-data`)

      expect(response.statusCode).to.be.equal(500)
    })
  })

  describe('Delete credential by id', () => {
    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).delete('/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Propose a credential', () => {
    test('should return credential record', async () => {
      const proposeCredentialStub = stub(bobAgent.didcomm.credentials, 'proposeCredential')
      proposeCredentialStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => proposeCredentialStub.firstCall.returnValue

      const proposalRequest: ProposeCredentialOptions = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            issuerDid: 'WghBqNdoFjaYh6F5N9eBF',
            schemaId: 'WgWxqztrNooG92RXvxSTWv:2:test:1.0',
            schemaIssuerDid: 'WghBqNdoFjaYh6F5N9eBF',
            schemaName: 'test',
            schemaVersion: '1.0',
            attributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/propose-credential`).send(proposalRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-offer')

      expect(response.statusCode).to.be.equal(404)
    })

    test('should support jsonld format in proposal', async () => {
      const proposeCredentialStub = stub(bobAgent.didcomm.credentials, 'proposeCredential')
      proposeCredentialStub.resolves(testCredential)

      const proposalRequestJsonLd: ProposeCredentialOptions = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: ['VerifiableCredential'],
              issuer: 'did:key:123',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: {
                id: 'did:key:456',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/propose-credential`).send(proposalRequestJsonLd)

      expect(response.statusCode).to.be.equal(200)
      expect(
        proposeCredentialStub.calledWithMatch({
          credentialFormats: {
            jsonld: proposalRequestJsonLd.credentialFormats?.jsonld,
          },
        })
      ).to.equal(true)
    })

    test('should return 400 for invalid jsonld proposal profile', async () => {
      const proposeCredentialStub = stub(bobAgent.didcomm.credentials, 'proposeCredential')
      proposeCredentialStub.resolves(testCredential)

      const invalidProposalRequest = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': [],
              type: ['EmployeeCredential'],
              issuer: 'did:key:123',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: {
                id: 'did:key:456',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/propose-credential`).send(invalidProposalRequest)

      expect(response.statusCode).to.be.equal(400)
      expect(response.body).to.have.property('message', 'Validation Failed')
      expect(response.body).to.have.property('details')
      expect(response.body.details).to.be.an('object')
      expect(Object.keys(response.body.details)).to.have.length.greaterThan(0)
      expect(proposeCredentialStub.called).to.be.equal(false)
    })

    test('should return 400 when jsonld proposal credentialSubject is an array', async () => {
      const proposeCredentialStub = stub(bobAgent.didcomm.credentials, 'proposeCredential')
      proposeCredentialStub.resolves(testCredential)

      const invalidProposalRequest = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://example.com/custom-context'],
              type: ['EmployeeCredential'],
              issuer: 'did:key:123',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: [
                {
                  id: 'did:key:456',
                },
              ],
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/propose-credential`).send(invalidProposalRequest)

      expect(response.statusCode).to.be.equal(400)
      expect(proposeCredentialStub.called).to.be.equal(false)
    })
  })

  describe('Accept a credential proposal', () => {
    test('should return credential record', async () => {
      const acceptProposalStub = stub(bobAgent.didcomm.credentials, 'acceptProposal')
      acceptProposalStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => acceptProposalStub.firstCall.returnValue
      const proposalRequest: AcceptCredentialProposalOptions = {
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            attributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
          },
        },
        autoAcceptCredential: 'always' as DidCommAutoAcceptCredential,
        comment: 'test',
      }

      const response = await request(app)
        .post(`/v1/credentials/${testCredential.id}/accept-proposal`)
        .send(proposalRequest)

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptProposalStub.lastCall.args[0]).to.be.deep.include({
        ...proposalRequest,
        credentialExchangeRecordId: testCredential.id,
      })
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should work without optional parameters', async () => {
      const acceptProposalStub = stub(bobAgent.didcomm.credentials, 'acceptProposal')
      acceptProposalStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => acceptProposalStub.firstCall.returnValue
      //added proposal request - credentialFormats is required even if empty
      const proposalRequest = {
        credentialFormats: {},
      }

      const response = await request(app)
        .post(`/v1/credentials/${testCredential.id}/accept-proposal`)
        .send(proposalRequest) //added proposal request

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      //added proposal request - credentialFormats is required even if empty
      const proposalRequest = {
        credentialFormats: {},
      }
      const response = await request(app)
        .post(`/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-proposal`)
        .send(proposalRequest) //added proposal request

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Credential WebSocket event', () => {
    test('should return credential event sent from test agent to websocket client', async () => {
      const now = new Date()

      // Start client and wait for it to be opened
      socket = await openWebSocket(port)

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        socket.on('message', (data) => {
          resolve(JSON.parse(data.toString()))
        })
      )

      // Emit event
      bobAgent.events.emit<DidCommCredentialStateChangedEvent>(bobAgent.context, {
        type: DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        payload: {
          credentialExchangeRecord: new DidCommCredentialExchangeRecord({
            protocolVersion: 'v1',
            state: DidCommCredentialState.OfferSent,
            threadId: 'thread-id',
            autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
            connectionId: 'connection-id',
            createdAt: now,
            credentialAttributes: [
              new DidCommCredentialPreviewAttribute({
                name: 'name',
                value: 'test',
              }),
            ],
            credentials: [
              {
                credentialRecordId: 'credential-id',
                credentialRecordType: 'anoncreds',
              },
            ],
            errorMessage: 'error',
            id: 'credential-exchange-id',
            revocationNotification: {
              revocationDate: now,
              comment: 'test',
            },
            role: DidCommCredentialRole.Holder,
          }),
          previousState: DidCommCredentialState.CredentialIssued,
        },
      })

      // Wait for event on WebSocket
      const event = await waitForEvent

      expect(event).to.deep.equal({
        type: DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        payload: {
          credentialExchangeRecord: {
            protocolVersion: 'v1',
            state: DidCommCredentialState.OfferSent,
            threadId: 'thread-id',
            autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
            connectionId: 'connection-id',
            createdAt: now.toISOString(),
            metadata: {},
            _tags: {},
            credentialAttributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
            credentials: [
              {
                credentialRecordId: 'credential-id',
                credentialRecordType: 'anoncreds',
              },
            ],
            errorMessage: 'error',
            id: 'credential-exchange-id',
            revocationNotification: {
              revocationDate: now.toISOString(),
              comment: 'test',
            },
            role: DidCommCredentialRole.Holder,
          },
          previousState: DidCommCredentialState.CredentialIssued,
        },
        metadata: {
          contextCorrelationId: 'default',
        },
      })
    })
  })

  describe('Create a credential offer', () => {
    test('should return single credential record with attached offer message', async () => {
      const createOfferStub = stub(bobAgent.didcomm.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)
      const getResult = (): Promise<{
        message: DidCommMessage
        credentialExchangeRecord: DidCommCredentialExchangeRecord
      }> => createOfferStub.firstCall.returnValue

      const createOfferRequest = {
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            attributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/create-offer`).send(createOfferRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should return 400 for invalid jsonld create-offer profile', async () => {
      const createOfferStub = stub(bobAgent.didcomm.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)

      const invalidCreateOfferRequest = {
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: [],
              issuer: 'did:key:issuer',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: {
                id: 'did:key:subject',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/create-offer`).send(invalidCreateOfferRequest)

      expect(response.statusCode).to.be.equal(400)
      expect(response.body).to.have.property('message', 'Validation Failed')
      expect(response.body).to.have.property('details')
      expect(response.body.details).to.be.an('object')
      expect(Object.keys(response.body.details)).to.have.length.greaterThan(0)
      expect(createOfferStub.called).to.be.equal(false)
    })

    test('should return 400 for jsonld create-offer credentialSubject array shape', async () => {
      const createOfferStub = stub(bobAgent.didcomm.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)

      const invalidCreateOfferRequest = {
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://example.com/custom-context'],
              type: ['VerifiableCredential'],
              issuer: 'did:key:issuer',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: [
                {
                  id: 'did:key:subject',
                },
              ],
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/create-offer`).send(invalidCreateOfferRequest)

      expect(response.statusCode).to.be.equal(400)
      expect(createOfferStub.called).to.be.equal(false)
    })
  })

  describe('Create a credential offer and a corresponding invitation using create-invitation', () => {
    test('should return single credential record with attached offer message', async () => {
      const createOfferStub = stub(bobAgent.didcomm.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)
      const getResult = (): Promise<{
        message: DidCommMessage
        credentialExchangeRecord: DidCommCredentialExchangeRecord
      }> => createOfferStub.firstCall.returnValue

      const createOfferRequest = {
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            attributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/create-offer`).send(createOfferRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should return single out of bound record', async () => {
      const createInvitationStub = stub(bobAgent.didcomm.oob, 'createInvitation')
      createInvitationStub.resolves(outOfBandRecord)

      const params = {
        label: 'string',
        alias: 'string',
        imageUrl: 'string',
        goalCode: 'string',
        goal: 'string',
        handshake: true,
        handshakeProtocols: ['https://didcomm.org/connections/1.x'],
        multiUseInvitation: true,
        autoAcceptConnection: true,
      }

      const response = await request(app).post('/v1/oob/create-invitation').send(params)
      expect(response.statusCode).to.be.equal(200)
      expect(createInvitationStub.lastCall.args[0]).to.be.deep.include(params)
    })
  })

  describe('Create a credential offer and a corresponding invitation using create-legacy-connectionless-invitation', () => {
    test('should return single credential record with attached offer message', async () => {
      const createOfferStub = stub(bobAgent.didcomm.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)
      const getResult = (): Promise<{
        message: DidCommMessage
        credentialExchangeRecord: DidCommCredentialExchangeRecord
      }> => createOfferStub.firstCall.returnValue

      const createOfferRequest = {
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
            attributes: [
              {
                name: 'name',
                value: 'test',
              },
            ],
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/create-offer`).send(createOfferRequest)

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should return single out of bound invitation', async () => {
      const msg = JsonTransformer.fromJSON(
        {
          '@id': 'eac4ff4e-b4fb-4c1d-aef3-b29c89d1cc00',
          '@type': 'https://didcomm.org/connections/1.x/invitation',
        },
        DidCommMessage
      )

      const inputParams = {
        domain: 'string',
        message: {
          '@id': 'eac4ff4e-b4fb-4c1d-aef3-b29c89d1cc00',
          '@type': 'https://didcomm.org/connections/1.x/invitation',
        },
        recordId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      }

      const createLegacyConnectionlessInvitationStub = stub(
        bobAgent.didcomm.oob,
        'createLegacyConnectionlessInvitation'
      )
      createLegacyConnectionlessInvitationStub.resolves({
        message: msg,
        invitationUrl: 'https://example.com/invitation',
        outOfBandRecord,
      })

      const response = await request(app).post('/v1/oob/create-legacy-connectionless-invitation').send(inputParams)

      expect(response.statusCode).to.be.equal(200)
      expect(
        createLegacyConnectionlessInvitationStub.calledWithMatch({
          ...inputParams,
          message: msg,
        })
      ).equals(true)
    })
  })

  describe('Offer a credential', () => {
    const offerRequest = {
      connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
      protocolVersion: 'v2',
      credentialFormats: {
        anoncreds: {
          credentialDefinitionId: 'WghBqNdoFjaYh6F5N9eBF:3:CL:3210:test',
          attributes: [
            {
              name: 'name',
              value: 'test',
            },
          ],
        },
      },
    }

    test('should return credential record', async () => {
      const findByIdStub = stub(bobAgent.didcomm.connections, 'findById')
      findByIdStub.resolves(connection)
      const offerCredentialStub = stub(bobAgent.didcomm.credentials, 'offerCredential')
      offerCredentialStub.resolves(testCredential)

      const getResult = (): Promise<DidCommCredentialExchangeRecord> => offerCredentialStub.firstCall.returnValue

      const response = await request(app).post(`/v1/credentials/offer-credential`).send(offerRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const findByIdStub = stub(bobAgent.didcomm.connections, 'findById')
      findByIdStub.resolves(connection) //connection is present - fails on missing credential definition
      const response = await request(app)
        .post('/v1/credentials/accept-offer')
        .send({ credentialExchangeRecordId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' })

      expect(response.statusCode).to.be.equal(404)
    })
    test('should give 404 not found when connection is not found', async () => {
      //fails on missing connection
      const response = await request(app)
        .post('/v1/credentials/accept-offer')
        .send({ credentialExchangeRecordId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' })

      expect(response.statusCode).to.be.equal(404)
    })

    test('should support jsonld format in offer', async () => {
      const findByIdStub = stub(bobAgent.didcomm.connections, 'findById')
      findByIdStub.resolves(connection)
      const offerCredentialStub = stub(bobAgent.didcomm.credentials, 'offerCredential')
      offerCredentialStub.resolves(testCredential)

      const offerRequestJsonLd: OfferCredentialOptions = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: ['VerifiableCredential'],
              issuer: 'did:key:123',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: {
                id: 'did:key:456',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/offer-credential`).send(offerRequestJsonLd)

      expect(response.statusCode).to.be.equal(200)
      expect(
        offerCredentialStub.calledWithMatch({
          credentialFormats: {
            jsonld: offerRequestJsonLd.credentialFormats?.jsonld,
          },
        })
      ).to.equal(true)
    })

    test('should return 400 for invalid jsonld offer profile', async () => {
      const findByIdStub = stub(bobAgent.didcomm.connections, 'findById')
      findByIdStub.resolves(connection)
      const offerCredentialStub = stub(bobAgent.didcomm.credentials, 'offerCredential')
      offerCredentialStub.resolves(testCredential)

      const invalidOfferRequest = {
        connectionId: '000000aa-aa00-40a0-aa00-000a0aa00000',
        protocolVersion: 'v2',
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://www.w3.org/2018/credentials/v1'],
              type: [],
              issuer: 'did:key:123',
              issuanceDate: '2021-01-01T00:00:00Z',
              credentialSubject: {
                id: 'did:key:456',
              },
            },
            options: {
              proofType: 'Ed25519Signature2018',
              proofPurpose: 'assertionMethod',
            },
          },
        },
      }

      const response = await request(app).post(`/v1/credentials/offer-credential`).send(invalidOfferRequest)

      expect(response.statusCode).to.be.equal(400)
      expect(response.body).to.have.property('message', 'Validation Failed')
      expect(response.body).to.have.property('details')
      expect(response.body.details).to.be.an('object')
      expect(Object.keys(response.body.details)).to.have.length.greaterThan(0)
      expect(offerCredentialStub.called).to.be.equal(false)
    })
  })

  describe('Accept a credential offer', () => {
    test('should return credential record', async () => {
      const acceptOfferStub = stub(bobAgent.didcomm.credentials, 'acceptOffer')
      acceptOfferStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => acceptOfferStub.firstCall.returnValue

      const response = await request(app).post(`/v1/credentials/${testCredential.id}/accept-offer`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptOfferStub.calledWithMatch({ credentialExchangeRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-offer')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential request', () => {
    test('should return credential record', async () => {
      const acceptRequestStub = stub(bobAgent.didcomm.credentials, 'acceptRequest')
      acceptRequestStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => acceptRequestStub.firstCall.returnValue

      const response = await request(app).post(`/v1/credentials/${testCredential.id}/accept-request`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptRequestStub.calledWithMatch({ credentialExchangeRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-request')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential', () => {
    test('should return credential record', async () => {
      const acceptCredentialStub = stub(bobAgent.didcomm.credentials, 'acceptCredential')
      acceptCredentialStub.resolves(testCredential)
      const getResult = (): Promise<DidCommCredentialExchangeRecord> => acceptCredentialStub.firstCall.returnValue

      const response = await request(app).post(`/v1/credentials/${testCredential.id}/accept-credential`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptCredentialStub.calledWithMatch({ credentialExchangeRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/v1/credentials/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-credential')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Send problem report about a credential', () => {
    test('should send a problem report', async () => {
      const problemRecordStub = stub(bobAgent.didcomm.credentials, 'sendProblemReport')
      problemRecordStub.resolves(testCredential)

      const getResult = (): Promise<DidCommCredentialExchangeRecord> => problemRecordStub.firstCall.returnValue

      const response = await request(app).post(`/v1/credentials/${testCredential.id}/send-problem-report`).send({
        description: 'some Error report',
      })
      const result = await getResult()

      expect(response.body).to.deep.equal(objectToJson(result))
      expect(response.statusCode).to.be.equal(200)
      expect(problemRecordStub.calledOnce).to.be.equal(true)
      expect(problemRecordStub.firstCall.args[0]).to.deep.equal({
        credentialExchangeRecordId: testCredential.id,
        description: 'some Error report',
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
