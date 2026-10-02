import type { Server as HttpServer } from 'http'
import type { Socket } from 'node:net'
import { clearInterval } from 'node:timers'

import express from 'express'
import WebSocket, { WebSocketServer } from 'ws'

import { DidCommAutoAcceptCredential, DidCommAutoAcceptProof } from '@credo-ts/didcomm'
import { container } from 'tsyringe'

import { setupAgent, type InboundTransport, type RestAgent } from './agent.js'
import Database from './didweb/db.js'
import { DidWebServer } from './didweb/server.js'
import DrpcReceiveHandler from './drpc-handler/index.js'
import type { Env } from './env.js'
import { createAdminApiApp, setupAdminApi } from './server.js'
import { DidWebDocGenerator } from './utils/didWebGenerator.js'
import PinoLogger from './utils/logger.js'

const SHUTDOWN_TIMEOUT_MS = 15000

export interface CloudagentHandle {
  agent: RestAgent
  adminApiServer: HttpServer
  didcommHttpServer?: HttpServer
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
    terminateWebSocketClients(server)
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

const terminateWebSocketClients = (server: WebSocketServer) => {
  for (const client of server.clients) {
    client.terminate()
  }
}

const listen = async (server: HttpServer) => {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve())
    server.once('error', (error) => reject(error))
  })
}

const cleanupResources = async (
  logger: PinoLogger,
  resources: {
    agent?: RestAgent
    adminApiServer?: HttpServer
    didcommHttpServer?: HttpServer
    adminSocketServer?: WebSocketServer
    didWebServer?: DidWebServer
    didcommSocketServers?: WebSocketServer[]
  }
) => {
  const errors: unknown[] = []
  const attempt = async (name: string, cleanup: () => Promise<void>) => {
    try {
      await cleanup()
    } catch (error) {
      logger.error(`Failed to ${name}`, { error })
      errors.push(error)
    }
  }

  await attempt('close admin WebSocket server', () => closeWebSocketServer(resources.adminSocketServer, true))
  await attempt('close admin API HTTP server', () => closeServer(resources.adminApiServer))
  await attempt('close DIDComm HTTP server', () => closeServer(resources.didcommHttpServer))
  await attempt('stop DID:web server', async () => {
    await resources.didWebServer?.stop()
  })

  for (const server of resources.didcommSocketServers ?? []) {
    terminateWebSocketClients(server)
  }

  if (resources.agent) {
    await attempt('stop DRPC receive handler', async () => container.resolve(DrpcReceiveHandler).stop())
    await attempt('shut down agent', () =>
      withTimeout(resources.agent!.shutdown(), SHUTDOWN_TIMEOUT_MS, 'agent.shutdown')
    )
  }

  for (const server of resources.didcommSocketServers ?? []) {
    await attempt('close DIDComm WebSocket server', () => closeWebSocketServer(server))
  }

  return errors
}

export async function startCloudagent(env: Env, logger: PinoLogger): Promise<CloudagentHandle> {
  container.register(PinoLogger, {
    useValue: logger,
  })

  const inboundTransports = env.get('INBOUND_TRANSPORT') as InboundTransport[]

  const didcommWsEntries = inboundTransports.filter(
    (transport) => transport.transport === 'ws' && typeof transport.port === 'number'
  )
  const didcommHttpEntry = inboundTransports.find(
    (transport) => transport.transport === 'http' && typeof transport.port === 'number'
  )

  let agent: RestAgent | undefined
  let didWebServer: DidWebServer | undefined
  let adminApiServer: HttpServer | undefined
  let didcommHttpServer: HttpServer | undefined
  let adminSocketServer: WebSocketServer | undefined
  const didcommSocketServers: WebSocketServer[] = []
  let shuttingDownPromise: Promise<void> | undefined

  try {
    const didcommHttpApp = express()
    const adminApiApp = createAdminApiApp(logger)

    for (const didcommWsEntry of didcommWsEntries) {
      const didcommSocketServer = new WebSocketServer({ port: didcommWsEntry.port })
      didcommSocketServers.push(didcommSocketServer)
      await new Promise<void>((resolve, reject) => {
        const onListening = () => {
          didcommSocketServer.off('error', onError)
          resolve()
        }
        const onError = (error: Error) => {
          didcommSocketServer.off('listening', onListening)
          reject(error)
        }
        didcommSocketServer.once('listening', onListening)
        didcommSocketServer.once('error', onError)
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
      didcommHttpApp,
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

      didcommWsSocketServers: didcommSocketServers,
      logger,
    })

    if (didcommHttpEntry?.port !== undefined) {
      didcommHttpServer = didcommHttpApp.listen(didcommHttpEntry.port)
      await listen(didcommHttpServer)
    }

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

    await setupAdminApi(
      agent,
      logger,
      {
        webhookUrl: env.get('WEBHOOK_URL'),
        personaTitle: env.get('PERSONA_TITLE'),
        personaColor: env.get('PERSONA_COLOR'),
        socketServer: adminSocketServer,
      },
      adminApiApp
    )

    const adminPort = env.get('ADMIN_PORT')
    adminApiServer = adminApiApp.listen(adminPort)
    await listen(adminApiServer)

    logger.info(`Successfully started server on port ${adminPort}`)

    adminApiServer.on('upgrade', (request, socket, head) => {
      adminSocketServer!.handleUpgrade(request, socket as Socket, head, () => {
        // incoming messages aren't expected so ignore
        return
      })
    })

    const shutdown = async () => {
      if (!shuttingDownPromise) {
        shuttingDownPromise = (async () => {
          const cleanupErrors = await cleanupResources(logger, {
            agent,
            adminApiServer,
            didcommHttpServer,
            adminSocketServer,
            didWebServer,
            didcommSocketServers,
          })
          if (cleanupErrors.length > 0) {
            throw new AggregateError(cleanupErrors, 'Cloudagent shutdown did not complete cleanly')
          }
        })()
      }

      return shuttingDownPromise
    }

    return {
      agent,
      adminApiServer,
      didcommHttpServer,
      didWebServer,
      shutdown,
    }
  } catch (error) {
    await cleanupResources(logger, {
      agent,
      adminApiServer,
      didcommHttpServer,
      adminSocketServer,
      didWebServer,
      didcommSocketServers,
    })
    throw error
  }
}
