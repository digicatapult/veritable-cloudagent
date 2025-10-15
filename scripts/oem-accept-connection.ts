import z from 'zod'

const connectionParser = z.object({
  id: z.string(),
  state: z.string(),
})

interface ParsedArgs {
  connectionId: string
  baseUrl?: string
}
function printUsageAndExit(code: number): never {
  process.stderr.write(`Usage: maker-connect-to-oem --connection-id <connectionId>\n`)
  process.exit(code)
}
function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    connectionId: '',
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
  const { connectionId, baseUrl } = parseArgs(process.argv)
  const log = (msg: string, extra?: unknown) => {
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }
  log(`Retrieving connection record ${connectionId} baseURL ${baseUrl}`)
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
