#!/usr/bin/env node
/**
 * Script to register a predefined AnonCreds schema with a running cloud agent.
 *
 * Usage:
 *   node scripts/register-schema.mjs <schemaKey> --issuer <did> --base-url <agent_url>
 * Example:
 *   node scripts/register-schema.mjs makeAuthorisation --issuer did:key:z6Abc123 --base-url http://localhost:3000
 *
 * Flags:
 *   --issuer, -i     DID of issuer (required)
 *   --base-url, -b   Base URL of the agent (default: http://localhost:3000)
 *   --help, -h       Show usage
 *
 * Looks for schema JSON under scripts/schemas/<schemaKey>.json
 * Adds issuerId and POSTs to /v1/schemas.
 */
import fs from 'fs'
import path from 'path'
import process from 'process'
import { setTimeout as sleep } from 'timers/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs(argv) {
  const args = argv.slice(2)
  let schemaKey
  let issuerId
  let baseUrl = 'http://localhost:3000'
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--issuer' || a === '-i') {
      issuerId = args[++i]
      continue
    }
    if (a === '--base-url' || a === '-b') {
      baseUrl = args[++i]
      continue
    }
    if (a === '--help' || a === '-h') {
      printUsageAndExit(0)
    }
    if (!a.startsWith('-') && !schemaKey) {
      schemaKey = a
      continue
    }
    // Unknown / duplicate argument
    process.stderr.write(`Unknown or duplicate argument: ${a}\n`)
    printUsageAndExit(1)
  }
  return { schemaKey, issuerId, baseUrl }
}

function printUsageAndExit(code) {
  process.stderr.write(
    'Usage: node scripts/register-schema.mjs <schemaKey> --issuer <did> [--base-url <url>]\n' +
      'Example: node scripts/register-schema.mjs makeAuthorisation --issuer did:key:abc --base-url http://localhost:3000\n'
  )
  process.exit(code)
}

async function main() {
  const { schemaKey, issuerId, baseUrl } = parseArgs(process.argv)
  if (!schemaKey) throw new Error('Schema key argument required, e.g. `makeAuthorisation`')
  if (!issuerId) throw new Error('Issuer DID is required via --issuer')

  const schemaPath = path.join(__dirname, 'schemas', `${schemaKey}.json`)
  if (!fs.existsSync(schemaPath)) throw new Error(`Schema definition not found: ${schemaPath}`)

  const raw = fs.readFileSync(schemaPath, 'utf8')
  const schema = JSON.parse(raw)
  const body = { ...schema, issuerId }

  const log = (msg, extra) => process.stderr.write(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}\n`)
  log(`Registering schema '${schemaKey}' at ${baseUrl}/v1/schemas with issuerId ${issuerId}`)

  // retry loop in case agent startup not complete yet
  let attempt = 0
  while (true) {
    attempt++
    try {
      const res = await fetch(`${baseUrl}/v1/schemas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed registering schema: ${res.status} ${text}`)
      }
      const json = await res.json()
      log('Schema registered:', json)
      // write id to stdout for potential scripting
      process.stdout.write(`${json.id}\n`)
      return
    } catch (e) {
      if (attempt >= 10) throw e
      log(`Attempt ${attempt} failed, retrying in 2s: ${(e && e.message) || e}`)
      await sleep(2000)
    }
  }
}

main().catch((e) => {
  process.stderr.write((e && e.stack) + '\n')
  process.exit(1)
})
