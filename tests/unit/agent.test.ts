import { expect } from 'chai'
import express from 'express'
import { after, before, describe, test } from 'mocha'

import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'

import { DidCommHttpInboundTransport } from '@credo-ts/node'
import request from 'supertest'
import WebSocket from 'ws'

import { DIDCOMM_WS_PATH, setupAgent } from '../../src/agent.js'
import { terminateDidCommWebSocketClients } from '../../src/utils/didcommWebSocket.js'
import PinoLogger from '../../src/utils/logger.js'
import { ReadinessGate } from '../../src/utils/readiness.js'
import {
  attemptWebSocketUpgrade,
  deleteAgentStore,
  getTestAgent,
  getTestAgentWithPublicApp,
  getTestServer,
  type TestAgent,
} from './utils/helpers.js'

describe('AgentController', () => {
  let app: Server
  let agent: TestAgent

  before(async () => {
    agent = await getTestAgent(3001)
    app = await getTestServer(agent)
  })

  describe('Get agent info', () => {
    test('should return agent information', async () => {
      const response = await request(app).get('/v1/agent')

      expect(response.body).to.have.property('label')
      expect(response.body).to.have.property('endpoints')
      expect(response.body.isInitialized).to.be.equal(true)
    })

    test('should response with a 200 status code', async () => {
      const response = await request(app).get('/v1/agent')

      expect(response.statusCode).to.equal(200)
    })

    test('/health endpoint should give cloudagent version', async () => {
      const response = await request(app).get('/health')

      expect(response.body).to.have.property('version')
    })
  })

  describe('Agent Modules', () => {
    test('should have AnonCreds module registered', () => {
      expect(agent.modules).to.have.property('anoncreds')
    })

    test('should have W3C credentials module registered', () => {
      // W3cCredentialsModule is a core module in BaseAgent, so it is available directly on agent instance
      expect(agent).to.have.property('w3cCredentials')
    })
  })

  describe('Agent bootstrap idempotence', () => {
    const buildConfig = (storeId: string, port: number) => {
      const logger = new PinoLogger('silent')

      return {
        agentConfig: {
          endpoints: [`http://localhost:${port}/didcomm`],
          useDidSovPrefixWhereAllowed: true,
          logger,
          autoUpdateStorageOnStartup: true,
        },
        askarStoreConfig: {
          id: storeId,
          key: 'DZ9hPqFWTPxemcGea72C1X1nusqk5wFNLq6QPjwXGqAa',
          keyDerivationMethod: 'raw' as const,
          database: {
            type: 'sqlite' as const,
          },
        },
        inboundTransports: [
          {
            transport: 'http' as const,
            port,
          },
        ],
        outboundTransports: ['http' as const],
        logger,
        ipfsOrigin: 'https://localhost:5001',
        ipfsTimeoutMs: 15000,
        verifiedDrpcOptions: { proofRequestOptions: { protocolVersion: 'v2' as const, proofFormats: {} } },
      }
    }

    test('should not create additional link secrets when setupAgent runs twice for the same store', async () => {
      const storeId = randomUUID()
      let firstAgent: TestAgent | undefined
      let secondAgent: TestAgent | undefined

      try {
        ;({ agent: firstAgent } = await setupAgent(buildConfig(storeId, 3091)))
        const firstRunLinkSecrets = await firstAgent.modules.anoncreds.getLinkSecretIds()
        expect(firstRunLinkSecrets).to.have.lengthOf(1)

        await firstAgent.shutdown()

        ;({ agent: secondAgent } = await setupAgent(buildConfig(storeId, 3092)))
        const secondRunLinkSecrets = await secondAgent.modules.anoncreds.getLinkSecretIds()
        expect(secondRunLinkSecrets).to.have.lengthOf(1)
      } finally {
        if (secondAgent) {
          await secondAgent.shutdown()
          await deleteAgentStore(secondAgent)
        } else if (firstAgent) {
          await deleteAgentStore(firstAgent)
        }
      }
    })

    test('should remain idempotent across multiple setup and shutdown cycles for the same store', async () => {
      const storeId = randomUUID()
      let currentAgent: TestAgent | undefined
      let cleanupAgent: TestAgent | undefined

      try {
        for (let cycle = 0; cycle < 3; cycle++) {
          ;({ agent: currentAgent } = await setupAgent(buildConfig(storeId, 3093 + cycle)))

          const linkSecretIds = await currentAgent.modules.anoncreds.getLinkSecretIds()
          expect(linkSecretIds).to.have.lengthOf(1)

          cleanupAgent = currentAgent
          await currentAgent.shutdown()
          currentAgent = undefined
        }
      } finally {
        if (currentAgent) {
          await currentAgent.shutdown()
          cleanupAgent = currentAgent
        }

        if (cleanupAgent) {
          await deleteAgentStore(cleanupAgent)
        }
      }
    })

    test('supports HTTP and WS inbound transports without a separate WS port', async () => {
      const config = {
        ...buildConfig(randomUUID(), 3097),
        inboundTransports: [{ transport: 'http' as const, port: 3097 }, { transport: 'ws' as const }],
      }

      let configuredAgent: TestAgent | undefined
      try {
        ;({ agent: configuredAgent } = await setupAgent(config))
      } finally {
        if (configuredAgent) {
          await configuredAgent.shutdown()
          await deleteAgentStore(configuredAgent)
        }
      }
    })

    test('rejects a WS inbound transport that specifies an ignored port', async () => {
      const config = {
        ...buildConfig(randomUUID(), 3096),
        inboundTransports: [
          { transport: 'http' as const, port: 3096 },
          { transport: 'ws' as const, port: 3097 },
        ],
      }

      let error: Error | undefined
      try {
        await setupAgent(config)
      } catch (caughtError) {
        error = caughtError as Error
      }

      expect(error?.message).to.equal('WS inbound transport must not specify a port, it shares the HTTP listener.')
    })

    test('rejects when the public listener cannot bind and leaves readiness false', async () => {
      const occupiedServer = createServer().listen(0)
      await new Promise<void>((resolve) => occupiedServer.once('listening', resolve))
      const occupiedPort = (occupiedServer.address() as AddressInfo).port
      const readinessGate = new ReadinessGate()

      try {
        let error: Error | undefined
        try {
          await setupAgent({ ...buildConfig(randomUUID(), occupiedPort), readinessGate })
        } catch (caughtError) {
          error = caughtError as Error
        }

        expect(error).to.be.instanceOf(Error)
        expect(readinessGate.isReady()).to.equal(false)
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupiedServer.close((closeError) => (closeError ? reject(closeError) : resolve()))
        })
      }
    })
  })

  after(async () => {
    await agent.shutdown()
    await deleteAgentStore(agent)
    app.close()
  })

  test('rejects when the private listener cannot bind and readiness remains false', async () => {
    const occupiedServer = createServer().listen(0)
    await new Promise<void>((resolve) => occupiedServer.once('listening', resolve))
    const occupiedPort = (occupiedServer.address() as AddressInfo).port
    const readinessGate = new ReadinessGate()

    try {
      let error: Error | undefined
      try {
        await getTestServer(agent, occupiedPort)
      } catch (caughtError) {
        error = caughtError as Error
      }

      expect(error).to.be.instanceOf(Error)
      expect(readinessGate.isReady()).to.equal(false)
    } finally {
      await new Promise<void>((resolve, reject) => {
        occupiedServer.close((closeError) => (closeError ? reject(closeError) : resolve()))
      })
    }
  })
})

