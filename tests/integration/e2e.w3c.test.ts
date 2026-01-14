import { expect } from 'chai'
import { beforeEach, describe, it } from 'mocha'
import request from 'supertest'
import type { UUID } from '../../src/controllers/types.js'

const ISSUER_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'
const HOLDER_BASE_URL = process.env.BOB_BASE_URL ?? 'http://localhost:3001'
const VERIFIER_BASE_URL = process.env.CHARLIE_BASE_URL ?? 'http://localhost:3002'

// Using a known did:key for signatures (matches existing test key for consistency)
const ISSUER_DID = 'did:key:z6MkrDn3MqmedCnj4UPBwZ7nLTBmK9T9BwB3njFmQRUqoFn1'

describe('W3C Credentials E2E Flow', function () {
  const issuerClient = request(ISSUER_BASE_URL) // Alice
  const holderClient = request(HOLDER_BASE_URL) // Bob
  const verifierClient = request(VERIFIER_BASE_URL)

  let issuerToHolderOobRecordId: UUID
  let verifierToHolderOobRecordId: UUID
  let issuerToHolderInvitationUrl: string
  let verifierToHolderInvitationUrl: string

  let holderToIssuerConnectionRecordId: UUID
  let issuerToHolderConnectionRecordId: UUID

  let holderToVerifierConnectionRecordId: UUID
  let verifierToHolderConnectionRecordId: UUID

  let issuerCredentialRecordId: UUID
  let holderCredentialRecordId: UUID

  let holderProofRequestId: UUID
  let verifierProofRecordId: UUID

  beforeEach(function (done) {
    setTimeout(function () {
      done()
    }, 200)
  })

  // --- 1. Connection: Issuer <-> Holder ---

  it('should allow an Issuer to create an OOB invitation', async function () {
    const createInvitationPayload = {
      handshake: true,
      handshakeProtocols: ['https://didcomm.org/connections/1.x'],
      autoAcceptConnection: true,
    }

    const response = await issuerClient
      .post('/v1/oob/create-invitation')
      .send(createInvitationPayload)
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
    let connected = false
    for (let i = 0; i < 10; i++) {
      const response = await issuerClient.get('/v1/connections').query({ outOfBandId: issuerToHolderOobRecordId })
      if (response.body.length > 0 && ['completed'].includes(response.body[0].state)) {
        issuerToHolderConnectionRecordId = response.body[0].id
        connected = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(connected).to.equal(true)
  })

  it('should wait for connection to be established on Holder side', async function () {
    let connected = false
    for (let i = 0; i < 10; i++) {
      const response = await holderClient.get(`/v1/connections/${holderToIssuerConnectionRecordId}`)
      if (['completed'].includes(response.body.state)) {
        connected = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(connected).to.equal(true)
  })

  // --- 2. W3C Credential Issuance ---

  it('should allow the Issuer to offer a W3C (JSON-LD) credential', async function () {
    const offerCredentialPayload = {
      protocolVersion: 'v2',
      connectionId: issuerToHolderConnectionRecordId,
      credentialFormats: {
        jsonld: {
          credential: {
            '@context': ['https://www.w3.org/2018/credentials/v1', 'https://www.w3.org/2018/credentials/examples/v1'],
            type: ['VerifiableCredential', 'UniversityDegreeCredential'],
            issuer: ISSUER_DID,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
              id: 'did:example:123', // Placeholder for Holder DID
              degree: {
                type: 'BachelorDegree',
                name: 'Bachelor of Science and Arts',
              },
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
    let received = false
    for (let i = 0; i < 10; i++) {
      const response = await holderClient
        .get('/v1/credentials')
        .query({ connectionId: holderToIssuerConnectionRecordId })
        .expect(200)

      const record = response.body.find((r: { state: string; id: UUID }) => r.state === 'offer-received')
      if (record) {
        holderCredentialRecordId = record.id
        received = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(received).to.equal(true)
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

  it('should wait for credential to be issued (done state)', async function () {
    let holderDone = false
    let issuerDone = false

    // Check Holder
    for (let i = 0; i < 10; i++) {
      const response = await holderClient.get(`/v1/credentials/${holderCredentialRecordId}`)
      if (response.body.state === 'done') {
        holderDone = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(holderDone).to.equal(true)

    // Check Issuer
    for (let i = 0; i < 10; i++) {
      const response = await issuerClient.get(`/v1/credentials/${issuerCredentialRecordId}`)
      if (response.body.state === 'done') {
        issuerDone = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(issuerDone).to.equal(true)
  })

  // --- 3. Connection: Verifier <-> Holder ---

  it.skip('should allow a Verifier to create an OOB invitation', async function () {
    const createInvitationPayload = {
      handshake: true,
      handshakeProtocols: ['https://didcomm.org/connections/1.x'],
      autoAcceptConnection: true,
    }

    const response = await verifierClient
      .post('/v1/oob/create-invitation')
      .send(createInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    verifierToHolderInvitationUrl = response.body.invitationUrl
    verifierToHolderOobRecordId = response.body.outOfBandRecord.id
  })

  it.skip("should allow a Holder to accept Verifier's invitation", async function () {
    const acceptInvitationPayload = { invitationUrl: verifierToHolderInvitationUrl }

    const response = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send(acceptInvitationPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    holderToVerifierConnectionRecordId = response.body.connectionRecord.id
  })

  it.skip('should create a connection record on the Verifier', async function () {
    let connected = false
    for (let i = 0; i < 10; i++) {
      const response = await verifierClient.get('/v1/connections').query({ outOfBandId: verifierToHolderOobRecordId })
      if (response.body.length > 0) {
        verifierToHolderConnectionRecordId = response.body[0].id
        connected = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(connected).to.equal(true)
  })

  // --- 4. W3C Proof Verification (Presentation Exchange) ---

  it.skip('should let Verifier request W3C proof (Presentation Exchange)', async function () {
    const requestProofPayload = {
      connectionId: verifierToHolderConnectionRecordId,
      protocolVersion: 'v2',
      proofFormats: {
        presentationExchange: {
          presentationDefinition: {
            id: '32f54163-7166-48f1-93d8-ff217bdb0653',
            name: 'University Degree Request',
            purpose: 'We need to verify your university degree',
            input_descriptors: [
              {
                id: 'degree_credential',
                name: 'Degree Credential',
                constraints: {
                  fields: [
                    {
                      path: ['$.type'],
                      filter: {
                        type: 'string',
                        pattern: 'UniversityDegreeCredential',
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
  })

  it.skip('should allow Holder to receive proof request', async function () {
    let received = false
    for (let i = 0; i < 10; i++) {
      const response = await holderClient.get('/v1/proofs').query({ connectionId: holderToVerifierConnectionRecordId })

      const record = response.body.find((r: { state: string; id: UUID }) => r.state === 'request-received')
      if (record) {
        holderProofRequestId = record.id
        received = true
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    expect(received).to.equal(true)
  })

  it.skip('should allow Holder to accept proof request', async function () {
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

  it.skip('should complete W3C verification (Verifier verified)', async function () {
    let success = false
    for (let i = 0; i < 30; i++) {
      const response = await verifierClient.get(`/v1/proofs/${verifierProofRecordId}`)
      if (response.body.state === 'done') {
        success = true
        break
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    expect(success).to.equal(true)
  })
})
