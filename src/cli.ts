import type { InboundTransport, Transports, AriesRestConfig } from './cliAgent.js'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { runRestAgent } from './cliAgent.js'

const parsed = yargs(hideBin(process.argv))
  .command('start', 'Start AFJ Rest agent')
  .option('label', {
    alias: 'l',
    string: true,
    demandOption: true,
  })
  .option('wallet-id', {
    string: true,
    demandOption: true,
  })
  .option('wallet-key', {
    string: true,
    demandOption: true,
  })
  .option('endpoint', {
    array: true,
  })
  .option('log-level', {
    number: true,
    default: 3,
  })
  .option('use-did-sov-prefix-where-allowed', {
    boolean: true,
    default: false,
  })
  .option('use-did-key-in-protocols', {
    boolean: true,
    default: true,
  })
  .option('outbound-transport', {
    default: [],
    choices: ['http', 'ws'],
    array: true,
  })
  .option('inbound-transport', {
    array: true,
    default: [],
    coerce: (input: string[]) => {
      // Configured using config object
      if (typeof input[0] === 'object') return input
      if (input.length % 2 !== 0) {
        throw new Error(
          'Inbound transport should be specified as transport port pairs (e.g. --inbound-transport http 5002 ws 5003)'
        )
      }

      return input.reduce<Array<InboundTransport>>((transports, item, index) => {
        const isEven = index % 2 === 0
        // isEven means it is the transport
        // transport port transport port
        const isTransport = isEven

        if (isTransport) {
          transports.push({
            transport: item as Transports,
            port: Number(input[index + 1]),
          })
        }

        return transports
      }, [])
    },
  })
  .option('auto-accept-connections', {
    boolean: true,
    default: false,
  })
  .option('auto-accept-credentials', {
    choices: ['always', 'never', 'contentApproved'],
    default: 'never',
  })
  .option('auto-accept-mediation-requests', {
    boolean: true,
    default: false,
  })
  .option('auto-accept-proofs', {
    choices: ['always', 'never', 'contentApproved'],
    default: 'never',
  })
  .option('auto-update-storage-on-startup', {
    boolean: true,
    default: true,
  })
  .option('connection-image-url', {
    string: true,
  })
  .option('webhook-url', {
    string: true,
  })
  .option('admin-port', {
    number: true,
    demandOption: true,
  })
  .option('ipfs-origin', {
    string: true,
    demandOption: true,
  })
  .option('persona-title', {
    string: true,
    default: 'Veritable Cloudagent',
  })
  .option('persona-color', {
    string: true,
    default: 'white',
  })

  .config()
  .env('AFJ_REST')
  .parseSync()

export async function runCliServer() {
  await runRestAgent({
    label: parsed.label,
    walletConfig: {
      id: parsed['wallet-id'],
      key: parsed['wallet-key'],
    },
    endpoints: parsed.endpoint,
    autoAcceptConnections: parsed['auto-accept-connections'],
    autoAcceptCredentials: parsed['auto-accept-credentials'],
    autoAcceptProofs: parsed['auto-accept-proofs'],
    autoUpdateStorageOnStartup: parsed['auto-update-storage-on-startup'],
    autoAcceptMediationRequests: parsed['auto-accept-mediation-requests'],
    useDidKeyInProtocols: parsed['use-did-key-in-protocols'],
    useDidSovPrefixWhereAllowed: parsed['use-legacy-did-sov-prefix'],
    logLevel: parsed['log-level'],
    inboundTransports: parsed['inbound-transport'],
    outboundTransports: parsed['outbound-transport'],
    connectionImageUrl: parsed['connection-image-url'],
    webhookUrl: parsed['webhook-url'],
    adminPort: parsed['admin-port'],
    ipfsOrigin: parsed['ipfs-origin'],
    opaOrigin: parsed['opa-origin'],
    personaTitle: parsed['persona-title'],
    personaColor: parsed['persona-color'],
  } as AriesRestConfig)
}
