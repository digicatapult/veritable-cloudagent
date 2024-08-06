import type { Socket } from 'node:net'
import { readFile } from 'fs/promises'

import {
  type InitConfig,
  type WalletConfig,
  HttpOutboundTransport,
  WsOutboundTransport,
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
} from '@credo-ts/core'
import { agentDependencies, HttpInboundTransport, WsInboundTransport } from '@credo-ts/node'
import WebSocket from 'ws'
import { LevelWithSilent } from 'pino'

import type { VerifiedDrpcModuleConfigOptions } from './modules/verified-drpc/index.js'
import { setupServer } from './server.js'
import { getAgentModules, RestAgent } from './utils/agent.js'
import PinoLogger from './utils/logger.js'
import DrpcReceiveHandler, { verifiedDrpcRequestHandler } from './drpc-handler/index.js'
import { container } from 'tsyringe'

export type Transports = 'ws' | 'http'
export type InboundTransport = {
  transport: Transports
  port: number
}

const inboundTransportMapping = {
  http: HttpInboundTransport,
  ws: WsInboundTransport,
} as const

const outboundTransportMapping = {
  http: HttpOutboundTransport,
  ws: WsOutboundTransport,
} as const

export interface AriesRestConfig {
  label: string
  walletConfig: WalletConfig
  endpoints?: string[]
  autoAcceptConnections?: boolean
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  autoUpdateStorageOnStartup?: boolean
  backupBeforeStorageUpdate?: boolean
  useDidKeyInProtocols?: boolean
  useDidSovPrefixWhereAllowed?: boolean
  logLevel: LevelWithSilent
  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]
  autoAcceptMediationRequests?: boolean
  connectionImageUrl?: string

  webhookUrl?: string[]
  adminPort: number
  ipfsOrigin: string
  opaOrigin: string
  personaTitle: string
  personaColor: string
  verifiedDrpcOptions: VerifiedDrpcModuleConfigOptions
}

export async function readRestConfig(path: string) {
  const configString = await readFile(path, { encoding: 'utf-8' })
  const config = JSON.parse(configString)

  return config
}

export async function runRestAgent(restConfig: AriesRestConfig) {
  const {
    logLevel,
    inboundTransports = [],
    outboundTransports = [],
    webhookUrl,
    adminPort,
    autoAcceptConnections = true,
    autoAcceptCredentials = AutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests = true,
    autoAcceptProofs = AutoAcceptProof.ContentApproved,
    ipfsOrigin,
    opaOrigin,
    personaTitle,
    personaColor,
    verifiedDrpcOptions,
    ...afjConfig
  } = restConfig

  const logger = new PinoLogger(logLevel)
  container.register(PinoLogger, {
    useValue: logger,
  })

  const agentConfig: InitConfig = {
    ...afjConfig,
    logger,
  }
  const modules = getAgentModules({
    autoAcceptConnections,
    autoAcceptProofs,
    autoAcceptCredentials,
    autoAcceptMediationRequests,
    ipfsOrigin,
    verifiedDrpcOptions,
  })

  const agent: RestAgent = new Agent({
    config: agentConfig as InitConfig,
    dependencies: agentDependencies,
    modules,
  })

  // Register outbound transports
  for (const outboundTransport of outboundTransports) {
    const OutboundTransport = outboundTransportMapping[outboundTransport]
    agent.registerOutboundTransport(new OutboundTransport())
  }

  // Register inbound transports
  for (const inboundTransport of inboundTransports) {
    const InboundTransport = inboundTransportMapping[inboundTransport.transport]
    agent.registerInboundTransport(new InboundTransport({ port: inboundTransport.port }))
  }

  await agent.initialize()

  container.register(Agent, { useValue: agent as Agent })

  const existingSecrets = await agent.modules.anoncreds.getLinkSecretIds()
  if (existingSecrets.length === 0) {
    await agent.modules.anoncreds.createLinkSecret({
      setAsDefault: true,
    })
  }

  agent.modules.verifiedDrpc.addRequestListener(verifiedDrpcRequestHandler)

  const drpcReceiveHandler = container.resolve(DrpcReceiveHandler)
  await drpcReceiveHandler.start()

  const socketServer = new WebSocket.Server({ noServer: true })
  const app = await setupServer(agent, {
    webhookUrl,
    port: adminPort,
    personaTitle,
    personaColor,
    opaOrigin,
    socketServer,
  })

  const server = app.listen(adminPort, () => {
    logger.info(`Successfully started server on port ${adminPort}`)
  })
  server.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket as Socket, head, () => {
      // incoming messages aren't expected so ignore
      return
    })
  })
}
