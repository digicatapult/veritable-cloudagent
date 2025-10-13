import { expect } from 'chai'
import { execFile } from 'node:child_process'
import path from 'path'
import makerAuthorisationSchema from '../../scripts/schemas/makeAuthorisation.json' with { type: 'json' }

// This test validates the registration script itself, then checks Bob (maker) can fetch the schema.

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'register-schema.ts')
const SCHEMA_FILENAME = 'makeAuthorisation.json'
const BOB_IPFS_ORIGIN = 'http://ipfs1:5001'

// Alice DID (issuer / MoD)
const issuerId = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'

function execFilePromise(
  cmd: string,
  args: string[],
  opts: Record<string, unknown>
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }))
      resolve({ stdout: String(stdout), stderr: String(stderr) })
    })
  })
}

describe('MoD makeAuthorisation schema (script-driven)', function () {
  let schemaId: string

  it('runs the registration script (Alice) and captures a schema id', async function () {
    this.timeout(10000)
    // Execute the script. It prints the schema id to stdout on success.
    const { stdout } = await execFilePromise(
      'node',
      ['--experimental-strip-types', SCRIPT_PATH, SCHEMA_FILENAME, '--issuer', issuerId, '--base-url', ISSUER_BASE_URL],
      {
        env: { ...process.env },
      }
    )
    const lines = stdout.trim().split(/\r?\n/) // last line should be schema id
    schemaId = lines[lines.length - 1]?.trim()
    expect(schemaId).to.match(/^ipfs:\/\//)
  })

  it('Maker (Bob) can resolve the schema via IPFS', async function () {
    const cid = schemaId.split('ipfs://')[1]

    const url = `${BOB_IPFS_ORIGIN}/api/v0/cat?arg=${cid}`

    const res = await fetch(url, { method: 'POST' })

    const schemaContent = await res.json()

    expect(schemaContent).to.include({
      issuerId,
      tag: `${makerAuthorisationSchema.name}_V${makerAuthorisationSchema.version}`,
    })
  })
})
