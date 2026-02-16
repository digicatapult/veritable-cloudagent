import { expect } from 'chai'
import makerAuthorisationSchema from '../../scripts/schemas/makeAuthorisation.json' with { type: 'json' }
import { ALICE_BASE_URL, BOB_BASE_URL, ISSUER_DID_KEY } from './utils/fixtures.js'

// This test validates the registration via API, then checks Bob (maker) can fetch the schema.

const ISSUER_BASE_URL = ALICE_BASE_URL
const MAKER_BASE_URL = BOB_BASE_URL
const issuerId = ISSUER_DID_KEY

describe('Register makeAuthorisation schema', function () {
  this.timeout(60000)
  let schemaId: string

  it('registers the schema via API (Alice) and captures a schema id', async function () {
    const body = { ...makerAuthorisationSchema, issuerId }

    const res = await fetch(`${ISSUER_BASE_URL}/v1/schemas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed registering schema: ${res.status} ${text}`)
    }

    const json = await res.json()
    schemaId = json.id

    expect(schemaId).to.match(/^ipfs:\/\//)
  })

  it('Maker (Bob) can resolve the schema via IPFS', async function () {
    const url = `${MAKER_BASE_URL}/v1/schemas/${encodeURIComponent(schemaId)}`

    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Failed to fetch from Bob (Maker) agent: ${res.status}`)
    }

    const schemaContent = await res.json()

    expect(schemaContent).to.include({
      issuerId,
      name: makerAuthorisationSchema.name,
      version: makerAuthorisationSchema.version,
    })
  })
})
