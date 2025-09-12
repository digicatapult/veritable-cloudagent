#!/usr/bin/env node
import 'reflect-metadata'

import type { Socket } from 'node:net'

import WebSocket from 'ws'

import { AutoAcceptCredential, AutoAcceptProof } from '@credo-ts/core'
import { clearInterval } from 'node:timers'
import { container } from 'tsyringe'
import { setupAgent } from './agent.js'
import { DidWebServer } from './didweb/index.js'
import { Env } from './env.js'
import { setupServer } from './server.js'
import PinoLogger from './utils/logger.js'

const env = container.resolve(Env)
const logger = new PinoLogger(env.get('LOG_LEVEL'))
container.register(PinoLogger, {
  useValue: logger,
})

const agent = await setupAgent({
  agentConfig: {
    label: env.get('LABEL'),
    logger: logger.child({ component: 'credo-ts-agent' }),
    walletConfig: {
      id: env.get('WALLET_ID'),
      key: env.get('WALLET_KEY'),
      storage:
        env.get('STORAGE_TYPE') === 'sqlite'
          ? {
              type: 'sqlite',
            }
          : {
              type: 'postgres',
              config: {
                host: `${env.get('POSTGRES_HOST') as string}:${env.get('POSTGRES_PORT') as string}`,
              },
              credentials: {
                account: env.get('POSTGRES_USERNAME') as string,
                password: env.get('POSTGRES_PASSWORD') as string,
              },
            },
    },
    endpoints: env.get('ENDPOINT'),
    connectionImageUrl: env.get('CONNECTION_IMAGE_URL'),
    backupBeforeStorageUpdate: env.get('BACKUP_BEFORE_STORAGE_UPDATE'),
    autoUpdateStorageOnStartup: env.get('AUTO_UPDATE_STORAGE_ON_STARTUP'),
    useDidKeyInProtocols: env.get('USE_DID_KEY_IN_PROTOCOLS'),
    useDidSovPrefixWhereAllowed: env.get('USE_DID_SOV_PREFIX_WHERE_ALLOWED'),
  },

  inboundTransports: env.get('INBOUND_TRANSPORT'),
  outboundTransports: env.get('OUTBOUND_TRANSPORT'),

  autoAcceptConnections: env.get('AUTO_ACCEPT_CONNECTIONS'),
  autoAcceptCredentials: env.get('AUTO_ACCEPT_CREDENTIALS') as AutoAcceptCredential,
  autoAcceptProofs: env.get('AUTO_ACCEPT_PROOFS') as AutoAcceptProof,
  autoAcceptMediationRequests: env.get('AUTO_ACCEPT_MEDIATION_REQUESTS'),
  ipfsOrigin: env.get('IPFS_ORIGIN'),

  verifiedDrpcOptions: {
    proofTimeoutMs: env.get('VERIFIED_DRPC_OPTOPNS_PROOF_TIMEOUT_MS'),
    requestTimeoutMs: env.get('VERIFIED_DRPC_OPTIONS_REQUEST_TIMEOUT_MS'),
    proofRequestOptions: env.get('VERIFIED_DRPC_OPTIONS_PROOF_REQUEST_OPTIONS'),
  },

  logger,
})

const socketServer = new WebSocket.Server({ noServer: true })
const zombieSockets = new WeakSet<WebSocket>()
const interval = setInterval(() => {
  logger.trace(`WebSocket PING (socket count = ${socketServer.clients.size})`)
  socketServer.clients.forEach((ws) => {
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

const app = await setupServer(agent, logger, {
  webhookUrl: env.get('WEBHOOK_URL'),
  personaTitle: env.get('PERSONA_TITLE'),
  personaColor: env.get('PERSONA_COLOR'),
  socketServer,
})

const adminPort = env.get('ADMIN_PORT')
const server = app.listen(adminPort, () => {
  logger.info(`Successfully started server on port ${adminPort}`)
})

server.on('upgrade', (request, socket, head) => {
  socketServer.handleUpgrade(request, socket as Socket, head, () => {
    // incoming messages aren't expected so ignore
    return
  })
})

// Start the did:web server if enabled
const didWebServer = new DidWebServer(agent, logger)
try {
  await didWebServer.start()
} catch (error) {
  logger.error(`Failed to start did:web server: ${error}`)
  process.exit(1)
}

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`)
  
  try {
    await didWebServer.stop()
    server.close(() => {
      logger.info('Main server closed')
      process.exit(0)
    })
  } catch (error) {
    logger.error(`Error during shutdown: ${error}`)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
