import {
  AnonCredsCredentialFormatService,
  AnonCredsProofFormatService,
  AnonCredsRequestProofFormat,
  AnonCredsModule,
} from '@credo-ts/anoncreds'
import { AskarModule } from '@credo-ts/askar'
import {
  type ModulesMap,
  V2CredentialProtocol,
  V2ProofProtocol,
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  LogLevel,
  ConnectionsModule,
  CredentialsModule,
  HttpOutboundTransport,
  MediatorModule,
  ProofsModule,
} from '@credo-ts/core'
import { DrpcModule } from '@credo-ts/drpc'
import { type VerifiedDrpcModuleConfigOptions, VerifiedDrpcModule } from '../modules/verified-drpc/index.js'
import { agentDependencies, HttpInboundTransport } from '@credo-ts/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import path from 'path'
import { fileURLToPath } from 'url'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'

import VeritableAnonCredsRegistry from '../anoncreds/index.js'
import Ipfs from '../ipfs/index.js'
import PinoLogger from './logger.js'

export interface RestAgentModules extends ModulesMap {
  connections: ConnectionsModule
  proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
  credentials: CredentialsModule<[V2CredentialProtocol<[AnonCredsCredentialFormatService]>]>
  anoncreds: AnonCredsModule
  verifiedDrpc: VerifiedDrpcModule
}

export type RestAgent<
  modules extends RestAgentModules = {
    connections: ConnectionsModule
    proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
    credentials: CredentialsModule<[V2CredentialProtocol]>
    anoncreds: AnonCredsModule
    verifiedDrpc: VerifiedDrpcModule
  },
> = Agent<modules>

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../../network/genesis/local-genesis.txn')

export const getAgentModules = (options: {
  autoAcceptConnections: boolean
  autoAcceptProofs: AutoAcceptProof
  autoAcceptCredentials: AutoAcceptCredential
  autoAcceptMediationRequests: boolean
  ipfsOrigin: string
  verifiedDrpcOptions: { credDefId?: string; issuerDid?: string } & VerifiedDrpcModuleConfigOptions
}): RestAgentModules => {
  return {
    connections: new ConnectionsModule({
      autoAcceptConnections: options.autoAcceptConnections,
    }),
    proofs: new ProofsModule({
      autoAcceptProofs: options.autoAcceptProofs,
      proofProtocols: [
        new V2ProofProtocol({
          proofFormats: [new AnonCredsProofFormatService()],
        }),
      ],
    }),
    credentials: new CredentialsModule({
      autoAcceptCredentials: options.autoAcceptCredentials,
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: [new AnonCredsCredentialFormatService()],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new VeritableAnonCredsRegistry(new Ipfs(options.ipfsOrigin))],
      anoncreds,
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    mediator: new MediatorModule({
      autoAcceptMediationRequests: options.autoAcceptMediationRequests,
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

export const setupAgent = async ({ name, endpoints, port }: { name: string; endpoints: string[]; port: number }) => {
  const logger = new PinoLogger(LogLevel.debug)

  const modules = getAgentModules({
    autoAcceptConnections: true,
    autoAcceptProofs: AutoAcceptProof.ContentApproved,
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests: true,
    ipfsOrigin: 'http://localhost:5001',
    verifiedDrpcOptions: { proofRequestOptions: { protocolVersion: 'v2', proofFormats: {} } },
  })

  const agent = new Agent({
    config: {
      label: name,
      endpoints,
      walletConfig: { id: name, key: name },
      useDidSovPrefixWhereAllowed: true,
      logger,
      autoUpdateStorageOnStartup: true,
      backupBeforeStorageUpdate: false,
    },
    dependencies: agentDependencies,
    modules,
  })

  const httpInbound = new HttpInboundTransport({
    port: port,
  })

  agent.registerInboundTransport(httpInbound)
  agent.registerOutboundTransport(new HttpOutboundTransport())

  await agent.initialize()

  return agent
}
