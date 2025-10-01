#!/usr/bin/env ts-node
/**
 * Script to register a predefined AnonCreds schema with a running cloud agent.
 *
 * Usage:
 *   ts-node scripts/register-schema.ts <schemaKey> --issuer <did> --base-url <agent_url>
 *   node --import @swc-node/register/esm-register scripts/register-schema.ts makeAuthorisation \
 *     --issuer did:key:z6Abc123 --base-url http://localhost:3000
 *
 * Flags:
 *   --issuer, -i     DID of issuer (required)
 *   --base-url, -b   Base agent URL (default: http://localhost:3000)
 *   --help, -h       Show usage
 *
 * Looks for schema JSON under scripts/schemas/<schemaKey>.json, adds issuerId and POSTs it.
 * Prints the created schema id (last line on stdout) for easy scripting.
 */
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface ParsedArgs {
  schemaKey?: string
  issuerId?: string
  baseUrl: string
  didWebHost: string
  didWebPort: number
  insecureDidWeb: boolean
}

function printUsageAndExit(code: number): never {
  process.stderr.write(
    'Usage: register-schema <schemaKey> [--issuer <did>] [--base-url <url>] [--did-web-host <host>] [--did-web-port <port>] [--insecure-did-web]\n' +
      'Examples:\n' +
      '  node scripts/register-schema.mjs makeAuthorisation --issuer did:key:abc --base-url http://localhost:3000\n' +
      '  ts-node scripts/register-schema.ts makeAuthorisation --base-url http://localhost:3000 --did-web-host localhost --did-web-port 8443\n' +
      'If --issuer is omitted, DID will be fetched from https://<did-web-host>:<did-web-port>/did.json (or http if --insecure-did-web).\n'
  )
  process.exit(code)
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const parsed: ParsedArgs = {
    baseUrl: 'http://localhost:3000',
    didWebHost: 'localhost',
    didWebPort: 8443,
    insecureDidWeb: false,
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
    if (a === '--did-web-host') {
      parsed.didWebHost = args[++i]
      continue
    }
    if (a === '--did-web-port') {
      parsed.didWebPort = Number(args[++i])
      continue
    }
    if (a === '--insecure-did-web') {
      parsed.insecureDidWeb = true
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }
    if (!a.startsWith('-') && !parsed.schemaKey) {
      parsed.schemaKey = a
      continue
    }
    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return parsed
}

async function main() {
  const { schemaKey, issuerId: issuerIdArg, baseUrl, didWebHost, didWebPort } = parseArgs(process.argv)
  if (!schemaKey) throw new Error('Schema key argument required, e.g. `makeAuthorisation`')
  let issuerId = issuerIdArg
  if (!issuerId) {
    const didWebUrl = `https://${didWebHost}:${didWebPort}/did.json`
    const didRes = await fetch(didWebUrl, {})
    if (!didRes.ok) {
      const text = await didRes.text()
      throw new Error(`Failed to resolve did:web document from ${didWebUrl}: ${didRes.status} ${text}`)
    }
    const didJson = (await didRes.json()) as { id?: string }
    if (!didJson.id) throw new Error(`did.json at ${didWebUrl} missing 'id' field`)
    issuerId = didJson.id
  }

  const schemaPath = path.join(__dirname, 'schemas', `${schemaKey}.json`)
  if (!fs.existsSync(schemaPath)) throw new Error(`Schema definition not found: ${schemaPath}`)
  const raw = fs.readFileSync(schemaPath, 'utf8')
  const schema = JSON.parse(raw)
  const body = { ...schema, issuerId }

  const log = (msg: string, extra?: unknown) => {
    // use stderr so that any stdout piping (e.g. capturing id) is clean
    process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  }
  log(`Registering schema '${schemaKey}' at ${baseUrl}/v1/schemas with issuerId ${issuerId}`)

  const res = await fetch(`${baseUrl}/v1/schemas`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed registering schema: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { id?: string; [k: string]: unknown }
  log('Schema registered:', json)
  if (json.id) process.stdout.write(`${json.id}\n`)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
