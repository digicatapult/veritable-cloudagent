import z from 'zod'

const connectionParser = z.object({
  id: z.string(),
  state: z.string(),
})

const connectionsListParser = z.array(connectionParser)

interface ParsedArgs {
  connectionId?: string
  baseUrl?: string
}
function printUsageAndExit(code: number): never {
  process.stderr.write(`Usage: maker-connect-to-oem [--connection-id <connectionId>]\n`)
  process.exit(code)
}
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3002', // this is executed on Charlie's side
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--connection-id' || a === '-c') {
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

    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { connectionId: argsConnectionId, baseUrl } = parseArgs(process.argv)
  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }

  let connectionId = argsConnectionId

  if (!connectionId) {
    log(`Looking for pending connection requests at ${baseUrl}...`)
    const connectionsResponse = await fetch(`${baseUrl}/v1/connections`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })

    if (!connectionsResponse.ok) {
      throw new Error(`Failed to retrieve connections: ${connectionsResponse.status} ${connectionsResponse.statusText}`)
    }

    const connections = await connectionsResponse.json()
    const parsedConnections = connectionsListParser.parse(connections)

    const pendingConnections = parsedConnections.filter((c) => c.state === 'request-received')

    if (pendingConnections.length === 0) {
      log('No pending connection requests found.')
      process.exit(0)
    }

    // Pick the most recent one (last in the list usually, but could sort by date if available)
    const targetConnection = pendingConnections[pendingConnections.length - 1]
    connectionId = targetConnection.id
    log(`Found pending connection request: ${connectionId}`)
  }

  log(`Accepting connection request ${connectionId} at ${baseUrl}`)
  const connectionResponse = await fetch(`${baseUrl}/v1/connections/${connectionId}/accept-request`, {
    method: 'POST',
    headers: { accept: 'application/json' },
  })
  if (!connectionResponse.ok) {
    throw new Error(
      `Failed to update connection ${connectionId}: ${connectionResponse.status} ${connectionResponse.statusText}`
    )
  }
  log('Checking connection status')
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const connectionFinalRes = await fetch(`${baseUrl}/v1/connections/${connectionId}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })
  if (!connectionFinalRes.ok) {
    throw new Error(
      `Failed to retrieve connection ${connectionId}: ${connectionFinalRes.status} ${connectionFinalRes.statusText}`
    )
  }
  const connectionFinal = await connectionFinalRes.json()
  const parsed = connectionParser.parse(connectionFinal)
  if (parsed.state !== 'completed') {
    throw new Error(`Connection ${connectionId} not completed yet, state: ${parsed.state}`)
  }
  log('============================================================================')
  log(`Connection ${connectionId} request accepted`)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
