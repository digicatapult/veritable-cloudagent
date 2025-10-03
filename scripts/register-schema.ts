#!/usr/bin/env ts-node
/**
 * Script to register a predefined AnonCreds schema with a running cloud agent.
 *
 * Usage:
 *   node --experimental-strip-types ./scripts/register-schema.ts <schemaFileName> --issuer <did> --base-url <agent_url>
 *   node --experimental-strip-types ./scripts/register-schema.ts makeAuthorisation \
 *     --issuer did:key:z6Abc123 --base-url http://localhost:3000
 *
 * Flags:
 *   --issuer, -i     DID of issuer (default: did:web:alice%3A8443) (Alice)
 *   --base-url, -b   Base agent URL (default: http://localhost:3000) (Alice)
 *   --help, -h       Show usage
 *
 * Looks for schema JSON under scripts/schemas/<schemaFileName>.json, adds issuerId and POSTs it.
 * Prints the created schema id (last line on stdout) for easy scripting.
 */
import fs from 'fs'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'
import type {
  AnonCredsCredentialDefinitionResponse,
  AnonCredsSchemaResponse,
  CredentialDefinitionId,
  SchemaId,
} from '../src/controllers/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ParsedArgs {
  schemaFileName?: string
  issuerId: string
  baseUrl: string
}

function printUsageAndExit(code: number): never {
  process.stderr.write(
    'Usage: register-schema <schemaFileName> [--issuer <did>] [--base-url <url>]\n' +
      'Examples:\n' +
      '  node --experimental-strip-types ./scripts/register-schema.ts makeAuthorisation --issuer did:key:abc --base-url http://localhost:3000\n' +
      '  node --experimental-strip-types ./scripts/register-schema.ts makeAuthorisation --base-url http://localhost:3000\n' +
      'If --issuer is omitted, DID will be did:web:alice%3A8443\n'
  )
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3000',
    issuerId: 'did:web:alice%3A8443',
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--issuer' || a === '-i') {
      parsed.issuerId = args[++i]
      continue
    }
    if (a === '--base-url' || a === '-b') {
      parsed.baseUrl = args[++i]
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }
    if (!a.startsWith('-') && !parsed.schemaFileName) {
      parsed.schemaFileName = a
      continue
    }
    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { schemaFileName, issuerId, baseUrl } = parseArgs(process.argv)
  if (!schemaFileName) throw new Error('Schema key argument required, e.g. `makeAuthorisation`')

  const schemaPath = path.join(__dirname, 'schemas', `${schemaFileName}`)
  if (!fs.existsSync(schemaPath)) throw new Error(`Schema definition not found: ${schemaPath}`)
  const raw = fs.readFileSync(schemaPath, 'utf8')
  const schema = JSON.parse(raw)
  const body = { ...schema, issuerId }

  const log = (msg: string, extra?: unknown) => {
    // use stderr so that any stdout piping (e.g. capturing id) is clean
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }
  log(`Registering schema '${schemaFileName}' at ${baseUrl}/v1/schemas with issuerId ${issuerId}`)

  const res = await fetch(`${baseUrl}/v1/schemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed registering schema: ${res.status} ${text}`)
  }

  const json = (await res.json()) as AnonCredsSchemaResponse

  if (!json.id) throw new Error('Schema registration response missing id')
  const schemaId: SchemaId = json.id
  log('Schema registered:', { id: schemaId })

  let credDefId: CredentialDefinitionId | undefined
  // Derive tag: <schemaName>_V<version>
  const baseName = (json.name ?? schemaFileName).replace(/\s+/g, '_')
  const version = json.version ?? '1.0.0'
  const tag = `${baseName}_V${version}`

  // First attempt to find existing credential definition
  const listUrl = new URL(`${baseUrl}/v1/credential-definitions`)
  listUrl.searchParams.set('createdLocally', 'true')
  listUrl.searchParams.set('issuerId', issuerId)
  listUrl.searchParams.set('schemaId', schemaId)
  try {
    const existingRes = await fetch(listUrl.toString(), {})
    if (existingRes.ok) {
      const existing = (await existingRes.json()) as Array<AnonCredsCredentialDefinitionResponse>
      const found = existing.find((e) => e.tag === tag) || existing[0]
      if (found) {
        credDefId = found.id
        log('Reusing existing credential definition', { id: credDefId, tag })
      }
    }
  } catch (e) {
    log('Warning: unable to query existing credential definitions', (e as Error).message)
  }

  if (!credDefId) {
    log('Creating credential definition', { tag })
    const cdRes = await fetch(`${baseUrl}/v1/credential-definitions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issuerId, schemaId, tag }),
    })
    if (!cdRes.ok) {
      const text = await cdRes.text()
      throw new Error(`Failed registering credential definition: ${cdRes.status} ${text}`)
    }
    const cdJson = (await cdRes.json()) as { id?: CredentialDefinitionId }
    if (!cdJson.id) throw new Error('Credential definition response missing id')
    credDefId = cdJson.id
    log('Credential definition registered', { id: credDefId })
  }

  // Output (stdout) schemaId first line, credential definition (if any) second line.
  process.stdout.write(`${schemaId}\n`)
  if (credDefId) process.stdout.write(`${credDefId}\n`)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
