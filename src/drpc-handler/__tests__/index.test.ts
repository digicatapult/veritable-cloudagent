import { expect } from 'chai'
import { describe, test } from 'mocha'
import sinon from 'sinon'

import { RestAgent } from '../../agent.js'
import { NotFound } from '../../error.js'
import PinoLogger from '../../utils/logger.js'
import DrpcReceiveHandler from '../index.js'

async function* requestsGen<T>(items: Array<T>) {
  for (let i = 0; i < items.length; i++) {
    yield await Promise.resolve(items[i])
  }
}

const withMocks = () => {
  const requests = [
    { request: { id: '0' }, sendResponse: sinon.stub().resolves() },
    { request: { id: '1' }, sendResponse: sinon.stub().resolves() },
  ]

  const gen = requestsGen(requests)
  const agent = {
    modules: {
      drpc: {
        recvRequest: sinon.stub().callsFake(async () => {
          const val = await gen.next()
          if (!val.done) {
            return val.value
          }

          return Promise.resolve(() => {}) // never resolve
        }),
      },
    },
  }
  const logger = new PinoLogger('silent')

  return {
    agent,
    logger,
    requests,
    args: [agent as unknown as RestAgent, logger as PinoLogger] as const,
  }
}

describe('DrpcReceiveHandler', function () {
  test('start loop fetches all requests', async function () {
    const { agent, args } = withMocks()
    const handler = new DrpcReceiveHandler(...args)
    handler.start()
    await new Promise((resolve) => setTimeout(resolve, 10)) // wait for a short period just to make sure the loop has run to end

    expect(agent.modules.drpc.recvRequest.callCount).to.equal(3)
  })

  test('respond to request 0', async function () {
    const { requests, args } = withMocks()
    const handler = new DrpcReceiveHandler(...args)
    handler.start()
    await new Promise((resolve) => setTimeout(resolve, 10)) // wait for a short period just to make sure the loop has run to end

    await handler.respondToRequest('0', { jsonrpc: '2.0' })

    expect(requests[0].sendResponse.callCount).to.equal(1)
    expect(requests[1].sendResponse.callCount).to.equal(0)
  })

  test('respond to request 1', async function () {
    const { requests, args } = withMocks()
    const handler = new DrpcReceiveHandler(...args)
    handler.start()
    await new Promise((resolve) => setTimeout(resolve, 10)) // wait for a short period just to make sure the loop has run to end

    await handler.respondToRequest('1', { jsonrpc: '2.0' })

    expect(requests[0].sendResponse.callCount).to.equal(0)
    expect(requests[1].sendResponse.callCount).to.equal(1)
  })

  test('duplicate response should throw', async function () {
    const { args } = withMocks()
    const handler = new DrpcReceiveHandler(...args)
    handler.start()
    await new Promise((resolve) => setTimeout(resolve, 10)) // wait for a short period just to make sure the loop has run to end
    handler.respondToRequest('0', { jsonrpc: '2.0' })

    let error: unknown
    try {
      await handler.respondToRequest('0', { jsonrpc: '2.0' })
    } catch (err) {
      error = err
    }

    expect(error).instanceOf(NotFound)
  })

  test('response to invalid id should throw', async function () {
    const { args } = withMocks()
    const handler = new DrpcReceiveHandler(...args)
    handler.start()
    await new Promise((resolve) => setTimeout(resolve, 10)) // wait for a short period just to make sure the loop has run to end

    let error: unknown
    try {
      await handler.respondToRequest('42', { jsonrpc: '2.0' })
    } catch (err) {
      error = err
    }

    expect(error).instanceOf(NotFound)
  })
})
