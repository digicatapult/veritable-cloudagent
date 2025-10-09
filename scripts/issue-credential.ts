// This script issues a credential to maker(Bob) with (Charlie's) oem's did

// Get credential definiton and schema
// Propose a credential to maker
import z from 'zod'

const schemaParser = z.array(
  z.object({
    id: z.string(),
    issuerId: z.string(),
    name: z.string(),
    version: z.string(),
    attrNames: z.array(z.string()),
  })
)
const credentialParser = z.array(
  z.object({
    id: z.string(),
    schemaId: z.string(),
    tag: z.string(),
    issuerId: z.string(),
  })
)

async function getschemaAndCredentialDefinition(
  baseUrl: string,
  issuerId: string,
  log: (msg: string, extra?: unknown) => void
) {
  try {
    log('Fetching schemas from', `${baseUrl}/v1/schemas`)
    const res = await fetch(`${baseUrl}/v1/schemas?createdLocally=true`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch schemas: ${res.status} ${res.statusText}`)
    }

    const jsonRes = await res.json()
    const parsed = schemaParser.parse(jsonRes)

    if (parsed.length === 0) {
      throw new Error('No schemas found')
    }

    const schemaId = parsed[0].id
    log(`${schemaId} schemas found`)

    // Get credential definition for schema
    log(`Fetching credential definitions for schema ${schemaId}`)
    const credDef = await fetch(`${baseUrl}/v1/credential-definitions?createdLocally=true&schemaId=${schemaId}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })

    if (!credDef.ok) {
      throw new Error(`Failed to fetch credential definitions: ${credDef.status} ${credDef.statusText}`)
    }

    const credDefRes = await credDef.json()
    const parsedCredDef = credentialParser.parse(credDefRes)

    if (parsedCredDef.length === 0) {
      throw new Error(`No credential definitions found for schema ${schemaId}`)
    }

    log(`credDef ${parsedCredDef[0].id} found for schema ${schemaId}`)
    return { schemaId, credDefId: parsedCredDef[0].id }
  } catch (error) {
    log('Error during credential setup:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function main() {
  const log = (msg: string, extra?: unknown) => {
    // use stderr so that any stdout piping (e.g. capturing id) is clean
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }
  // we are alice atm and are connected to both bob and charlie
  const oemDid = 'did:web:charlie%3A8443'
  const baseUrl = 'http://localhost:3000'

  const { schemaId, credDefId } = await getschemaAndCredentialDefinition(baseUrl, oemDid, log)

  // register credential
  // const proposeCredentialBody:ProposeCredentialOptions={}
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