describe('Shared public protocol listener', () => {
  const port = 3199
  const publicApp = express()
  const readinessGate = new ReadinessGate()
  publicApp.use(readinessGate.middleware)

  let agent: TestAgent
  let httpServer: import('node:http').Server
  let privateServer: import('node:http').Server
  let didCommWsServer: import('ws').WebSocketServer
  let agentShutdown = false

  before(async () => {
    const {
      agent: setupAgentResult,
      didCommHttpInboundTransport,
      didCommWsServer: wsServer,
    } = await getTestAgentWithPublicApp(port, publicApp, readinessGate)
    agent = setupAgentResult
    if (!wsServer) throw new Error('Expected the DIDComm WebSocket server to be configured')
    didCommWsServer = wsServer

    if (!(didCommHttpInboundTransport instanceof DidCommHttpInboundTransport) || !didCommHttpInboundTransport.server) {
      throw new Error('Expected the DIDComm HTTP inbound transport to be configured')
    }
    httpServer = didCommHttpInboundTransport.server

    publicApp.use((_req, res) => {
      res.status(404).end()
    })

    privateServer = await getTestServer(agent)
  })

  after(async () => {
    if (privateServer.listening) {
      await new Promise<void>((resolve, reject) => {
        privateServer.close((error) => {
          if (error) return reject(error)
          resolve()
        })
      })
    }

    if (!agentShutdown) await agent.shutdown()
    await deleteAgentStore(agent)
  })

  test('returns 503 for any /didcomm request before the readiness gate is marked ready', async () => {
    const response = await request(httpServer).get('/didcomm')
    expect(response.statusCode).to.equal(503)
  })

  test('rejects a WebSocket upgrade at /didcomm-ws before the readiness gate is marked ready', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const outcome = await attemptWebSocketUpgrade(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}`)
    expect(outcome).to.equal('rejected')
  })

  test('marks the gate ready and allows requests through', async () => {
    readinessGate.markReady()
    expect(readinessGate.isReady()).to.equal(true)

    const response = await request(httpServer).get('/didcomm')
    expect(response.statusCode).to.not.equal(503)
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
    const outcome = await attemptWebSocketUpgrade(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}`)
    expect(outcome).to.equal('open')
  })

  test('accepts a WebSocket upgrade with a query string', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const outcome = await attemptWebSocketUpgrade(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}?foo=1`)
    expect(outcome).to.equal('open')
  })

  test('accepts a WebSocket upgrade with a trailing slash', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const outcome = await attemptWebSocketUpgrade(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}/`)
    expect(outcome).to.equal('open')
  })

  test('rejects a WebSocket upgrade at an unknown path', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const outcome = await attemptWebSocketUpgrade(`ws://127.0.0.1:${boundPort}/unknown-ws`)
    expect(outcome).to.equal('rejected')
  })

  test('private TSOA app functional', async () => {
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

  test('completes shutdown when DIDComm WebSocket is open', async () => {
    const { port: boundPort } = httpServer.address() as AddressInfo
    const ws = new WebSocket(`ws://127.0.0.1:${boundPort}${DIDCOMM_WS_PATH}`)
    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    terminateDidCommWebSocketClients(didCommWsServer)
    await Promise.race([
      agent.shutdown(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('DIDComm shutdown timed out')), 2000)
      }),
    ])
    agentShutdown = true
  })
})
