import { expect } from 'chai'
import makerAuthorisationSchema from '../../scripts/schemas/makeAuthorisation.json' with { type: 'json' }

// This test validates the registration via API, then checks Bob (maker) can fetch the schema.

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const IPFS_GATEWAY = process.env.IPFS_GATEWAY ?? 'http://localhost:8080'

// Alice DID (issuer)
const issuerId = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'

describe('Register makeAuthorisation schema', function () {
  let schemaId: string

  it('registers the schema via API (Alice) and captures a schema id', async function () {
    this.timeout(10000)

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
    this.timeout(10000)
    const cid = schemaId.split('ipfs://')[1]

    const url = `${IPFS_GATEWAY}/ipfs/${cid}`

    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Failed to fetch from IPFS gateway: ${res.status}`)
    }

    const schemaContent = await res.json()

    expect(schemaContent).to.include({
      issuerId,
      name: makerAuthorisationSchema.name,
      version: makerAuthorisationSchema.version,
    })
  })
})
