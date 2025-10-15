import z from 'zod'
import type { ProposeProofOptions } from '../src/controllers/types.js'

interface ParsedArgs {
  credentialId: string
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
  process.stderr.write(`Usage: propose-proof-to-oem --credential-id <credentialId> [--base-url <url>]\n`)
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3001', // this is executed on Bob's side
    credentialId: '',
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--credential-id' || a === '-c') {
      parsed.credentialId = args[++i]
      continue
    }
    if (a === '--base-url' || a === '-b') {
      parsed.baseUrl = args[++i]
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }

    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { credentialId, baseUrl } = parseArgs(process.argv)
  if (!credentialId || credentialId.length === 0) {
    process.stderr.write('--credential-id is required\n')
    printUsageAndExit(1)
  }

  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  // Retrieve credential to get OEM DID
  log(`Retrieving issued credential ${credentialId} from ${baseUrl}`)
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
    throw new Error(`Credential ${credentialId} is not in correct state for proof proposal`)
  }

  const oemDid = parsedCredential.credentialAttributes.find((a) => a.name === 'oem_did')?.value
  if (!oemDid) {
    throw new Error(`Credential ${credentialId} does not have oem_did attribute`)
  }

  log('Found OEM DID:', oemDid)

  // Find connection to Charlie (OEM) based on the DID
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

  // Find connection where the other party's DID matches the OEM DID
  const oemConnection = parsedConnections.find((conn) => conn.theirDid === oemDid && conn.state === 'completed')

  if (!oemConnection) {
    throw new Error(`No completed connection found for OEM DID ${oemDid}`)
  }

  log('Found connection to OEM:', { connectionId: oemConnection.id, state: oemConnection.state })

  // Get credential definition ID from the credential
  const credDefId = parsedCredential.credentialAttributes.find((a) => a.name === 'cred_def_id')?.value
  if (!credDefId) {
    // If not in attributes, we need to get it from the credential metadata
    log('Warning: Could not find credential definition ID in attributes, using a default proof request')
  }

  // Propose proof to Charlie (OEM)
  const proofProposal: ProposeProofOptions = {
    connectionId: oemConnection.id,
    protocolVersion: 'v2',
    proofFormats: {
      anoncreds: {
        name: 'make-authorisation-proof-proposal',
        version: '1.0',
        requested_attributes: {
          request_id: {
            name: 'request_id',
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
          requested_part_number: {
            name: 'requested_part_number',
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
          authorising_body: {
            name: 'authorising_body',
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
          authorisation_scope: {
            name: 'authorisation_scope',
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
          security_classification: {
            name: 'security_classification',
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
        },
        requested_predicates: {
          valid_authorisation: {
            name: 'authorisation_expiry_date',
            p_type: '>=',
            p_value: parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, '')), // Today's date as YYYYMMDD
            restrictions: credDefId ? [{ cred_def_id: credDefId }] : undefined,
          },
        },
      },
    },
    autoAcceptProof: 'contentApproved',
  }

  log('Proposing proof to OEM with proposal:', JSON.stringify(proofProposal, null, 2))

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

  // Output the proof record ID for potential scripting use
  process.stdout.write(`${proofRecord.id}\n`)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
