import { expect } from 'chai'
import { after, afterEach, before, describe, test } from 'mocha'
import type { AddressInfo, Server } from 'node:net'
import { restore as sinonRestore, stub } from 'sinon'

import {
  ConnectionEventTypes,
  ConnectionRepository,
  type Agent,
  type ConnectionRecord,
  type OutOfBandRecord,
  type TrustPingMessage,
} from '@credo-ts/core'
import request from 'supertest'
import WebSocket from 'ws'

import {
  getTestAgent,
  getTestConnection,
  getTestOutOfBandRecord,
  getTestServer,
  getTestTrustPingMessage,
  objectToJson,
} from './utils/helpers.js'

describe('ConnectionController', () => {
  let port: number
  let app: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let connection: ConnectionRecord
  let outOfBandRecord: OutOfBandRecord

  before(async () => {
    aliceAgent = await getTestAgent('Connection REST Agent Test Alice', 3012)
    bobAgent = await getTestAgent('Connection REST Agent Test Bob', 3013)
    app = await getTestServer(bobAgent)
    port = (app.address() as AddressInfo).port
    connection = getTestConnection()
    outOfBandRecord = getTestOutOfBandRecord()
  })

  afterEach(() => {
    sinonRestore()
  })

  describe('Send trust ping', () => {
    test('Should send a ping on an established connection', async () => {
      const sendPingStub = stub(bobAgent.connections, 'sendPing')
      const message = getTestTrustPingMessage()
      sendPingStub.resolves(message)
      const getResult = (): Promise<TrustPingMessage> => sendPingStub.firstCall.returnValue

      const response = await request(app).post(`/v1/connections/${connection.id}/send-ping`)

      expect(response.statusCode)
      expect(sendPingStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })
  })

  describe('Get all connections', () => {
    test('should return all connections', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by state', () => {
    test('should return all credentials by specified state', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ state: connection.state })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          state: connection.state,
        })
      ).equals(true)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by outOfBandId', () => {
    test('should return all credentials by specified outOfBandId', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ outOfBandId: connection.outOfBandId })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          outOfBandId: connection.outOfBandId,
        })
      ).equals(true)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by alias', () => {
    test('should return all credentials by specified alias', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ alias: connection.alias })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          alias: connection.alias,
        })
      ).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by myDid', () => {
    test('should return all credentials by specified peer DID', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ myDid: connection.did })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          myDid: connection.did,
        })
      ).equals(true)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by theirDid', () => {
    test('should return all credentials by specified peer DID', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ theirDid: connection.theirDid })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          theirDid: connection.theirDid,
        })
      ).equals(true)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by theirLabel', () => {
    test('should return all credentials by specified peer label', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/v1/connections').query({ theirLabel: connection.theirLabel })

      expect(
        findByQueryStub.calledWithMatch(bobAgent.context, {
          theirLabel: connection.theirLabel,
        })
      ).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get connection by id', () => {
    test('should return connection record', async () => {
      const findByIdStub = stub(bobAgent.connections, 'findById')
      findByIdStub.resolves(connection)
      const getResult = (): Promise<ConnectionRecord | null> => findByIdStub.firstCall.returnValue

      const response = await request(app).get(`/v1/connections/${connection.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(findByIdStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).get(`/v1/connections/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept request', () => {
    test('should return accepted connection record', async () => {
      const acceptRequestStub = stub(bobAgent.connections, 'acceptRequest')
      acceptRequestStub.resolves(connection)
      const getResult = (): Promise<ConnectionRecord> => acceptRequestStub.firstCall.returnValue

      const response = await request(app).post(`/v1/connections/${connection.id}/accept-request`)

      expect(response.statusCode)
      expect(acceptRequestStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should throw error when connection id is not found', async () => {
      const response = await request(app).post(`/v1/connections/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-request`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept response', () => {
    test('should return accepted connection record', async () => {
      const acceptResponseStub = stub(bobAgent.connections, 'acceptResponse')
      acceptResponseStub.resolves(connection)
      const getResult = (): Promise<ConnectionRecord | null> => acceptResponseStub.firstCall.returnValue

      const response = await request(app).post(`/v1/connections/${connection.id}/accept-response`)

      expect(response.statusCode)
      expect(acceptResponseStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should throw error when connectionId is not found', async () => {
      const response = await request(app).post(`/v1/connections/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/accept-response`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Connection WebSocket Event', () => {
    test('should return connection event sent from test agent to websocket client', async () => {
      const client = new WebSocket(`ws://localhost:${port}`)

      const aliceOutOfBandRecord = await aliceAgent.oob.createInvitation()

      const waitForMessagePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const event = JSON.parse(data.toString())

          expect(event.type).to.be.equal(ConnectionEventTypes.ConnectionStateChanged)
          client.terminate()
          resolve(undefined)
        })
      })

      await bobAgent.oob.receiveInvitation(aliceOutOfBandRecord.outOfBandInvitation)
      await waitForMessagePromise
    })
  })

  describe('Create connection', async function () {
    it('Bob creates a connection with Alice', async function () {
      const receiveImplicitInvitationStub = stub(bobAgent.oob, 'receiveImplicitInvitation')
      receiveImplicitInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connection,
      })
      const getResult = () => receiveImplicitInvitationStub.firstCall.returnValue

      const response = await request(app)
        .post('/v1/connections')
        .send({ did: 'did:key:z6MkpGuzuD38tpgZKPfmLmmD8R6gihP9KJhuopMu00000000' })
        .expect(200)

      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    it('Bob replaces old connection with Alice', async function () {
      const { invitationDid } = connection

      const receiveImplicitInvitationStub = stub(bobAgent.oob, 'receiveImplicitInvitation')
      receiveImplicitInvitationStub.resolves({
        outOfBandRecord: outOfBandRecord,
        connectionRecord: connection,
      })

      // stub a connection to be replaced
      stub(bobAgent.connections, 'findByInvitationDid').resolves([connection])

      // assert old connection is deleted
      const deleteByIdStub = stub(bobAgent.connections, 'deleteById')

      await request(app).post('/v1/connections').send({ did: invitationDid }).expect(200)
      expect(deleteByIdStub.callCount).to.equal(1)
    })

    it("422s if DID doesn't start with did:", async function () {
      await request(app).post('/v1/connections').send({ did: 'bla' }).expect(422)
    })

    it('500s if DID is invalid', async function () {
      await request(app).post('/v1/connections').send({ did: 'did:bla' }).expect(500)
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
