import type { Server } from 'node:net'
import type { RestAgent } from '../../src/agent.js'

import { expect } from 'chai'
import { afterEach, before, describe, test } from 'mocha'
import { restore as sinonRestore, stub, useFakeTimers, type SinonFakeTimers } from 'sinon'
import request from 'supertest'

import { ConnectionRecord, RecordNotFoundError } from '@credo-ts/core'
import { container } from 'tsyringe'
import DrpcReceiveHandler from '../../src/drpc-handler/index.js'
import { NotFoundError } from '../../src/error.js'
import { getTestAgent, getTestConnection, getTestServer } from './utils/helpers.js'

describe('DrpcController', () => {
  let app: Server
  let agent: RestAgent
  let connection: ConnectionRecord
  let clock: SinonFakeTimers
  let receiveHandler: DrpcReceiveHandler

  before(async () => {
    agent = await getTestAgent('DRPC REST Agent Test', 3011)
    app = await getTestServer(agent)
    connection = getTestConnection()
    receiveHandler = container.resolve(DrpcReceiveHandler)
  })

  beforeEach(() => {
    clock = useFakeTimers({ toFake: ['setTimeout'] })
  })

  afterEach(() => {
    clock.restore()
    sinonRestore()
  })

  describe('create drpc request', () => {
    test('should return gateway timeout when response listener resolves undefined', async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.resolves(stub().resolves(undefined))
      const response = await request(app).post(`/v1/drpc/${connection.id}/request`).send({
        jsonrpc: '2.0',
        method: 'test',
        params: [],
      })
      expect(response.statusCode).to.be.equal(504)
    })

    test('should return not found when connection id does not exist', async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.rejects(new RecordNotFoundError('connection not found', { recordType: 'ConnectionRecord' }))

      const response = await request(app).post(`/v1/drpc/${connection.id}/request`).send({
        jsonrpc: '2.0',
        method: 'test',
        params: [],
      })

      expect(response.statusCode).to.be.equal(404)
      expect(response.body).to.deep.equal({
        code: 404,
        message: 'connection not found',
        details: {
          connectionId: connection.id,
        },
      })
    })

    test('should return response if format is valid', async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.resolves(
        stub().resolves({
          jsonrpc: '2.0',
          result: 'result',
          id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        })
      )

      const response = await request(app).post(`/v1/drpc/${connection.id}/request`).send({
        jsonrpc: '2.0',
        method: 'test',
        params: [],
      })
      expect(response.statusCode).to.be.equal(200)
      expect(response.body).deep.equal({
        jsonrpc: '2.0',
        result: 'result',
        id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      })
    })

    test('should return bad gateway if response is invalid', async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.resolves(stub().resolves({}))

      const response = await request(app).post(`/v1/drpc/${connection.id}/request`).send({
        jsonrpc: '2.0',
        method: 'test',
        params: [],
      })
      expect(response.statusCode).to.be.equal(502)
    })

    test('should return gateway timeout if no response after 5000', async function () {
      this.timeout(500)

      const spy = stub(agent.modules.drpc, 'sendRequest')

      let waitResolve: (value: void | PromiseLike<void>) => void
      const waitForResponseListener = new Promise<void>((resolve) => {
        waitResolve = resolve
      })

      spy.resolves(
        stub().callsFake((timeoutMs?: number) => {
          waitResolve()
          return new Promise((resolve) => {
            setTimeout(() => resolve(undefined), timeoutMs)
          })
        })
      )

      const responseP = request(app)
        .post(`/v1/drpc/${connection.id}/request`)
        .send({
          jsonrpc: '2.0',
          method: 'test',
          params: [],
        })
        .then((x) => x)

      await waitForResponseListener
      await clock.tickAsync(5000)

      const response = await responseP
      expect(response.statusCode).to.be.equal(504)
    })
  })

  describe('create drpc response', () => {
    test('should send response returning 204', async () => {
      const spy = stub(receiveHandler, 'respondToRequest')
      spy.resolves()

      const response = await request(app).post(`/v1/drpc/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(204)
      expect(spy.callCount).to.equal(1)
      expect(spy.firstCall.args).to.deep.equal([
        'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        {
          jsonrpc: '2.0',
          result: 'test',
        },
      ])
    })

    test('should return not found if requestId is not valid', async () => {
      const spy = stub(receiveHandler, 'respondToRequest')
      spy.rejects(new NotFoundError())

      const response = await request(app).post(`/v1/drpc/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(404)
    })

    test('should return internal error for other errors', async () => {
      const spy = stub(receiveHandler, 'respondToRequest')
      spy.rejects(new Error())

      const response = await request(app).post(`/v1/drpc/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(500)
    })
  })

  after(async function () {
    app.close()
  })
})
