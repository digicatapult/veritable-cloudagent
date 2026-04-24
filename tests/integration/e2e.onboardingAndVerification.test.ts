import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { CredentialDefinitionId, SchemaId, UUID } from '../../src/controllers/types/index.js'
import {
  ALICE_BASE_URL,
  BOB_BASE_URL,
  CHARLIE_BASE_URL,
  ISSUER_DID_KEY,
  OOB_INVITATION_PAYLOAD,
} from './utils/fixtures.js'
import {
  acceptCredential,
  acceptPresentation,
  waitForConnectionByOob,
  waitForCredentialRecord,
  waitForCredentialState,
  waitForProofRecordByThread,
  waitForProofState,
} from './utils/helpers.js'

describe('Onboarding & Verification flow with AnonCreds', function () {
  this.timeout(60000)
  const issuerClient = request(ALICE_BASE_URL)
  const holderClient = request(BOB_BASE_URL)
  const verifierClient = request(CHARLIE_BASE_URL)
  const issuerId = ISSUER_DID_KEY
  let schemaId: SchemaId
  let credentialDefinitionId: CredentialDefinitionId
  let issuerToHolderOobRecordId: UUID
  let verifierToHolderOobRecordId: UUID
  let issuerToHolderInvitationUrl: string
  let verifierToHolderInvitationUrl: string
  let holderToIssuerConnectionRecordId: UUID
  let issuerToHolderConnectionRecordId: UUID
  let verifierToHolderConnectionRecordId: UUID
  let holderToVerifierConnectionRecordId: UUID
  let issuerCredentialRecordId: UUID
  let holderCredentialRecordId: UUID
  let holderProofRequestId: UUID
  let verifierProofRequestId: UUID
  let threadIdOnVerifier: UUID

  beforeEach(function (done) {
    // pause between tests/retries to allow state to resolve on peers
    setTimeout(function () {
      done()
    }, 200)
  })

  it('should allow an Issuer to create a Schema', async function () {
    const createSchemaPayload = {
      issuerId,
      version: '1.0',
      name: 'placeholderSchema',
      attrNames: ['checkName', 'companyName', 'companiesHouseNumber', 'issueDate', 'expiryDate'],
    }

    const response = await issuerClient
      .post('/v1/schemas')
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
      .post('/v1/credential-definitions')
      .send(createCredDefPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id')
    credentialDefinitionId = response.body.id
  })

  it('should allow an Issuer to create an OOB invitation', async function () {
    const response = await issuerClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
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
      .post('/v1/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.nested.property('connectionRecord.id')
    holderToIssuerConnectionRecordId = response.body.connectionRecord.id
  })

  it('should create a connection record on the Holder', async function () {
    const response = await holderClient
      .get(`/v1/connections/${holderToIssuerConnectionRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id', holderToIssuerConnectionRecordId)
  })

  it('should create a connection record on the Issuer', async function () {
    issuerToHolderConnectionRecordId = await waitForConnectionByOob(issuerClient, issuerToHolderOobRecordId)
    expect(issuerToHolderConnectionRecordId).to.be.a('string')
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
      autoAcceptCredential: 'never',
      connectionId: issuerToHolderConnectionRecordId,
    }

    const response = await issuerClient
      .post('/v1/credentials/offer-credential')
      .send(credentialOfferPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'offer-sent')
    expect(response.body).to.have.property('id')
    issuerCredentialRecordId = response.body.id
  })

  it('should allow the Holder to fetch a record of the credential offered', async function () {
    const record = await waitForCredentialRecord(holderClient, holderToIssuerConnectionRecordId, 'offer-received')
    expect(record).to.have.property('state', 'offer-received')
    holderCredentialRecordId = record.id
  })

  it('should allow the Holder to accept the credential offered', async function () {
    const acceptCredentialOfferPayload = { autoAcceptCredential: 'never' }

    const response = await holderClient
      .post(`/v1/credentials/${holderCredentialRecordId}/accept-offer`)
      .send(acceptCredentialOfferPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'request-sent')
  })

  it('should allow the Issuer to accept the credential request', async function () {
    const record = await waitForCredentialRecord(issuerClient, issuerToHolderConnectionRecordId, 'request-received')
    await issuerClient.post(`/v1/credentials/${record.id}/accept-request`).send({}).expect(200)
  })

  it('should allow the Holder to accept the issued credential', async function () {
    const record = await waitForCredentialRecord(holderClient, holderToIssuerConnectionRecordId, 'credential-received')
    holderCredentialRecordId = record.id

    await acceptCredential(holderClient, holderCredentialRecordId)
  })

  it('should let the Issuer see the credential as issued', async function () {
    const state = await waitForCredentialState(issuerClient, issuerCredentialRecordId, 'done')
    expect(state).to.equal('done')
  })

  it('should let the Holder see the credential as issued', async function () {
    const record = await waitForCredentialRecord(holderClient, holderToIssuerConnectionRecordId, 'done')
    expect(record).to.have.property('state', 'done')
    holderCredentialRecordId = record.id
  })

  //   ===================== following the connection and credential issuance =============================
  it('should allow a Verifier to create an OOB invitation', async function () {
    const response = await verifierClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
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
      .post('/v1/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.nested.property('connectionRecord.id')
    holderToVerifierConnectionRecordId = response.body.connectionRecord.id
  })

  it('should create a connection record on the Holder', async function () {
    const response = await holderClient
      .get(`/v1/connections/${holderToVerifierConnectionRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('id', holderToVerifierConnectionRecordId)
  })

  it('should create a connection record on the Verifier', async function () {
    verifierToHolderConnectionRecordId = await waitForConnectionByOob(verifierClient, verifierToHolderOobRecordId)
    expect(verifierToHolderConnectionRecordId).to.be.a('string')
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
              names: ['checkName', 'companyName', 'companiesHouseNumber', 'issueDate', 'expiryDate'],
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
      autoAcceptProof: 'never',
      connectionId: verifierToHolderConnectionRecordId,
    }
    const response = await verifierClient
      .post('/v1/proofs/request-proof')
      .send(requestProofBody)
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body).to.have.property('state', 'request-sent')
    verifierProofRequestId = response.body.id
    threadIdOnVerifier = response.body.threadId
  })

  it('should let the Holder see all proof requests they received', async function () {
    const record = await waitForProofRecordByThread(holderClient, threadIdOnVerifier, 'request-received')
    expect(record).to.not.equal(undefined)
    holderProofRequestId = record.id
  })

  it('should let the Holder see specific proof requests', async function () {
    const response = await holderClient
      .get(`/v1/proofs/${holderProofRequestId}`)
      .expect('Content-Type', /json/)
      .expect(200)
    expect(response.body.id).to.be.equal(holderProofRequestId)
  })

  it('should let the Holder accept proof record', async function () {
    // 1. Fetch with includeContent
    const proofRes = await holderClient
      .get(`/v1/proofs/${holderProofRequestId}`)
      .query({ includeContent: true })
      .expect('Content-Type', /json/)
      .expect(200)

    expect(proofRes.body.content).to.not.equal(undefined)

    // 2. Fetch simplified view
    const contentRes = await holderClient
      .get(`/v1/proofs/${holderProofRequestId}/content`)
      .query({ view: 'simplified' })
      .expect('Content-Type', /json/)
      .expect(200)

    // Simplified view is empty before presentation is sent
    expect(contentRes.body).to.deep.equal({})

    // 3. Accept with simplified format
    // Fetch credentials to get the ID for explicit selection
    const credentialsRes = await holderClient.get(`/v1/proofs/${holderProofRequestId}/credentials`).expect(200)

    const credentialId = credentialsRes.body.proofFormats.anoncreds.attributes.name[0].credentialId

    const acceptProofBody = {
      useReturnRoute: true,
      willConfirm: true,
      proofFormats: {
        anoncreds: {
          attributes: {
            name: {
              credentialId: credentialId,
              revealed: true,
            },
          },
        },
      },
    }
    const response = await holderClient
      .post(`/v1/proofs/${holderProofRequestId}/accept-request`)
      .send(acceptProofBody)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body.state).to.be.equal('presentation-sent')
  })

  it('should allow the Verifier to accept the presentation', async function () {
    await waitForProofState(verifierClient, verifierProofRequestId, 'presentation-received')
    await acceptPresentation(verifierClient, verifierProofRequestId)
  })

  it('should let the Verifier see all proof requests and check the one with correct threadId is in done state', async function () {
    const state = await waitForProofState(verifierClient, verifierProofRequestId, 'done')
    expect(state).to.equal('done')
  })
})
