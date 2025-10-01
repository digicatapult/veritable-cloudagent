#!/usr/bin/env ts-node
/*
 * Script to register a predefined AnonCreds schema with a running cloud agent.
 *
 * Usage:
 *   ISSUER_ID=<did> BASE_URL=http://localhost:3000 npm run register:schema -- makeAuthorisation
 *
 * Looks for a schema JSON under scripts/schemas/<schemaKey>.json
 * Adds the issuerId from env and POSTs to /v1/schemas.
 */
import assert from 'assert'
import fs from 'fs'
import fetch from 'node-fetch'
import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const schemaKey = process.argv[2]
  if (!schemaKey) throw new Error('Schema key argument required, e.g. `makeAuthorisation`')
  const issuerId = process.env.ISSUER_ID
  assert(issuerId, 'ISSUER_ID env var required')
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

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

  const json = await res.json()
  log('Schema registered:', json)
}

main().catch((e) => process.stderr.write((e as Error).stack + '\n') && process.exit(1))
