import type { RestAgent } from '../../src/utils/agent.js'

import type { Express } from 'express'
import { describe, before, afterEach, test } from 'mocha'
import { expect } from 'chai'
import { stub, restore as sinonRestore, useFakeTimers, type SinonFakeTimers, type SinonSpy } from 'sinon'
import request from 'supertest'

import { setupServer } from '../../src/server.js'
import { getTestAgent, getTestConnection } from './utils/helpers.js'
import { ConnectionRecord } from '@credo-ts/core'
import { container } from 'tsyringe'
import DrpcReceiveHandler from '../../src/drpc-handler/index.js'
import { NotFound } from '../../src/error.js'

describe('DrpcController', () => {
  let app: Express
  let agent: RestAgent
  let connection: ConnectionRecord
  let clock: SinonFakeTimers
  let receiveHandler: DrpcReceiveHandler

  before(async () => {
    agent = await getTestAgent('DRPC REST Agent Test', 3011)
    app = await setupServer(agent, { port: 3000 })
    connection = getTestConnection()
    receiveHandler = container.resolve(DrpcReceiveHandler)
  })

  beforeEach(() => {
    clock = useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
    sinonRestore()
  })

  describe('create drpc request', () => {
    test("should return undefined if there's no response", async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.resolves(stub().resolves(undefined))

      const response = await request(app).post(`/v1/drpc/${connection.id}/request`).send({
        jsonrpc: '2.0',
        method: 'test',
        params: [],
      })
      expect(response.statusCode).to.be.equal(204)
    })

    test('should return response if format is valid', async () => {
      const spy = stub(agent.modules.drpc, 'sendRequest')
      spy.resolves(
        stub().resolves({
          jsonrpc: '2.0',
          result: 'result',
          id: 'test',
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
        id: 'test',
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

      let waitResolve: Function
      const waitForResponseListener = new Promise<void>((resolve) => {
        waitResolve = resolve
      })

      spy.resolves(
        stub().callsFake(() => {
          waitResolve()
          return new Promise(() => {})
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

      const response = await request(app).post(`/v1/drpc/test-id/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(204)
      expect(spy.callCount).to.equal(1)
      expect(spy.firstCall.args).to.deep.equal([
        'test-id',
        {
          jsonrpc: '2.0',
          result: 'test',
        },
      ])
    })

    test('should return not found if requestId is not valid', async () => {
      const spy = stub(receiveHandler, 'respondToRequest')
      spy.rejects(new NotFound())

      const response = await request(app).post(`/v1/drpc/test-id/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(404)
    })

    test('should return internal error for other errors', async () => {
      const spy = stub(receiveHandler, 'respondToRequest')
      spy.rejects(new Error())

      const response = await request(app).post(`/v1/drpc/test-id/response`).send({
        jsonrpc: '2.0',
        result: 'test',
      })
      expect(response.statusCode).to.be.equal(500)
    })
  })
})
