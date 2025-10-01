import { expect } from 'chai'
import request from 'supertest'

// This test assumes the schema has been registered already via the register-schema script.
// It simply verifies that Alice (issuer) can see the created schema and Bob (maker) can resolve it by id.

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const MAKER_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'

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

// MoD DID used in other integration tests (Alice)
const issuerId = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'

describe('MoD makeAuthorisation schema', function () {
  this.retries(10)
  let schemaId: string

  before(async function () {
    // Attempt to find schema; if not present, create it
    const issuerClient = request(ISSUER_BASE_URL)
    const listRes = await issuerClient
      .get('/v1/schemas')
      .query({ createdLocally: true, issuerId, schemaName: 'mod_make_authorisation' })
      .expect('Content-Type', /json/)
      .expect(200)
    if (Array.isArray(listRes.body) && listRes.body.length === 1) {
      schemaId = listRes.body[0].id
      return
    }

    const createPayload = {
      issuerId,
      name: 'mod_make_authorisation',
      version: '1.0.0',
      attrNames: EXPECTED_ATTRS,
    }
    const createRes = await issuerClient
      .post('/v1/schemas')
      .send(createPayload)
      .expect('Content-Type', /json/)
      .expect(200)
    schemaId = createRes.body.id
  })

  it('Issuer (Alice) lists locally created schemas and finds makeAuthorisation', async function () {
    const res = await request(ISSUER_BASE_URL)
      .get('/v1/schemas')
      .query({ createdLocally: true, issuerId, schemaName: 'mod_make_authorisation' })
      .expect('Content-Type', /json/)
      .expect(200)

    expect(res.body).to.be.an('array').that.has.length(1)
    const schema = res.body[0]
    schemaId = schema.id
    expect(schema).to.include({ name: 'mod_make_authorisation', version: '1.0.0' })
    expect(schema.attrNames).to.have.members(EXPECTED_ATTRS)
  })

  it('Maker (Bob) can resolve the schema by id', async function () {
    const res = await request(MAKER_BASE_URL).get(`/v1/schemas/${schemaId}`).expect('Content-Type', /json/).expect(200)

    expect(res.body).to.include({ id: schemaId, name: 'mod_make_authorisation', version: '1.0.0' })
    expect(res.body.attrNames).to.have.members(EXPECTED_ATTRS)
  })
})
