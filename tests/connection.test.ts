import { describe, before, beforeEach, after, afterEach, test } from 'mocha'
import { expect, use as chaiUse, Assertion as assertion } from 'chai'
import chaiAssertionsCount from 'chai-assertions-count'
import { stub, restore as sinonRestore } from 'sinon'

import type { Agent, ConnectionRecord } from '@aries-framework/core'
import type { Server } from 'net'

import { ConnectionEventTypes, ConnectionRepository } from '@aries-framework/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../src'

import { getTestConnection, getTestAgent, objectToJson } from './utils/helpers'

chaiUse(chaiAssertionsCount)

describe('ConnectionController', () => {
  let app: Server
  let aliceAgent: Agent
  let bobAgent: Agent
  let connection: ConnectionRecord

  before(async () => {
    aliceAgent = await getTestAgent('Connection REST Agent Test Alice', 3012)
    bobAgent = await getTestAgent('Connection REST Agent Test Bob', 3013)
    app = await startServer(bobAgent, { port: 3009 })
    connection = getTestConnection()
  })

  beforeEach(() => {
    assertion.resetAssertsCheck()
  })

  afterEach(() => {
    sinonRestore()

    assertion.checkExpectsCount()
  })

  describe('Get all connections', () => {
    test('should return all connections', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/connections')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by state', () => {
    test('should return all credentials by specified state', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/connections').query({ state: connection.state })

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

      const response = await request(app).get('/connections').query({ outOfBandId: connection.outOfBandId })

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

      const response = await request(app).get('/connections').query({ alias: connection.alias })

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
    test('should return all credentials by specified peer did', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/connections').query({ myDid: connection.did })

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
    test('should return all credentials by specified peer did', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQueryStub = stub(connectionRepository, 'findByQuery')
      findByQueryStub.resolves([connection])

      const response = await request(app).get('/connections').query({ theirDid: connection.theirDid })

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

      const response = await request(app).get('/connections').query({ theirLabel: connection.theirLabel })

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

      const response = await request(app).get(`/connections/${connection.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(findByIdStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).get(`/connections/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept request', () => {
    test('should return accepted connection record', async () => {
      const acceptRequestStub = stub(bobAgent.connections, 'acceptRequest')
      acceptRequestStub.resolves(connection)
      const getResult = (): Promise<ConnectionRecord> => acceptRequestStub.firstCall.returnValue

      const response = await request(app).post(`/connections/${connection.id}/accept-request`)

      expect(response.statusCode)
      expect(acceptRequestStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should throw error when connection id is not found', async () => {
      const response = await request(app).post(`/connections/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-request`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept response', () => {
    test('should return accepted connection record', async () => {
      const acceptResponseStub = stub(bobAgent.connections, 'acceptResponse')
      acceptResponseStub.resolves(connection)
      const getResult = (): Promise<ConnectionRecord | null> => acceptResponseStub.firstCall.returnValue

      const response = await request(app).post(`/connections/${connection.id}/accept-response`)

      expect(response.statusCode)
      expect(acceptResponseStub.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should throw error when connectionId is not found', async () => {
      const response = await request(app).post(`/connections/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-response`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Connection WebSocket Event', () => {
    test.skip('should return connection event sent from test agent to websocket client', async () => {
      assertion.expectExpects(1)
      const client = new WebSocket('ws://localhost:3009')

      const aliceOutOfBandRecord = await aliceAgent.oob.createInvitation()

      const waitForMessagePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const event = JSON.parse(data as string)

          expect(event.type).to.be.equal(ConnectionEventTypes.ConnectionStateChanged)
          client.terminate()
          resolve(undefined)
        })
      })

      await bobAgent.oob.receiveInvitation(aliceOutOfBandRecord.outOfBandInvitation)
      await waitForMessagePromise
    })
  })

  after(async () => {
    await new Promise(r => setTimeout(r, 2000))
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    app.close()
  })
})
