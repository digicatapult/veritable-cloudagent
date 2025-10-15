import z from 'zod'

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

function printUsageAndExit(code: number): never {
  process.stderr.write(`Usage: maker-connect-to-oem --credential-id <credentialId> [--base-url <url>]\n`)
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
  // retrieve credential offer
  log(`Retrieving issued credential ${credentialId} baseURL ${baseUrl}`)
  await new Promise((resolve) => setTimeout(resolve, 2000))

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
  const parsedCredential = credentialParser.parse(credential) // validate structure
  if (parsedCredential.state !== 'done' || parsedCredential.role !== 'holder') {
    let errorMsg = `Credential ${credentialId} is invalid:`
    if (parsedCredential.state !== 'done') {
      errorMsg += ` state is '${parsedCredential.state}' (expected 'done').`
    }
    if (parsedCredential.role !== 'holder') {
      errorMsg += ` role is '${parsedCredential.role}' (expected 'holder').`
    }
    errorMsg += ` Full credential: ${JSON.stringify(parsedCredential)}`
    throw new Error(errorMsg)
  }
  log('Retrieved issued credential', parsedCredential)
  const oemDid = parsedCredential.credentialAttributes.find((a) => a.name === 'oem_did')?.value
  if (!oemDid) {
    throw new Error(`Credential ${credentialId} does not have oem_did attribute`)
  }
  log('oem_did attribute:', oemDid)
  log('attempting to connect to OEM via implicit invite')

  // connect to OEM
  const implicitInvite = await fetch(`${baseUrl}/v1/oob/receive-implicit-invitation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      did: oemDid,
      autoAcceptConnection: true,
      autoAcceptInvitation: true,
      handshakeProtocols: ['https://didcomm.org/didexchange/1.x'],
    }),
  })
  if (!implicitInvite.ok) {
    throw new Error(`Failed to connect to OEM ${oemDid}: ${implicitInvite.status} ${implicitInvite.statusText}`)
  }

  // accept the issued credential
  log('============================================================================')
  log('Implicit invitation successful, waiting for completion.')
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
