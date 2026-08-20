// Must import before @credo-ts/anoncreds
import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
  AnonCredsModule,
  AnonCredsRequestProofFormat,
} from '@credo-ts/anoncreds'
import {
  Agent,
  DidsModule,
  KeyDidResolver,
  PeerDidResolver,
  W3cCredentialsModule,
  WebDidResolver,
  type InitConfig,
  type ModulesMap,
} from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommHttpOutboundTransport,
  DidCommJsonLdCredentialFormatService,
  DidCommModule,
  DidCommProofV2Protocol,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { DrpcModule } from '@credo-ts/drpc'
import { agentDependencies, DidCommHttpInboundTransport, DidCommWsInboundTransport } from '@credo-ts/node'
import { askarNodeJS } from '@openwallet-foundation/askar-nodejs'
import express, { type Express } from 'express'
import { container } from 'tsyringe'
import { WebSocketServer } from 'ws'

import { AskarModule, type AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import VeritableAnonCredsRegistry from './anoncreds/index.js'
import type { CredentialDefinitionId, DID } from './controllers/types/index.js'
import DrpcReceiveHandler, { verifiedDrpcRequestHandler } from './drpc-handler/index.js'
import Ipfs from './ipfs/index.js'
import { VerifiedDrpcModule, VerifiedDrpcModuleConfigOptions } from './modules/verified-drpc/index.js'
import PinoLogger from './utils/logger.js'

/** Path DIDComm HTTP/WS bind to on the shared public protocol app, distinct from any future OpenID4VC routes. */
export const DIDCOMM_HTTP_PATH = '/didcomm'
export const DIDCOMM_WS_PATH = '/didcomm-ws'

export type Transports = 'ws' | 'http'
export type InboundTransport = {
  transport: Transports
  port: number
}

type AgentProofProtocols = [
  DidCommProofV2Protocol<[AnonCredsDidCommProofFormatService, DidCommDifPresentationExchangeProofFormatService]>,
]

const outboundTransportMapping = {
  http: DidCommHttpOutboundTransport,
  ws: DidCommWsOutboundTransport,
} as const

export type AriesRestConfig = {
  agentConfig: InitConfig & {
    endpoints: string[]
    autoUpdateStorageOnStartup?: boolean
    useDidKeyInProtocols?: boolean
    useDidSovPrefixWhereAllowed?: boolean
  }
  askarStoreConfig: AskarModuleConfigStoreOptions

  inboundTransports?: InboundTransport[]
  outboundTransports?: Transports[]
  /** Shared public protocol Express app that DIDComm HTTP/WS bind to. Defaults to a private app if omitted (used by tests). */
  publicApp?: Express

  autoAcceptConnections?: boolean
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptMediationRequests?: boolean
  autoAcceptProofs?: DidCommAutoAcceptProof
  ipfsOrigin: string
  ipfsTimeoutMs: number

  verifiedDrpcOptions: VerifiedDrpcModuleConfigOptions<AgentProofProtocols>

  logger: PinoLogger
}

export interface RestAgentModules extends ModulesMap {
  didcomm: DidCommModule
  dids: DidsModule
  w3cCredentials: W3cCredentialsModule
  anoncreds: AnonCredsModule
  askar: AskarModule
  drpc: DrpcModule
  verifiedDrpc: VerifiedDrpcModule<AgentProofProtocols>
}

export type RestAgent<
  modules extends RestAgentModules = {
    didcomm: DidCommModule
    dids: DidsModule
    w3cCredentials: W3cCredentialsModule
    anoncreds: AnonCredsModule
    askar: AskarModule
    drpc: DrpcModule
    verifiedDrpc: VerifiedDrpcModule<AgentProofProtocols>
  },
> = Agent<modules>

const getAgentModules = (options: {
  didcommConfig: {
    endpoints: string[]
    useDidSovPrefixWhereAllowed?: boolean
    useDidKeyInProtocols?: boolean
  }
  autoAcceptConnections: boolean
  autoAcceptProofs: DidCommAutoAcceptProof
  autoAcceptCredentials: DidCommAutoAcceptCredential
  autoAcceptMediationRequests: boolean
  ipfsOrigin: string
  ipfsTimeoutMs: number
  verifiedDrpcOptions: {
    credDefId?: CredentialDefinitionId
    issuerDid?: DID
  } & VerifiedDrpcModuleConfigOptions<AgentProofProtocols>
  askarStoreConfig: AskarModuleConfigStoreOptions
}): RestAgentModules => {
  return {
    askar: new AskarModule({
      askar: askarNodeJS,
      store: options.askarStoreConfig,
    }),
    didcomm: new DidCommModule({
      endpoints: options.didcommConfig.endpoints,
      useDidSovPrefixWhereAllowed: options.didcommConfig.useDidSovPrefixWhereAllowed,
      useDidKeyInProtocols: options.didcommConfig.useDidKeyInProtocols,
      connections: {
        autoAcceptConnections: options.autoAcceptConnections,
      },
      proofs: {
        autoAcceptProofs: options.autoAcceptProofs,
        proofProtocols: [
          new DidCommProofV2Protocol({
            proofFormats: [
              new AnonCredsDidCommProofFormatService(),
              new DidCommDifPresentationExchangeProofFormatService(),
            ],
          }),
        ],
      },
      credentials: {
        autoAcceptCredentials: options.autoAcceptCredentials,
        credentialProtocols: [
          new DidCommCredentialV2Protocol({
            credentialFormats: [
              new AnonCredsDidCommCredentialFormatService(),
              new DidCommJsonLdCredentialFormatService(),
            ],
          }),
        ],
      },
      mediator: {
        autoAcceptMediationRequests: options.autoAcceptMediationRequests,
      },
    }),
    dids: new DidsModule({
      resolvers: [new WebDidResolver(), new PeerDidResolver(), new KeyDidResolver()],
    }),
    w3cCredentials: new W3cCredentialsModule(),
    anoncreds: new AnonCredsModule({
      registries: [new VeritableAnonCredsRegistry(new Ipfs(options.ipfsOrigin, options.ipfsTimeoutMs))],
      anoncreds,
    }),
    drpc: new DrpcModule(),
    verifiedDrpc: new VerifiedDrpcModule(
      (() => {
        const { credDefId, issuerDid, ...rest } = options.verifiedDrpcOptions
        if (credDefId || issuerDid) {
          const anoncredsProofFormat = rest.proofRequestOptions.proofFormats?.[
            'anoncreds'
          ] as AnonCredsRequestProofFormat
          if (anoncredsProofFormat.requested_attributes) {
            for (const attribute of Object.values(anoncredsProofFormat.requested_attributes)) {
              if (!attribute.restrictions) {
                attribute.restrictions = [{}]
              }
              attribute.restrictions = attribute.restrictions.map((restriction) => {
                return {
                  ...restriction,
                  ...(credDefId ? { cred_def_id: credDefId } : {}),
                  ...(issuerDid ? { issuer_did: issuerDid } : {}),
                }
              })
            }
          }
        }
        return rest
      })()
    ),
  }
}

export async function setupAgent(restConfig: AriesRestConfig) {
  const {
    inboundTransports = [],
    outboundTransports = [],

    autoAcceptConnections = true,
    autoAcceptCredentials = DidCommAutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests = true,
    autoAcceptProofs = DidCommAutoAcceptProof.ContentApproved,
    ipfsOrigin,
    ipfsTimeoutMs,
    verifiedDrpcOptions,

    agentConfig,
    askarStoreConfig,
  } = restConfig

  const publicApp = restConfig.publicApp ?? express()

  const modules = getAgentModules({
    didcommConfig: {
      endpoints: agentConfig.endpoints,
      useDidSovPrefixWhereAllowed: agentConfig.useDidSovPrefixWhereAllowed,
      useDidKeyInProtocols: agentConfig.useDidKeyInProtocols,
    },
    autoAcceptConnections,
    autoAcceptProofs,
    autoAcceptCredentials,
    autoAcceptMediationRequests,
    ipfsOrigin,
    ipfsTimeoutMs,
    verifiedDrpcOptions,
    askarStoreConfig,
  })

  const agent: RestAgent = new Agent({
    config: agentConfig,
    dependencies: agentDependencies,
    modules,
  })

  // Register outbound transports
  for (const outboundTransport of outboundTransports) {
    const OutboundTransport = outboundTransportMapping[outboundTransport]
    agent.didcomm.registerOutboundTransport(new OutboundTransport())
  }

  // Register inbound transports. HTTP shares the public app at DIDCOMM_HTTP_PATH; WS uses a no-server
  // WebSocketServer at DIDCOMM_WS_PATH so its upgrade events can be dispatched from the shared HTTP server.
  let didCommWsServer: WebSocketServer | undefined
  let didCommHttpInboundTransport: DidCommHttpInboundTransport | undefined
  for (const inboundTransport of inboundTransports) {
    if (inboundTransport.transport === 'http') {
      didCommHttpInboundTransport = new DidCommHttpInboundTransport({
        app: publicApp,
        path: DIDCOMM_HTTP_PATH,
        port: inboundTransport.port,
        processedMessageListenerTimeoutMs: 30000,
      })
      agent.didcomm.registerInboundTransport(didCommHttpInboundTransport)
    } else {
      didCommWsServer = new WebSocketServer({ noServer: true })
      agent.didcomm.registerInboundTransport(new DidCommWsInboundTransport({ server: didCommWsServer }))
    }
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
  drpcReceiveHandler.start()

  return { agent, didCommHttpInboundTransport, didCommWsServer }
}
