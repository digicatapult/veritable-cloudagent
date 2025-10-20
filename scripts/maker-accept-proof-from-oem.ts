import { AutoAcceptProof } from '@credo-ts/core'
import z from 'zod'
import type { AcceptProofRequestOptions } from '../src/controllers/types.js'

interface ParsedArgs {
  proofId: string
  baseUrl?: string
}

const proofParser = z.object({
  id: z.string(),
  state: z.string(),
  role: z.string(),
  connectionId: z.string(),
  threadId: z.string().optional(),
})

function printUsageAndExit(code: number): never {
  process.stderr.write(
    `Usage: maker-accept-proof-from-oem --proof-id <proofId> [--base-url <url>]\n` +
      `Examples:\n` +
      `  npx tsx scripts/maker-accept-proof-from-oem.ts --proof-id abc-123\n`
  )
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3001', // Bob's agent
    proofId: '',
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--proof-id' || a === '-p') {
      parsed.proofId = args[++i]
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
  const { proofId, baseUrl } = parseArgs(process.argv)
  if (!proofId || proofId.length === 0) {
    process.stderr.write('--proof-id is required\n')
    printUsageAndExit(1)
  }

  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  // Get the proof record to verify it's in the correct state
  log(`Retrieving proof record ${proofId} from ${baseUrl}`)
  const proofResponse = await fetch(`${baseUrl}/v1/proofs/${proofId}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })

  if (!proofResponse.ok) {
    throw new Error(`Failed to retrieve proof ${proofId}: ${proofResponse.status} ${proofResponse.statusText}`)
  }

  const proof = await proofResponse.json()
  const parsedProof = proofParser.parse(proof)

  log('Retrieved proof record:', {
    id: parsedProof.id,
    state: parsedProof.state,
    role: parsedProof.role,
    connectionId: parsedProof.connectionId,
  })

  // Verify the proof is in the correct state and role
  if (parsedProof.state !== 'request-received') {
    throw new Error(`Proof ${proofId} is not in request-received state (current state: ${parsedProof.state})`)
  }

  if (parsedProof.role !== 'prover') {
    throw new Error(`Proof ${proofId} has incorrect role (expected: prover, got: ${parsedProof.role})`)
  }

  // Accept the proof request - Bob will automatically select and present credentials
  const acceptProofRequest: AcceptProofRequestOptions = {
    useReturnRoute: true,
    willConfirm: true,
    autoAcceptProof: AutoAcceptProof.ContentApproved,
    comment: 'Accepting proof request from OEM',
  }

  log('Accepting proof request from OEM...')
  log('Accept request options:', JSON.stringify(acceptProofRequest, null, 2))

  const acceptResponse = await fetch(`${baseUrl}/v1/proofs/${proofId}/accept-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(acceptProofRequest),
  })

  if (!acceptResponse.ok) {
    const errorText = await acceptResponse.text()
    throw new Error(
      `Failed to accept proof request: ${acceptResponse.status} ${acceptResponse.statusText} - ${errorText}`
    )
  }

  const updatedProof = await acceptResponse.json()
  log('Proof request accepted successfully!')
  log('Updated proof record:', {
    id: updatedProof.id,
    state: updatedProof.state,
    threadId: updatedProof.threadId,
  })

  // Output the proof record ID for scripting
  process.stdout.write(`${updatedProof.id}\n`)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
