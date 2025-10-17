import { AutoAcceptProof } from '@credo-ts/core'
import z from 'zod'
import type { ProposeProofOptions } from '../src/controllers/types.js'

interface ParsedArgs {
  credentialId: string
  connectionId?: string
  baseUrl?: string
}

const credentialParser = z.object({
  id: z.string(),
  state: z.string(),
  role: z.string(),
  credentialAttributes: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ),
})

const connectionParser = z.array(
  z.object({
    id: z.string(),
    invitationDid: z.string().optional(),
    theirDid: z.string().optional(),
    state: z.string(),
  })
)

function printUsageAndExit(code: number): never {
  process.stderr.write(
    `Usage: maker-propose-proof-to-oem --credential-id <credentialId> [--connection-id <connectionId>] [--base-url <url>]\n`
  )
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3001', // Bob's agent
    credentialId: '',
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--credential-id' || a === '-c') {
      parsed.credentialId = args[++i]
      continue
    }
    if (a === '--connection-id') {
      parsed.connectionId = args[++i]
      continue
    }
    if (a === '--base-url' || a === '-b') {
      parsed.baseUrl = args[++i]
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }

    process.stderr.write(`Unknown argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { credentialId, connectionId, baseUrl } = parseArgs(process.argv)
  if (!credentialId || credentialId.length === 0) {
    process.stderr.write('--credential-id is required\n')
    printUsageAndExit(1)
  }

  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  let targetConnectionId = connectionId

  // If connection ID not provided, find it from connections
  if (!targetConnectionId) {
    log(`Retrieving credential ${credentialId} to find OEM connection...`)
    const credentialResponse = await fetch(`${baseUrl}/v1/credentials/${credentialId}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })

    if (!credentialResponse.ok) {
      throw new Error(
        `Failed to retrieve credential ${credentialId}: ${credentialResponse.status} ${credentialResponse.statusText}`
      )
    }

    const credential = await credentialResponse.json()
    const parsedCredential = credentialParser.parse(credential)

    if (parsedCredential.state !== 'done' || parsedCredential.role !== 'holder') {
      throw new Error(
        `Credential ${credentialId} is not in correct state (expected: done/holder, got: ${parsedCredential.state}/${parsedCredential.role})`
      )
    }

    // Try to find OEM DID from credential attributes
    const attributes = parsedCredential.credentialAttributes
    const oemDid = attributes.find((a) => a.name === 'oem_did')?.value

    if (oemDid) {
      log('Found OEM DID:', oemDid)
    } else {
      log(
        'Warning: Could not find oem_did in credential. Available attributes:',
        attributes.map((a) => a.name)
      )
    }

    // Find connection to Charlie (OEM)
    log('Looking for connection to OEM...')
    const connectionsResponse = await fetch(`${baseUrl}/v1/connections`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })

    if (!connectionsResponse.ok) {
      throw new Error(`Failed to retrieve connections: ${connectionsResponse.status} ${connectionsResponse.statusText}`)
    }

    const connections = await connectionsResponse.json()
    const parsedConnections = connectionParser.parse(connections)

    let oemConnection
    if (oemDid) {
      // Find connection by matching DID
      oemConnection = parsedConnections.find((conn) => conn.theirDid === oemDid && conn.state === 'completed')
    } else {
      // Fallback: use most recent completed connection
      const completedConnections = parsedConnections.filter((conn) => conn.state === 'completed')
      oemConnection = completedConnections[completedConnections.length - 1]
    }
    if (!oemConnection) {
      const availableConnections = parsedConnections.map((c) => ({ id: c.id, state: c.state, theirDid: c.theirDid }))
      throw new Error(
        `No completed connection found${oemDid ? ` for OEM DID ${oemDid}` : ''}. Available: ${JSON.stringify(availableConnections)}`
      )
    }

    targetConnectionId = oemConnection.id
    log('Found connection to OEM:', { connectionId: targetConnectionId, state: oemConnection.state })
  }

  // Create proof proposal using the correct AnonCredsProposeProofFormat
  const proofProposal: ProposeProofOptions = {
    connectionId: targetConnectionId,
    protocolVersion: 'v2',
    proofFormats: {
      anoncreds: {
        name: 'make-authorisation-proof-proposal',
        version: '1.0',
        attributes: [
          {
            name: 'request_id',
          },
          {
            name: 'requested_part_number',
          },
          {
            name: 'authorising_body',
          },
          {
            name: 'authorisation_scope',
          },
          {
            name: 'security_classification',
          },
          {
            name: 'oem_did',
          },
        ],
      },
    },
    autoAcceptProof: AutoAcceptProof.ContentApproved,
  }

  log('Proposing proof to OEM...')
  log('Proof proposal structure:', JSON.stringify(proofProposal, null, 2))

  const proofResponse = await fetch(`${baseUrl}/v1/proofs/propose-proof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(proofProposal),
  })

  if (!proofResponse.ok) {
    const errorText = await proofResponse.text()
    throw new Error(`Failed to propose proof: ${proofResponse.status} ${proofResponse.statusText} - ${errorText}`)
  }

  const proofRecord = await proofResponse.json()
  log('Proof proposal sent successfully!')
  log('Proof record:', { id: proofRecord.id, state: proofRecord.state, threadId: proofRecord.threadId })

  // Output the proof record ID for scripting
  process.stdout.write(`${proofRecord.id}\n`)
}
main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
