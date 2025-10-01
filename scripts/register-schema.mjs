#!/usr/bin/env node
/**
 * Script to register a predefined AnonCreds schema with a running cloud agent.
 *
 * Usage example:
 *   ISSUER_ID=did:key:xyz BASE_URL=http://localhost:3000 node scripts/register-schema.mjs makeAuthorisation
 *
 * Looks for a schema JSON under scripts/schemas/<schemaKey>.json
 * Adds the issuerId from env and POSTs to /v1/schemas.
 */
import fs from 'fs'
import path from 'path'
import process from 'process'
import { setTimeout as sleep } from 'timers/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const schemaKey = process.argv[2]
  if (!schemaKey) throw new Error('Schema key argument required, e.g. `makeAuthorisation`')
  const issuerId = process.env.ISSUER_ID
  if (!issuerId) throw new Error('ISSUER_ID env var required')
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

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
