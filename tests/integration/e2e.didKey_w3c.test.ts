import { expect } from 'chai'
import { before, beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { UUID } from '../../src/controllers/types/index.js'
import { ALICE_BASE_URL, BOB_BASE_URL, CHARLIE_BASE_URL, OOB_INVITATION_PAYLOAD } from './utils/fixtures.js'
import {
  waitForConnectionByOob,
  waitForConnectionState,
  waitForCredentialRecord,
  waitForCredentialState,
  waitForProofRecordByThread,
  waitForProofState,
} from './utils/helpers.js'

describe('DID:key Explicit Connection Flow + Credential Issuance', function () {
  this.timeout(60000)
  const issuerClient = request(ALICE_BASE_URL) // Alice
  const holderClient = request(BOB_BASE_URL) // Bob
  const verifierClient = request(CHARLIE_BASE_URL)

  let ISSUER_DID: string
  let HOLDER_DID: string

  let issuerToHolderOobRecordId: UUID
  let verifierToHolderOobRecordId: UUID
  let issuerToHolderInvitationUrl: string
  let verifierToHolderInvitationUrl: string

  let holderToIssuerConnectionRecordId: UUID
  let issuerToHolderConnectionRecordId: UUID

  let verifierToHolderConnectionRecordId: UUID

  let issuerCredentialRecordId: UUID
  let holderCredentialRecordId: UUID

  let holderProofRequestId: UUID
  let verifierProofRecordId: UUID
  let verifierThreadId: string

  before(async function () {
    // Create Issuer DID
    const issuerResponse = await issuerClient.post('/v1/dids/create').send({
      method: 'key',
      options: {
        keyType: 'ed25519',
      },
    })
    ISSUER_DID = issuerResponse.body.did

    // Create Holder DID
    const holderResponse = await holderClient.post('/v1/dids/create').send({
      method: 'key',
      options: {
        keyType: 'ed25519',
      },
    })
    HOLDER_DID = holderResponse.body.did
  })

  beforeEach(function (done) {
    setTimeout(function () {
      done()
    }, 200)
  })

  // --- 1. Connection: Issuer <-> Holder ---

  it('should allow an Issuer to create an OOB invitation', async function () {
    const response = await issuerClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('invitationUrl')
    issuerToHolderInvitationUrl = response.body.invitationUrl
    issuerToHolderOobRecordId = response.body.outOfBandRecord.id
  })

  it("should allow a Holder to accept Issuer's invitation", async function () {
    const acceptInvitationPayload = { invitationUrl: issuerToHolderInvitationUrl }

    const response = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    holderToIssuerConnectionRecordId = response.body.connectionRecord.id
  })

  it('should wait for connection to be established on Issuer side', async function () {
    this.timeout(120000)
    issuerToHolderConnectionRecordId = await waitForConnectionByOob(issuerClient, issuerToHolderOobRecordId)
    const state = await waitForConnectionState(issuerClient, issuerToHolderConnectionRecordId, 'completed')
    expect(state).to.equal('completed')
  })

  it('should wait for connection to be established on Holder side', async function () {
    const state = await waitForConnectionState(holderClient, holderToIssuerConnectionRecordId, 'completed')
    expect(state).to.equal('completed')
  })

  // --- 2. W3C Credential Issuance ---

  it('should allow the Issuer to offer a W3C (JSON-LD) credential', async function () {
    const offerCredentialPayload = {
      protocolVersion: 'v2',
      connectionId: issuerToHolderConnectionRecordId,
      credentialFormats: {
        jsonld: {
          credential: {
            '@context': ['https://www.w3.org/2018/credentials/v1', 'http://schema.org/'],
            type: ['VerifiableCredential', 'Person'],
            issuer: ISSUER_DID,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
              id: HOLDER_DID, // Holder DID
              givenName: 'Alice',
              familyName: 'Doe',
            },
          },
          options: {
            proofType: 'Ed25519Signature2018',
            proofPurpose: 'assertionMethod',
          },
        },
      },
    }

    const response = await issuerClient
      .post('/v1/credentials/offer-credential')
      .send(offerCredentialPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'offer-sent')
    issuerCredentialRecordId = response.body.id
  })

  it('should allow the Holder to receive the W3C credential offer', async function () {
    const record = await waitForCredentialRecord(holderClient, holderToIssuerConnectionRecordId, 'offer-received')
    holderCredentialRecordId = record.id
    expect(record).to.have.property('state', 'offer-received')
  })

  it('should allow the Holder to accept the W3C credential offer', async function () {
    const acceptPayload = {
      credentialFormats: {
        jsonld: {
          // providing minimal binding info
        },
      },
    }

    const response = await holderClient
      .post(`/v1/credentials/${holderCredentialRecordId}/accept-offer`)
      .send(acceptPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'request-sent')
  })

  it('should allow the Holder to accept the issued credential', async function () {
    const state = await waitForCredentialState(holderClient, holderCredentialRecordId, 'credential-received')
    expect(state).to.equal('credential-received')

    // Explicitly accept the credential (storage)
    const response = await holderClient
      .post(`/v1/credentials/${holderCredentialRecordId}/accept-credential`)
      .send({})
      .expect(200)

    expect(response.body.state).to.equal('done')
  })

  it('should confirm the credential has been issued (done state)', async function () {
    const holderState = await waitForCredentialState(holderClient, holderCredentialRecordId, 'done')
    expect(holderState).to.equal('done')

    const issuerState = await waitForCredentialState(issuerClient, issuerCredentialRecordId, 'done')
    expect(issuerState).to.equal('done')
  })

  // --- 3. Connection: Verifier <-> Holder ---

  it('should allow a Verifier to create an OOB invitation', async function () {
    const response = await verifierClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect('Content-Type', /json/)
      .expect(200)

    verifierToHolderInvitationUrl = response.body.invitationUrl
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
  })

  it('should create a connection record on the Verifier', async function () {
    verifierToHolderConnectionRecordId = await waitForConnectionByOob(verifierClient, verifierToHolderOobRecordId)
    expect(verifierToHolderConnectionRecordId).to.be.a('string')
  })

  // --- 4. W3C Proof Verification (Presentation Exchange) ---

  it('should let Verifier request W3C proof (Presentation Exchange)', async function () {
    const requestProofPayload = {
      connectionId: verifierToHolderConnectionRecordId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: '32f54163-7166-48f1-93d8-ff217bdb0653',
            name: 'Person Identity Request',
            purpose: 'We need to verify your identity',
            input_descriptors: [
              {
                id: 'person_credential',
                name: 'Person Credential',
                constraints: {
                  fields: [
                    {
                      path: ['$.credentialSubject.givenName'],
                      filter: {
                        type: 'string',
                        pattern: 'Alice',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    const response = await verifierClient
      .post('/v1/proofs/request-proof')
      .send(requestProofPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.have.property('state', 'request-sent')
    verifierProofRecordId = response.body.id
    verifierThreadId = response.body.threadId
  })

  it('should allow Holder to receive proof request', async function () {
    const record = await waitForProofRecordByThread(holderClient, verifierThreadId, 'request-received')
    holderProofRequestId = record.id
    expect(record).to.have.property('state', 'request-received')
  })

  it('should allow Holder to accept proof request', async function () {
    const acceptPayload = {
      proofFormats: {
        presentationExchange: {
          // Auto-select
        },
      },
    }

    await holderClient
      .post(`/v1/proofs/${holderProofRequestId}/accept-request`)
      .send(acceptPayload)
      .expect('Content-Type', /json/)
      .expect(200)
  })

  it('should complete W3C verification (Verifier verified)', async function () {
    // Wait for the presentation to be received
    await waitForProofState(verifierClient, verifierProofRecordId, 'presentation-received', { maxAttempts: 30 })

    // Manually accept the presentation (required since AUTO_ACCEPT_PROOFS=never)
    await verifierClient.post(`/v1/proofs/${verifierProofRecordId}/accept-presentation`).send({}).expect(200)

    const state = await waitForProofState(verifierClient, verifierProofRecordId, 'done', { maxAttempts: 30 })
    expect(state).to.equal('done')
  })
})
