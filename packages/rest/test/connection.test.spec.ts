import { describe, before, after, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore } from 'sinon'

import type { Agent, ConnectionRecord } from '@aries-framework/core'
import type { Server } from 'net'

import { ConnectionEventTypes, ConnectionRepository } from '@aries-framework/core'
import request from 'supertest'
import WebSocket from 'ws'

import { startServer } from '../src'

import { getTestConnection, getTestAgent, objectToJson } from './utils/helpers'

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

  afterEach(() => {
    sinonRestore()
  })

  describe('Get all connections', () => {
    test('should return all connections', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const spy = stub(connectionRepository, 'findByQuery')
      spy.resolves([connection])

      const response = await request(app).get('/connections')

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by state', () => {
    test('should return all credentials by specified state', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ state: connection.state })

      expect(findByQuerySpy.calledWithMatch({
        state: connection.state,
      })).equals(true)

      expect(response.statusCode).to.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by outOfBandId', () => {
    test('should return all credentials by specified outOfBandId', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ outOfBandId: connection.outOfBandId })

      expect(findByQuerySpy.calledWithMatch({
        outOfBandId: connection.outOfBandId,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by alias', () => {
    test('should return all credentials by specified alias', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ alias: connection.alias })

      expect(findByQuerySpy.calledWithMatch({
        alias: connection.alias,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by myDid', () => {
    test('should return all credentials by specified peer did', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ myDid: connection.did })

      expect(findByQuerySpy.calledWithMatch({
        myDid: connection.did,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by theirDid', () => {
    test('should return all credentials by specified peer did', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ theirDid: connection.theirDid })

      expect(findByQuerySpy.calledWithMatch({
        theirDid: connection.theirDid,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get all connections by theirLabel', () => {
    test('should return all credentials by specified peer label', async () => {
      const connectionRepository = bobAgent.dependencyManager.resolve(ConnectionRepository)
      const findByQuerySpy = stub(connectionRepository, 'findByQuery')
      findByQuerySpy.resolves([connection])

      const response = await request(app).get('/connections').query({ theirLabel: connection.theirLabel })

      expect(findByQuerySpy.calledWithMatch({
        theirLabel: connection.theirLabel,
      })).equals(true)

      expect(response.statusCode).to.be.equal(200)
      expect(response.body).to.deep.equal([connection].map(objectToJson))
    })
  })

  describe('Get connection by id', () => {
    test('should return connection record', async () => {
      const spy = stub(bobAgent.connections, 'findById')
      spy.resolves(connection)
      const getResult = (): Promise<ConnectionRecord | null> => spy.firstCall.returnValue

      const response = await request(app).get(`/connections/${connection.id}`)

      expect(response.statusCode).to.be.equal(200)
      expect(spy.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app).get(`/connections/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Accept response', () => {
    test('should return accepted connection record', async () => {
      const spy = stub(bobAgent.connections, 'acceptResponse')
      spy.resolves(connection)
      const getResult = (): Promise<ConnectionRecord | null> => spy.firstCall.returnValue

      const response = await request(app).post(`/connections/${connection.id}/accept-response`)

      expect(response.statusCode)
      expect(spy.calledWithMatch(connection.id)).equals(true)
      expect(response.body).to.deep.equal(objectToJson(await getResult()))
    })

    test('should throw error when connectionId is not found', async () => {
      const response = await request(app).post(`/connections/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/accept-response`)

      expect(response.statusCode).to.be.equal(404)
    })
  })

  describe('Connection WebSocket Event', () => {
    test('should return connection event sent from test agent to websocket client', async () => {
      // // todo: Needs Cleaning
      // // expect.assertions(1)
      // class ExpectCounter {
      //   actual: number
      //   expected: any
      //   constructor(expected: any) {
      //     this.actual = 0, this.expected = expected
      //   }
      //   expect(...args: any[]) {
      //     this.actual++
      //     return expect([...args][0])
      //   }
      // }
      // const count = new ExpectCounter(1)

      const client = new WebSocket('ws://localhost:3009')

      const aliceOutOfBandRecord = await aliceAgent.oob.createInvitation()

      let connectionEvent: ConnectionEventTypes | null = null
      const waitForMessagePromise = new Promise((resolve) => {
        client.on('message', (data) => {
          const event = JSON.parse(data as string)

          // count.expect(event.type).to.be.equal(ConnectionEventTypes.ConnectionStateChanged)
          connectionEvent = event.type
          client.terminate()
          resolve(undefined)
        })
      })

      await bobAgent.oob.receiveInvitation(aliceOutOfBandRecord.outOfBandInvitation)
      await waitForMessagePromise

      expect(connectionEvent).to.be.equal(ConnectionEventTypes.ConnectionStateChanged)
      // expect(count.actual).to.be.equal(count.expected)
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
