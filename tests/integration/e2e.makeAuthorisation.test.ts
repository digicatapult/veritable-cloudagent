import { expect } from 'chai'
import { execFile } from 'node:child_process'
import path from 'path'
import request from 'supertest'

// This test validates the registration script itself, then checks Bob (maker) can fetch the schema.

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const MAKER_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'
const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'register-schema.mjs')
const SCHEMA_KEY = 'makeAuthorisation'
const SCHEMA_NAME = 'mod_make_authorisation'

// Hard-coded attributes list should match scripts/schemas/makeAuthorisation.json
const EXPECTED_ATTRS = [
  'request_id',
  'requested_part_number',
  'requested_part_name',
  'requester_unit',
  'requester_contact_name',
  'requester_contact_email',
  'authorising_body',
  'authorisation_scope',
  'authorisation_issue_date',
  'authorisation_expiry_date',
  'security_classification',
  'export_control_classification',
  'tdp_reference',
  'tdp_version',
  'tdp_format',
  'permitted_use',
  'caveats',
  'revocation_reference',
]

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
  this.retries(5)
  let schemaId: string

  it('runs the registration script (Alice) and captures a schema id', async function () {
    // Execute the script. It prints the schema id to stdout on success.
    try {
      const { stdout } = await execFilePromise(
        'node',
        [SCRIPT_PATH, SCHEMA_KEY, '--issuer', issuerId, '--base-url', ISSUER_BASE_URL],
        {
          env: { ...process.env },
        }
      )
      const lines = stdout.trim().split(/\r?\n/) // last line should be schema id
      schemaId = lines[lines.length - 1]?.trim()
      expect(schemaId, 'schema id from script stdout').to.be.a('string').and.to.have.length.greaterThan(0)
    } catch (e: unknown) {
      // If script failed (likely already registered), attempt to look it up via issuer listing.
      const message = (e as Error)?.message
      if (message) process.stderr.write(`register-schema script info: ${message}\n`)
      const res = await request(ISSUER_BASE_URL)
        .get('/v1/schemas')
        .query({ createdLocally: true, issuerId, schemaName: SCHEMA_NAME })
        .expect('Content-Type', /json/)
        .expect(200)
      expect(res.body).to.be.an('array').that.has.length(1)
      schemaId = res.body[0].id
    }
    expect(schemaId).to.match(/:2:/, 'expected anoncreds schema id structure with :2: segment')
  })

  it('Maker (Bob) resolves the schema by id', async function () {
    const res = await request(MAKER_BASE_URL).get(`/v1/schemas/${schemaId}`).expect('Content-Type', /json/).expect(200)
    expect(res.body).to.include({ id: schemaId, name: SCHEMA_NAME, version: '1.0.0' })
    expect(res.body.attrNames).to.have.members(EXPECTED_ATTRS)
  })
})
