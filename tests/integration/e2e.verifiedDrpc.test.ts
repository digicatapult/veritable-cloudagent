import request from 'supertest'
import { describe, it } from 'mocha'
import { expect } from 'chai'

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? ''
const ISSUER_DID = process.env.ALICE_DID ?? ''
const ISSUER_PRIV_KEY = process.env.ALICE_PRIV_KEY ?? ''
const BOB_BASE_URL = process.env.BOB_BASE_URL ?? ''
const BOB_DID = process.env.BOB_DID ?? ''
const BOB_PRIV_KEY = process.env.BOB_PRIV_KEY ?? ''
const CHARLIE_BASE_URL = process.env.CHARLIE_BASE_URL ?? ''
const CHARLIE_DID = process.env.CHARLIE_DID ?? ''
const CHARLIE_PRIV_KEY = process.env.CHARLIE_PRIV_KEY ?? ''

describe('Onboarding & Verification flow', async function () {
  this.retries(25)

  const issuerClient = request(ISSUER_BASE_URL)
  const bobClient = request(BOB_BASE_URL)
  const charlieClient = request(CHARLIE_BASE_URL)
  let schemaId: string
  let credentialDefinitionId: string
  let failed = false

  beforeEach(function (done) {
    // abort remaining tests in suite if one fails
    failed && this.skip()
    // pause between tests/retries to allow state to resolve on peers
    setTimeout(function () {
      done()
    }, 200)
  })

  afterEach(function () {
    // flag to track suite failure
    failed = failed || this?.currentTest?.state === 'failed'
  })

  before( async function () {
    // register dids
    await issuerClient
      .post('/dids/import')
      .send({
        did: ISSUER_DID,
        privateKeys: [{
          keyType: 'ed25519',
          privateKey: ISSUER_PRIV_KEY,
        }],
        overwrite: true,
      })
      .expect('Content-Type', /json/)
      .expect(200)

    await issuerClient
      .post('/dids/import')
      .send({
        did: BOB_DID,
        privateKeys: [{
          keyType: 'ed25519',
          privateKey: BOB_PRIV_KEY,
        }],
        overwrite: true,
      })
      .expect('Content-Type', /json/)
      .expect(200)

    await issuerClient
      .post('/dids/import')
      .send({
        did: CHARLIE_DID,
        privateKeys: [{
          keyType: 'ed25519',
          privateKey: CHARLIE_PRIV_KEY,
        }],
        overwrite: true,
      })
      .expect('Content-Type', /json/)
      .expect(200)

    // create schema
    let response = await issuerClient
      .post('/schemas')
      .send({
        issuerId: ISSUER_DID,
        version: '1.0',
        name: 'testSchema',
        attrNames: ['companiesHouseNumber'],
      })
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body).to.have.property('id')
    schemaId = response.body.id

    // create credential definition
    response = await issuerClient
      .post('/credential-definitions')
      .send({
        tag: 'testCredDef',
        schemaId: schemaId,
        issuerId: ISSUER_DID,
      })
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body).to.have.property('id')
    credentialDefinitionId = response.body.id

    // issue credential to alice
    
  })

  it('allow one peer to send a DRPC request to another if they each have the correct credentials',  async function () {
    
  })
})