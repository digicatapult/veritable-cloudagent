import type { InitConfig, WalletConfig } from '@aries-framework/core'

import {
  HttpOutboundTransport,
  WsOutboundTransport,
  LogLevel,
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
} from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport, WsInboundTransport } from '@aries-framework/node'
import { readFile } from 'fs/promises'

import { setupServer } from './server'
import { getAgentModules, RestAgent } from './utils/agent'
import { TsLogger } from './utils/logger'

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
  useDidKeyInProtocols?: boolean
  useDidSovPrefixWhereAllowed?: boolean
  logLevel?: LogLevel
  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]
  autoAcceptMediationRequests?: boolean
  connectionImageUrl?: string

  webhookUrl?: string
  adminPort: number
  ipfsOrigin: string
  personaTitle: string
  personaColor: string
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
    personaTitle,
    personaColor,
    ...afjConfig
  } = restConfig

  const logger = new TsLogger(logLevel ?? LogLevel.error)

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
  })

  const agent: RestAgent = new Agent({
    config: agentConfig,
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

  const existingSecrets = await agent.modules.anoncreds.getLinkSecretIds()
  if (existingSecrets.length === 0) {
    await agent.modules.anoncreds.createLinkSecret({
      setAsDefault: true,
    })
  }

  const app = await setupServer(agent, {
    webhookUrl,
    port: adminPort,
    personaTitle,
    personaColor,
  })

  app.listen(adminPort, () => {
    logger.info(`Successfully started server on port ${adminPort}`)
  })
}
