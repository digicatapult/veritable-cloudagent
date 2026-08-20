#!/usr/bin/env node
import 'reflect-metadata'

import type { Socket } from 'node:net'

import { DidCommHttpInboundTransport } from '@credo-ts/node'
import express from 'express'
import WebSocket, { WebSocketServer } from 'ws'

import { DidCommAutoAcceptCredential, DidCommAutoAcceptProof } from '@credo-ts/didcomm'
import { clearInterval } from 'node:timers'
import { container } from 'tsyringe'
import { setupAgent } from './agent.js'
import Database from './didweb/db.js'
import { DidWebServer } from './didweb/server.js'
import { Env } from './env.js'
import { errorHandler } from './error.js'
import { setupServer } from './server.js'
import { DidWebDocGenerator } from './utils/didWebGenerator.js'
import PinoLogger, { createRequestLogger } from './utils/logger.js'
import { ReadinessGate } from './utils/readiness.js'

const env = container.resolve(Env)
const logger = new PinoLogger(env.get('LOG_LEVEL'))
container.register(PinoLogger, {
  useValue: logger,
})

// Shared public protocol application: DIDComm HTTP/WS live here, and OpenID4VC will join it in a later PR.
const publicApp = express()
const readinessGate = new ReadinessGate()
publicApp.use(createRequestLogger(logger.logger))
publicApp.use(readinessGate.middleware)

const { agent, didCommHttpInboundTransport } = await setupAgent({
  agentConfig: {
    logger: logger.child({ component: 'credo-ts-agent' }),
    endpoints: env.get('ENDPOINT'),
    autoUpdateStorageOnStartup: env.get('AUTO_UPDATE_STORAGE_ON_STARTUP'),
    useDidKeyInProtocols: env.get('USE_DID_KEY_IN_PROTOCOLS'),
    useDidSovPrefixWhereAllowed: env.get('USE_DID_SOV_PREFIX_WHERE_ALLOWED'),
  },

  askarStoreConfig: {
    id: env.get('WALLET_ID'),
    key: env.get('WALLET_KEY'),
    database:
      env.get('STORAGE_TYPE') === 'sqlite'
        ? {
            type: 'sqlite',
          }
        : {
            type: 'postgres',
            config: {
              host: `${env.get('POSTGRES_HOST') as string}:${String(env.get('POSTGRES_PORT'))}`,
            },
            credentials: {
              account: env.get('POSTGRES_USERNAME') as string,
              password: env.get('POSTGRES_PASSWORD') as string,
            },
          },
  },

  publicApp,
  readinessGate,
  inboundTransports: env.get('INBOUND_TRANSPORT'),
  outboundTransports: env.get('OUTBOUND_TRANSPORT'),

  autoAcceptConnections: env.get('AUTO_ACCEPT_CONNECTIONS'),
  autoAcceptCredentials: env.get('AUTO_ACCEPT_CREDENTIALS') as DidCommAutoAcceptCredential,
  autoAcceptProofs: env.get('AUTO_ACCEPT_PROOFS') as DidCommAutoAcceptProof,
  autoAcceptMediationRequests: env.get('AUTO_ACCEPT_MEDIATION_REQUESTS'),
  ipfsOrigin: env.get('IPFS_ORIGIN'),
  ipfsTimeoutMs: env.get('IPFS_TIMEOUT_MS'),

  verifiedDrpcOptions: {
    proofTimeoutMs: env.get('VERIFIED_DRPC_OPTIONS_PROOF_TIMEOUT_MS'),
    requestTimeoutMs: env.get('VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS'),
    proofRequestOptions: env.get('VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS'),
  },

  logger,
})

// Final handlers for the public app: DIDComm's own route is registered above; anything else 404s.
publicApp.use((_req, res) => {
  res.status(404).json({ error: 'not_found' })
})
publicApp.use(errorHandler(agent.config.logger))

// DidCommHttpInboundTransport owns the only listen() call for the shared public app. WebSocket upgrade
// dispatch (readiness gating, path routing, handleUpgrade) is wired by setupAgent itself.
if (!(didCommHttpInboundTransport instanceof DidCommHttpInboundTransport) || !didCommHttpInboundTransport.server) {
  throw new Error('Expected DidCommHttpInboundTransport to be configured with an HTTP inbound transport')
}

const database = new Database({
  host: env.get('POSTGRES_HOST'),
  database: env.get('DID_WEB_DB_NAME'),
  user: env.get('POSTGRES_USERNAME'),
  password: env.get('POSTGRES_PASSWORD'),
  port: env.get('POSTGRES_PORT'),
})
const didWebServer = new DidWebServer(logger.logger, database, {
  enabled: env.get('DID_WEB_ENABLED'),
  port: env.get('DID_WEB_PORT'),
  useDevCert: env.get('DID_WEB_USE_DEV_CERT'),
  certPath: env.get('DID_WEB_DEV_CERT_PATH'),
  keyPath: env.get('DID_WEB_DEV_KEY_PATH'),
  didWebDomain: env.get('DID_WEB_DOMAIN'),
})
await didWebServer.start()

const didWebGenerator = new DidWebDocGenerator(agent, logger.logger)
await didWebGenerator.generateAndRegister(
  env.get('DID_WEB_DOMAIN'),
  env.get('DID_WEB_SERVICE_ENDPOINT'),
  env.get('DID_WEB_ENABLED'),
  (document) => didWebServer.upsertDid(document)
)

// Private notification WebSocket: unrelated to DIDComm transport, stays on the private admin listener.
const socketServer = new WebSocketServer({ noServer: true })
const zombieSockets = new WeakSet<WebSocket>()
const interval = setInterval(() => {
  logger.trace(`WebSocket PING (socket count = ${socketServer.clients.size})`)
  socketServer.clients.forEach((ws: WebSocket) => {
    ws.once('pong', () => {
      logger.debug('WebSocket PONG')
      zombieSockets.delete(ws)
    })

    if (zombieSockets.has(ws)) {
      logger.warn(`Terminating dead WebSocket`)
      return ws.terminate()
    }

    zombieSockets.add(ws)
    ws.ping()
  })
}, env.get('ADMIN_PING_INTERVAL_MS'))
socketServer.on('close', () => {
  clearInterval(interval)
})

const privateApp = await setupServer(agent, logger, {
  webhookUrl: env.get('WEBHOOK_URL'),
  personaTitle: env.get('PERSONA_TITLE'),
  personaColor: env.get('PERSONA_COLOR'),
  socketServer,
})

const adminPort = env.get('ADMIN_PORT')
const server = privateApp.listen(adminPort)

await new Promise<void>((resolve, reject) => {
  const onListening = () => {
    server.off('error', onError)
    logger.info(`Successfully started OpenAPI server on port ${adminPort}`)
    resolve()
  }

  const onError = (error: Error) => {
    server.off('listening', onListening)
    reject(error)
  }

  server.once('listening', onListening)
  server.once('error', onError)
})

server.on('upgrade', (request, socket, head) => {
  socketServer.handleUpgrade(request, socket as Socket, head, () => {
    // incoming messages aren't expected so ignore
    return
  })
})

// Public and private listeners, TSOA routes and DID:web are all up: only now accept protocol traffic.
readinessGate.markReady()
