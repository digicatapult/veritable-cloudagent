import {
  AnonCredsCredentialFormatService,
  AnonCredsProofFormatService,
  AnonCredsModule,
} from '@aries-framework/anoncreds'
import { AnonCredsRsModule } from '@aries-framework/anoncreds-rs'
import { AskarModule } from '@aries-framework/askar'
import {
  type ModulesMap,
  V2CredentialProtocol,
  V2ProofProtocol,
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  ConnectionsModule,
  CredentialsModule,
  HttpOutboundTransport,
  LogLevel,
  MediatorModule,
  ProofsModule,
} from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport } from '@aries-framework/node'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import path from 'path'
import { fileURLToPath } from 'url'

import { TsLogger } from './logger.js'
import VeritableAnonCredsRegistry from '../anoncreds/index.js'
import Ipfs from '../ipfs/index.js'

export interface RestAgentModules extends ModulesMap {
  connections: ConnectionsModule
  proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
  credentials: CredentialsModule<[V2CredentialProtocol<[AnonCredsCredentialFormatService]>]>
  anoncreds: AnonCredsModule
}

export type RestAgent<
  modules extends RestAgentModules = {
    connections: ConnectionsModule
    proofs: ProofsModule<[V2ProofProtocol<[AnonCredsProofFormatService]>]>
    credentials: CredentialsModule<[V2CredentialProtocol]>
    anoncreds: AnonCredsModule
  }
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
    }),
    anoncredsRs: new AnonCredsRsModule({
      anoncreds,
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
    mediator: new MediatorModule({
      autoAcceptMediationRequests: options.autoAcceptMediationRequests,
    }),
  }
}

export const setupAgent = async ({ name, endpoints, port }: { name: string; endpoints: string[]; port: number }) => {
  const logger = new TsLogger(LogLevel.debug)

  const modules = getAgentModules({
    autoAcceptConnections: true,
    autoAcceptProofs: AutoAcceptProof.ContentApproved,
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    autoAcceptMediationRequests: true,
    ipfsOrigin: 'http://localhost:5001',
  })

  const agent = new Agent({
    config: {
      label: name,
      endpoints,
      walletConfig: { id: name, key: name },
      useDidSovPrefixWhereAllowed: true,
      logger: logger,
      autoUpdateStorageOnStartup: true,
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
