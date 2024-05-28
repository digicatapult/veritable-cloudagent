import request from 'supertest'
import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { ProofExchangeRecord, ProofExchangeRecordProps } from '@credo-ts/core'

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? ''
const HOLDER_BASE_URL = process.env.BOB_BASE_URL ?? ''
const VERIFIER_BASE_URL = process.env.CHARLIE_BASE_URL ?? ''

describe('Onboarding & Verification flow', function () {
  this.retries(25)

  const issuerClient = request(ISSUER_BASE_URL)
  const holderClient = request(HOLDER_BASE_URL)
  const verifierClient = request(VERIFIER_BASE_URL)
  const issuerId = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'
  let schemaId: string
  let credentialDefinitionId: string
  let issuerToHolderOobRecordId: string
  let verifierToHolderOobRecordId: string
  let issuerToHolderInvitationUrl: string
  let verifierToHolderInvitationUrl: string
  let holderToIssuerConnectionRecordId: string
  let issuerToHolderConnectionRecordId: string
  let verifierToHolderConnectionRecordId: string
  let holderToVerifierConnectionRecordId: string
  let issuerCredentialRecordId: string
  let holderCredentialRecordId: string
  let holderProofRequestId: string
  let threadIdOnVerifier: string
  let threadIdOnHolder: string
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

  it('should allow an Issuer to create a Schema', async function () {
    const createSchemaPayload = {
      issuerId,
      version: '1.0',
      name: 'placeholderSchema',
      attrNames: ['checkName', 'companyName', 'companiesHouseNumber', 'issueDate', 'expiryDate'],
    }

    const response = await issuerClient
      .post('/schemas')
      .send(createSchemaPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id')
    schemaId = response.body.id
  })

  it('should allow an issuer to create a Credential Definition', async function () {
    const createCredDefPayload = {
      tag: 'placeholderCredDef',
      schemaId: schemaId,
      issuerId: issuerId,
    }

    const response = await issuerClient
      .post('/credential-definitions')
      .send(createCredDefPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id')
    credentialDefinitionId = response.body.id
  })

  it('should allow an Issuer to create an OOB invitation', async function () {
    const createInvitationPayload = {
      handshake: true,
      handshakeProtocols: ['https://didcomm.org/connections/1.x'],
      autoAcceptConnection: true,
    }

    const response = await issuerClient
      .post('/oob/create-invitation')
      .send(createInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('invitationUrl')
    issuerToHolderInvitationUrl = response.body.invitationUrl
    expect(response.body).to.have.nested.property('outOfBandRecord.id')
    issuerToHolderOobRecordId = response.body.outOfBandRecord.id
  })

  it("should allow a Holder to accept an Issuer's invitation", async function () {
    const acceptInvitationPayload = { invitationUrl: issuerToHolderInvitationUrl }

    const response = await holderClient
      .post('/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.nested.property('connectionRecord.id')
    holderToIssuerConnectionRecordId = response.body.connectionRecord.id
  })

  it('should create a connection record on the Holder', async function () {
    const response = await holderClient
      .get(`/connections/${holderToIssuerConnectionRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id', holderToIssuerConnectionRecordId)
  })

  it('should create a connection record on the Issuer', async function () {
    const response = await issuerClient
      .get('/connections')
      .query({ outOfBandId: issuerToHolderOobRecordId })
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.be.an('array').that.has.length(1)
    issuerToHolderConnectionRecordId = response.body[0].id
  })

  it('should allow an Issuer to offer credentials to a Holder', async function () {
    const credentialOfferPayload = {
      protocolVersion: 'v2',
      credentialFormats: {
        anoncreds: {
          credentialDefinitionId,
          attributes: [
            {
              name: 'checkName',
              value: 'someName',
            },
            {
              name: 'companyName',
              value: 'someCompanyName',
            },
            {
              name: 'companiesHouseNumber',
              value: '2183974',
            },
            {
              name: 'issueDate',
              value: Date.parse('03/03/2003 03:03:03').toString(),
            },
            {
              name: 'expiryDate',
              value: Date.parse('05/05/2005 05:05:05').toString(),
            },
          ],
        },
      },
      autoAcceptCredential: 'always',
      connectionId: issuerToHolderConnectionRecordId,
    }

    const response = await issuerClient
      .post('/credentials/offer-credential')
      .send(credentialOfferPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'offer-sent')
    expect(response.body).to.have.property('id')
    issuerCredentialRecordId = response.body.id
  })

  it('should allow the Holder to fetch a record of the credential offered', async function () {
    const response = await holderClient
      .get('/credentials')
      .query({ connectionId: holderToIssuerConnectionRecordId })
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.be.an('array').that.has.length(1)
    expect(response.body[0]).to.have.property('state', 'offer-received')
    holderCredentialRecordId = response.body[0].id
  })

  it('should allow the Holder to accept the credential offered', async function () {
    const acceptCredentialOfferPayload = { autoAcceptCredential: 'always' }

    const response = await holderClient
      .post(`/credentials/${holderCredentialRecordId}/accept-offer`)
      .send(acceptCredentialOfferPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'request-sent')
  })

  it('should let the Issuer see the credential as issued', async function () {
    const response = await issuerClient
      .get(`/credentials/${issuerCredentialRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'done')
  })

  it('should let the Holder see the credential as issued', async function () {
    const response = await holderClient
      .get(`/credentials/${holderCredentialRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'done')
  })

  //   ===================== following the connection and credential issuance =============================
  it('should allow a Verifier to create an OOB invitation', async function () {
    const createInvitationPayload = {
      handshake: true,
      handshakeProtocols: ['https://didcomm.org/connections/1.x'],
      autoAcceptConnection: true,
    }

    const response = await verifierClient
      .post('/oob/create-invitation')
      .send(createInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('invitationUrl')
    verifierToHolderInvitationUrl = response.body.invitationUrl
    expect(response.body).to.have.nested.property('outOfBandRecord.id')
    verifierToHolderOobRecordId = response.body.outOfBandRecord.id
  })

  it("should allow a Holder to accept Verifier's invitation", async function () {
    const acceptInvitationPayload = { invitationUrl: verifierToHolderInvitationUrl }

    const response = await holderClient
      .post('/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.nested.property('connectionRecord.id')
    holderToVerifierConnectionRecordId = response.body.connectionRecord.id
  })

  it('should create a connection record on the Holder', async function () {
    const response = await holderClient
      .get(`/connections/${holderToVerifierConnectionRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id', holderToVerifierConnectionRecordId)
  })

  it('should create a connection record on the Verifier', async function () {
    const response = await verifierClient
      .get('/connections')
      .query({ outOfBandId: verifierToHolderOobRecordId })
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.be.an('array').that.has.length(1)
    verifierToHolderConnectionRecordId = response.body[0].id
  })

  it('should let Verifier request proof of credential from holder', async function () {
    const requestProofBody = {
      protocolVersion: 'v2',
      proofFormats: {
        anoncreds: {
          name: 'proof-request',
          version: '1.0',

          requested_attributes: {
            name: {
              name: 'checkName',
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
          },
        },
      },
      willConfirm: true,
      autoAcceptProof: 'always',
      connectionId: verifierToHolderConnectionRecordId,
    }
    const response = await verifierClient
      .post('/proofs/request-proof')
      .send(requestProofBody)
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body).to.have.property('state', 'request-sent')
    threadIdOnVerifier = response.body.threadId
  })

  it('should let the Holder see all proof requests they received', async function () {
    const response = await holderClient.get(`/proofs`).expect('Content-Type', /json/).expect(200)
    expect(response.body.length).to.be.above(0)

    let result: ProofExchangeRecordProps = response.body.find(
      ({ threadId }: { threadId: string }) => threadId === threadIdOnVerifier
    )
    if (result.id) {
      holderProofRequestId = result.id
    }
  })

  it('should let the Holder see specific proof reques', async function () {
    const response = await holderClient
      .get(`/proofs/${holderProofRequestId}`)
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body.id).to.be.equal(holderProofRequestId)
  })
  it('should let the Holder accept proof record', async function () {
    const acceptProofBody = {
      useReturnRoute: true,
      willConfirm: true,
      autoAcceptProof: 'always',
    }
    const response = await holderClient
      .post(`/proofs/${holderProofRequestId}/accept-request`)
      .send(acceptProofBody)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body.state).to.be.equal('presentation-sent')
  })
  it('should let the Verifier see all proof requests and check the one with correct threadId is in done state', async function () {
    const response = await verifierClient.get(`/proofs`).expect('Content-Type', /json/).expect(200)

    let result: ProofExchangeRecordProps = response.body.find(
      ({ threadId }: { threadId: string }) => threadId === threadIdOnVerifier
    )
    expect(result.state).to.be.equal('done')
  })
})
