import type { Server as HttpServer } from 'http'
import type { Socket } from 'node:net'
import { clearInterval } from 'node:timers'

import WebSocket, { WebSocketServer } from 'ws'

import { DidCommAutoAcceptCredential, DidCommAutoAcceptProof } from '@credo-ts/didcomm'
import { container } from 'tsyringe'

import { setupAgent, type InboundTransport, type RestAgent } from './agent.js'
import Database from './didweb/db.js'
import { DidWebServer } from './didweb/server.js'
import type { Env } from './env.js'
import { setupServer } from './server.js'
import { DidWebDocGenerator } from './utils/didWebGenerator.js'
import PinoLogger from './utils/logger.js'

const SHUTDOWN_TIMEOUT_MS = 15000

export interface CloudagentHandle {
  agent: RestAgent
  adminServer: HttpServer
  didWebServer: DidWebServer
  shutdown(): Promise<void>
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

const closeServer = async (server?: HttpServer) => {
  if (!server || !server.listening) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
          resolve()
          return
        }
        reject(error)
        return
      }
      resolve()
    })
  })
}

const closeWebSocketServer = async (server?: WebSocketServer, terminateClients = false) => {
  if (!server) {
    return
  }

  if (terminateClients) {
    for (const client of server.clients) {
      client.terminate()
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        if (error.message === 'The server is not running') {
          resolve()
          return
        }

        reject(error)
        return
      }
      resolve()
    })
  })
}

const listen = async (server: HttpServer) => {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', (error) => reject(error))
  })
}

export async function startCloudagent(env: Env, logger: PinoLogger): Promise<CloudagentHandle> {
  container.register(PinoLogger, {
    useValue: logger,
  })

  const inboundTransports = env.get('INBOUND_TRANSPORT') as InboundTransport[]

  const didcommWsEntry = inboundTransports.find(
    (transport) => transport.transport === 'ws' && typeof transport.port === 'number'
  )

  let agent: RestAgent | undefined
  let didWebServer: DidWebServer | undefined
  let adminServer: HttpServer | undefined
  let adminSocketServer: WebSocketServer | undefined
  let didcommSocketServer: WebSocketServer | undefined
  let shuttingDownPromise: Promise<void> | undefined

  try {
    if (didcommWsEntry) {
      didcommSocketServer = new WebSocketServer({ port: didcommWsEntry.port })
      await new Promise<void>((resolve, reject) => {
        didcommSocketServer!.once('listening', () => resolve())
        didcommSocketServer!.once('error', (error) => reject(error))
      })
    }

    agent = await setupAgent({
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

      inboundTransports,
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

      didcommWsSocketServer: didcommSocketServer,
      logger,
    })

    const database = new Database({
      host: env.get('POSTGRES_HOST'),
      database: env.get('DID_WEB_DB_NAME'),
      user: env.get('POSTGRES_USERNAME'),
      password: env.get('POSTGRES_PASSWORD'),
      port: env.get('POSTGRES_PORT'),
    })

    didWebServer = new DidWebServer(logger.logger, database, {
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
      (document) => didWebServer!.upsertDid(document)
    )

    adminSocketServer = new WebSocketServer({ noServer: true })
    const zombieSockets = new WeakSet<WebSocket>()
    const interval = setInterval(() => {
      logger.trace(`WebSocket PING (socket count = ${adminSocketServer!.clients.size})`)
      adminSocketServer!.clients.forEach((ws: WebSocket) => {
        ws.once('pong', () => {
          logger.debug('WebSocket PONG')
          zombieSockets.delete(ws)
        })

        if (zombieSockets.has(ws)) {
          logger.warn('Terminating dead WebSocket')
          ws.terminate()
          return
        }

        zombieSockets.add(ws)
        ws.ping()
      })
    }, env.get('ADMIN_PING_INTERVAL_MS'))

    adminSocketServer.on('close', () => {
      clearInterval(interval)
    })

    const app = await setupServer(agent, logger, {
      webhookUrl: env.get('WEBHOOK_URL'),
      personaTitle: env.get('PERSONA_TITLE'),
      personaColor: env.get('PERSONA_COLOR'),
      socketServer: adminSocketServer,
    })

    const adminPort = env.get('ADMIN_PORT')
    adminServer = app.listen(adminPort)
    await listen(adminServer)

    logger.info(`Successfully started server on port ${adminPort}`)

    adminServer.on('upgrade', (request, socket, head) => {
      adminSocketServer!.handleUpgrade(request, socket as Socket, head, () => {
        // incoming messages aren't expected so ignore
        return
      })
    })

    const shutdown = async () => {
      if (!shuttingDownPromise) {
        shuttingDownPromise = (async () => {
          await closeServer(adminServer)
          await closeWebSocketServer(adminSocketServer, true)
          await didWebServer!.stop()

          if (didcommSocketServer) {
            // Remove once upstream websocket transport closes connected clients during stop.
            for (const client of didcommSocketServer.clients) {
              client.terminate()
            }
          }

          // Keep timeout as a backstop to avoid indefinite shutdown hangs.
          await withTimeout(agent!.shutdown(), SHUTDOWN_TIMEOUT_MS, 'agent.shutdown')
          await closeWebSocketServer(didcommSocketServer)
        })()
      }

      return shuttingDownPromise
    }

    return {
      agent,
      adminServer,
      didWebServer,
      shutdown,
    }
  } catch (error) {
    try {
      await closeServer(adminServer)
      await closeWebSocketServer(adminSocketServer, true)
      await didWebServer?.stop()

      if (didcommSocketServer) {
        for (const client of didcommSocketServer.clients) {
          client.terminate()
        }
      }

      if (agent) {
        await withTimeout(agent.shutdown(), SHUTDOWN_TIMEOUT_MS, 'agent.shutdown')
      }

      await closeWebSocketServer(didcommSocketServer)
    } catch (cleanupError) {
      logger.error('Error during startup cleanup', { cleanupError })
    }

    throw error
  }
}
