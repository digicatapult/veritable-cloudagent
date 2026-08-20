import { expect } from 'chai'
import express from 'express'
import { after, before, describe, test } from 'mocha'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import request from 'supertest'
import WebSocket from 'ws'

import { DidCommHttpInboundTransport } from '@credo-ts/node'
import { container } from 'tsyringe'

import { DIDCOMM_WS_PATH, setupAgent } from '../../src/agent.js'
import PinoLogger from '../../src/utils/logger.js'
import { ReadinessGate } from '../../src/utils/readiness.js'
import { deleteAgentStore, getTestServer, type TestAgent } from './utils/helpers.js'

describe('Shared public protocol listener', () => {
  const port = 3199
  const publicApp = express()
  const readinessGate = new ReadinessGate()
  publicApp.use(readinessGate.middleware)

  let agent: TestAgent
  let httpServer: import('node:http').Server
  let privateServer: import('node:http').Server

  before(async () => {
    const logger = new PinoLogger('silent')
    container.register(PinoLogger, { useValue: logger })

    const {
      agent: setupAgentResult,
      didCommHttpInboundTransport,
      didCommWsServer,
    } = await setupAgent({
      agentConfig: {
        endpoints: [`http://localhost:${port}/didcomm`],
        useDidSovPrefixWhereAllowed: true,
        logger,
        autoUpdateStorageOnStartup: true,
      },
      askarStoreConfig: {
        id: randomUUID(),
        key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa',
        keyDerivationMethod: 'raw',
        database: { type: 'sqlite' },
      },
      publicApp,
      inboundTransports: [
        { transport: 'http', port },
        { transport: 'ws', port: 0 },
      ],
      outboundTransports: ['http'],
      logger,
      ipfsOrigin: 'https://localhost:5001',
      ipfsTimeoutMs: 15000,
      verifiedDrpcOptions: { proofRequestOptions: { protocolVersion: 'v2', proofFormats: {} } },
    })
    agent = setupAgentResult

    if (!(didCommHttpInboundTransport instanceof DidCommHttpInboundTransport) || !didCommHttpInboundTransport.server) {
      throw new Error('Expected the DIDComm HTTP inbound transport to be configured')
    }
    httpServer = didCommHttpInboundTransport.server

    httpServer.on('upgrade', (req, socket, head) => {
      if (req.url !== DIDCOMM_WS_PATH || !didCommWsServer) {
        socket.destroy()
        return
      }
      didCommWsServer.handleUpgrade(req, socket, head, (ws) => didCommWsServer.emit('connection', ws, req))
    })

    privateServer = await getTestServer(agent)
  })

  after(async () => {
    await agent.shutdown()
    await deleteAgentStore(agent)
  })

  test('returns 503 for any request before the readiness gate is marked ready', async () => {
    const response = await request(httpServer).get('/didcomm')
    expect(response.statusCode).to.equal(503)
  })

  test('marks the gate ready and allows requests through', () => {
    readinessGate.markReady()
    expect(readinessGate.isReady()).to.equal(true)
  })

  test('routes DIDComm HTTP only through /didcomm', async () => {
    const response = await request(httpServer).post('/didcomm').set('content-type', 'text/plain').send('not-didcomm')
    expect(response.statusCode).to.equal(415)
  })

  test('does not capture an unrelated public POST at the root path', async () => {
    const response = await request(httpServer).post('/').send({})
    expect(response.statusCode).to.equal(404)
  })

  test('accepts a WebSocket upgrade at /didcomm-ws', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const ws = new WebSocket(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}`)

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve())
      ws.once('error', reject)
    })

    ws.close()
  })

  test('rejects a WebSocket upgrade at an unknown path', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const ws = new WebSocket(`ws://127.0.0.1:${boundPort}/unknown-ws`)

    await new Promise<void>((resolve) => {
      ws.once('open', () => {
        ws.close()
        resolve()
      })
      ws.once('error', () => resolve())
      ws.once('close', () => resolve())
    })

    expect(ws.readyState).to.not.equal(WebSocket.OPEN)
  })

  test('private TSOA app remains functional after the public/private split', async () => {
    const response = await request(privateServer).get('/v1/agent')
    expect(response.statusCode).to.equal(200)
  })

  test('private app does not serve public DIDComm routes', async () => {
    const response = await request(privateServer).post('/didcomm').set('content-type', 'text/plain').send('x')
    expect(response.statusCode).to.equal(404)
  })

  test('public app does not serve private TSOA routes', async () => {
    const response = await request(httpServer).get('/v1/agent')
    expect(response.statusCode).to.equal(404)
  })
})
