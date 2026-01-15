import { AutoAcceptCredential } from '@credo-ts/core'
import z from 'zod'
import type { AcceptCredentialOfferOptions } from '../src/controllers/types/index.js'

interface ParsedArgs {
  baseUrl: string
  connectionId?: string
}

const credentialParser = z.object({
  id: z.string(),
  state: z.string(),
  role: z.string(),
  connectionId: z.string(),
  threadId: z.string().optional(),
})

function printUsageAndExit(code: number): never {
  process.stderr.write(`Usage: maker-accept-credential [--base-url <url>] [--connection-id <connectionId>]\n`)
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3001', // Bob's agent
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--base-url' || a === '-b') {
      parsed.baseUrl = args[++i]
      continue
    }
    if (a === '--connection-id') {
      parsed.connectionId = args[++i]
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
  const { baseUrl, connectionId } = parseArgs(process.argv)
  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  // 1. Find credential in offer-received state
  log(`Looking for credential offers at ${baseUrl}...`)
  const credentialsResponse = await fetch(`${baseUrl}/v1/credentials`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })

  if (!credentialsResponse.ok) {
    throw new Error(`Failed to retrieve credentials: ${credentialsResponse.status} ${credentialsResponse.statusText}`)
  }

  const credentials = await credentialsResponse.json()
  const parsedCredentials = z.array(credentialParser).parse(credentials)

  // Filter for offer-received
  const offers = parsedCredentials.filter(
    (c) => c.state === 'offer-received' && c.role === 'holder' && (!connectionId || c.connectionId === connectionId)
  )

  if (offers.length === 0) {
    log('No credential offers found.')
    process.exit(0)
  }

  // Pick the most recent one
  const offer = offers[offers.length - 1]
  log('Found credential offer:', { id: offer.id, state: offer.state })

  // 2. Accept the offer
  const acceptOptions: AcceptCredentialOfferOptions = {
    autoAcceptCredential: AutoAcceptCredential.Always, // Auto-accept subsequent steps (request, credential)
    comment: 'Accepting credential offer from script',
  }

  log(`Accepting credential offer ${offer.id}...`)
  const acceptResponse = await fetch(`${baseUrl}/v1/credentials/${offer.id}/accept-offer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(acceptOptions),
  })

  if (!acceptResponse.ok) {
    const errorText = await acceptResponse.text()
    throw new Error(
      `Failed to accept credential offer: ${acceptResponse.status} ${acceptResponse.statusText} - ${errorText}`
    )
  }

  const acceptedCredential = await acceptResponse.json()
  log('Credential offer accepted successfully!')
  log('Credential record:', {
    id: acceptedCredential.id,
    state: acceptedCredential.state,
  })

  // 3. Wait for completion (optional, but good for scripts)
  log('Waiting for credential exchange to complete...')
  const maxRetries = 20
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const checkResponse = await fetch(`${baseUrl}/v1/credentials/${offer.id}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })

    if (checkResponse.ok) {
      const checkCred = await checkResponse.json()
      if (checkCred.state === 'done') {
        log('Credential exchange completed successfully!')
        process.stdout.write(`${checkCred.id}\n`) // Output ID for chaining
        process.exit(0)
      }
      log(`Current state: ${checkCred.state}`)
    }
  }

  log('Timed out waiting for credential completion.')
  process.exit(1)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
