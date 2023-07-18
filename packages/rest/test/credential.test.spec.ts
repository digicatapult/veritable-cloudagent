import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import type { Agent, CredentialStateChangedEvent, OutOfBandRecord } from '@aries-framework/core'
import type { Server } from 'net'

import {
  AutoAcceptCredential,
  CredentialExchangeRecord,
  CredentialPreviewAttribute,
  CredentialState,
  CredentialEventTypes,
  AgentMessage,
  JsonTransformer,
  CredentialRepository,
} from '@aries-framework/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../src'

import { objectToJson, getTestCredential, getTestAgent, getTestOffer, getTestOutOfBandRecord } from './utils/helpers'

describe('CredentialController', () => {
  let app: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let testCredential: CredentialExchangeRecord
  let testOffer: {
    message: AgentMessage
    credentialRecord: CredentialExchangeRecord
  }
  let outOfBandRecord: OutOfBandRecord

  before(async () => {
    aliceAgent = await getTestAgent('Credential REST Agent Test Alice', 3022)
    bobAgent = await getTestAgent('Credential REST Agent Test Bob', 3023)
    app = await startServer(bobAgent, { port: 3024 })

    testCredential = getTestCredential() as CredentialExchangeRecord
    testOffer = getTestOffer()
    outOfBandRecord = getTestOutOfBandRecord()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Get all credentials', () => {
    test('should return all credentials', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(CredentialRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/credentials')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.be.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by state', () => {
    test('should return all credentials by specified state', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(CredentialRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/credentials').query({ state: testCredential.state })

      expect(findByQueryStub.calledWithMatch({
        state: testCredential.state,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by threadId', () => {
    test('should return all credentials by specified threadId', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(CredentialRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/credentials').query({ threadId: testCredential.threadId })

      expect(findByQueryStub.calledWithMatch({
        threadId: testCredential.threadId,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get all credentials by connectionId', () => {
    test('should return all credentials by connectionId', async () => {
      const credentialRepository = bobAgent.dependencyManager.resolve(CredentialRepository)
      const findByQueryStub = stub(credentialRepository, 'findByQuery')
      findByQueryStub.resolves([testCredential])

      const response = await request(app).get('/credentials').query({ connectionId: testCredential.connectionId })

      expect(findByQueryStub.calledWithMatch({
        connectionId: testCredential.connectionId,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([testCredential].map(objectToJson))
    })
  })

  describe('Get credential by id', () => {
    test('should return single credential', async () => {
      const getByIdStub = stub(bobAgent.credentials, 'getById')
      getByIdStub.resolves(testCredential)

      const getResult = (): Promise<CredentialExchangeRecord> => {
        return getByIdStub.firstCall.returnValue
      }

      const response = await request(app).get(`/credentials/${testCredential.id}`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(getByIdStub.calledWithMatch(testCredential.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).get(`/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Delete credential by id', () => {
    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).delete('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Propose a credential', () => {
    test('should return credential record', async () => {
      const proposeCredentialStub = stub(bobAgent.credentials, 'proposeCredential')
      proposeCredentialStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => proposeCredentialStub.firstCall.returnValue

      const proposalRequest = {
        connectionId: '000000aa-aa00-00a0-aa00-000a0aa00000',
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
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

      const response = await request(app).post(`/credentials/propose-credential`).send(proposalRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-offer')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential proposal', () => {
    test('should return credential record', async () => {
      const acceptProposalStub = stub(bobAgent.credentials, 'acceptProposal')
      acceptProposalStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptProposalStub.firstCall.returnValue

      const proposalRequest = {
        credentialFormats: {
          indy: {
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
        autoAcceptCredential: 'always',
        comment: 'test',
      }

      const response = await request(app)
        .post(`/credentials/${testCredential.id}/accept-proposal`)
        .send(proposalRequest)

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptProposalStub.lastCall.args[0]).to.be.deep.include({ ...proposalRequest, credentialRecordId: testCredential.id })
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should work without optional parameters', async () => {
      const acceptProposalStub = stub(bobAgent.credentials, 'acceptProposal')
      acceptProposalStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptProposalStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/${testCredential.id}/accept-proposal`)

      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post(`/credentials/000000aa-aa00-00a0-aa00-000a0aa00000/accept-proposal`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Credential WebSocket event', () => {
    test('should return credential event sent from test agent to websocket client', async () => {
      // expect.assertions(1)
      class ExpectCounter { // From: https://github.com/chaijs/chai/issues/94#issuecomment-925403907
        actual: number
        expected: any
        constructor(expected: any) {
          this.actual = 0, this.expected = expected
        }
        expect(...args: any[]) {
          this.actual++
          return expect([...args][0])
        }
      }
      const count = new ExpectCounter(1)

      const now = new Date()

      // Start client and wait for it to be opened
      const client = new WebSocket('ws://localhost:3024')
      await new Promise((resolve) => client.once('open', resolve))

      // Start promise to listen for message
      const waitForEvent = new Promise((resolve) =>
        client.on('message', (data) => {
          client.terminate()
          resolve(JSON.parse(data as string))
        })
      )

      // Emit event
      bobAgent.events.emit<CredentialStateChangedEvent>({
        type: CredentialEventTypes.CredentialStateChanged,
        payload: {
          credentialRecord: new CredentialExchangeRecord({
            protocolVersion: 'v1',
            state: CredentialState.OfferSent,
            threadId: 'thread-id',
            autoAcceptCredential: AutoAcceptCredential.ContentApproved,
            connectionId: 'connection-id',
            createdAt: now,
            credentialAttributes: [
              new CredentialPreviewAttribute({
                name: 'name',
                value: 'test',
              }),
            ],
            credentials: [
              {
                credentialRecordId: 'credential-id',
                credentialRecordType: 'indy',
              },
            ],
            errorMessage: 'error',
            id: 'credential-exchange-id',
            revocationNotification: {
              revocationDate: now,
              comment: 'test',
            },
          }),
          previousState: CredentialState.CredentialIssued,
        },
      })

      // Wait for event on WebSocket
      const event = await waitForEvent

      count.expect(event).to.deep.equal({
        type: CredentialEventTypes.CredentialStateChanged,
        payload: {
          credentialRecord: {
            protocolVersion: 'v1',
            state: CredentialState.OfferSent,
            threadId: 'thread-id',
            autoAcceptCredential: AutoAcceptCredential.ContentApproved,
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
                credentialRecordType: 'indy',
              },
            ],
            errorMessage: 'error',
            id: 'credential-exchange-id',
            revocationNotification: {
              revocationDate: now.toISOString(),
              comment: 'test',
            },
          },
          previousState: CredentialState.CredentialIssued,
        },
      })

      expect(count.actual).to.be.equal(count.expected)
    })
  })

  describe('Create a credential offer', () => {
    test('should return single credential record with attached offer message', async () => {
      const createOfferStub = stub(bobAgent.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)
      const getResult = (): Promise<{ message: AgentMessage; credentialRecord: CredentialExchangeRecord }> =>
        createOfferStub.firstCall.returnValue

      const createOfferRequest = {
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
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

      const response = await request(app).post(`/credentials/create-offer`).send(createOfferRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })
  })

  describe('Create a credential offer and a corresponding invitation using create-invitation', () => {
    test('should return single credential record with attached offer message', async () => {
      const createOfferStub = stub(bobAgent.credentials, 'createOffer')
      createOfferStub.resolves(testOffer)
      const getResult = (): Promise<{ message: AgentMessage; credentialRecord: CredentialExchangeRecord }> =>
        createOfferStub.firstCall.returnValue

      const createOfferRequest = {
        protocolVersion: 'v1',
        credentialFormats: {
          indy: {
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

      const response = await request(app).post(`/credentials/create-offer`).send(createOfferRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should return single out of bound record', async () => {
      const createInvitationStub = stub(bobAgent.oob, 'createInvitation')
      createInvitationStub.resolves(outOfBandRecord)

      const params = {
        label: 'string',
        alias: 'string',
        imageUrl: 'string',
        goalCode: 'string',
        goal: 'string',
        handshake: true,
        handshakeProtocols: ['https://didcomm.org/connections/1.0'],
        multiUseInvitation: true,
        autoAcceptConnection: true,
      }

      const response = await request(app).post('/oob/create-invitation').send(params)
      expect(response.statusCode).to.be.equal(200)
      expect(createInvitationStub.lastCall.args[0]).to.be.deep.include(params)
    })
  })

  describe('Offer a credential', () => {
    const offerRequest = {
      connectionId: '000000aa-aa00-00a0-aa00-000a0aa00000',
      protocolVersion: 'v1',
      credentialFormats: {
        indy: {
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
      const offerCredentialStub = stub(bobAgent.credentials, 'offerCredential')
      offerCredentialStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => offerCredentialStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/offer-credential`).send(offerRequest)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app)
        .post('/credentials/accept-offer')
        .send({ credentialRecordId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential offer', () => {
    test('should return credential record', async () => {
      const acceptOfferStub = stub(bobAgent.credentials, 'acceptOffer')
      acceptOfferStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptOfferStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/${testCredential.id}/accept-offer`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptOfferStub.calledWithMatch({ credentialRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-offer')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential request', () => {
    test('should return credential record', async () => {
      const acceptRequestStub = stub(bobAgent.credentials, 'acceptRequest')
      acceptRequestStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptRequestStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/${testCredential.id}/accept-request`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptRequestStub.calledWithMatch({ credentialRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-request')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential request', () => {
    test('should return credential record', async () => {
      const acceptRequestStub = stub(bobAgent.credentials, 'acceptRequest')
      acceptRequestStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptRequestStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/${testCredential.id}/accept-request`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptRequestStub.lastCall.args[0]).to.be.deep.include({ credentialRecordId: testCredential.id })
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-request')

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept a credential', () => {
    test('should return credential record', async () => {
      const acceptCredentialStub = stub(bobAgent.credentials, 'acceptCredential')
      acceptCredentialStub.resolves(testCredential)
      const getResult = (): Promise<CredentialExchangeRecord> => acceptCredentialStub.firstCall.returnValue

      const response = await request(app).post(`/credentials/${testCredential.id}/accept-credential`)
      const result = await getResult()

      expect(response.statusCode).to.be.equal(200)
      expect(acceptCredentialStub.calledWithMatch({ credentialRecordId: testCredential.id })).equals(true)
      expect(response.body).to.deep.equal(objectToJson(result))
    })

    test('should give 404 not found when credential is not found', async () => {
      const response = await request(app).post('/credentials/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-credential')

      expect(response.statusCode).to.be.equal(404)
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
