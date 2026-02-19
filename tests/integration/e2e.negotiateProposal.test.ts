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
  waitForConnectionState,
  waitForCredentialRecord,
  waitForCredentialState,
  waitForProofRecordByThread,
  waitForProofState,
} from './utils/helpers.js'

describe('Negotiate proof proposal flows', function () {
  this.timeout(60000)
  const issuerClient = request(ALICE_BASE_URL)
  const holderClient = request(BOB_BASE_URL)
  const verifierClient = request(CHARLIE_BASE_URL)

  beforeEach(function (done) {
    setTimeout(function () {
      done()
    }, 200)
  })

  it('should negotiate an AnonCreds proof proposal', async function () {
    const issuerId = ISSUER_DID_KEY

    const schemaResponse = await issuerClient
      .post('/v1/schemas')
      .send({
        issuerId,
        version: '1.0',
        name: 'negotiateProposalSchema',
        attrNames: ['checkName', 'companyName'],
      })
      .expect(200)

    const schemaId = schemaResponse.body.id as SchemaId

    const credDefResponse = await issuerClient
      .post('/v1/credential-definitions')
      .send({
        tag: 'negotiateProposalCredDef',
        schemaId,
        issuerId,
      })
      .expect(200)

    const credentialDefinitionId = credDefResponse.body.id as CredentialDefinitionId

    // Establish connection: Issuer -> Holder
    const issuerInvitationResponse = await issuerClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect(200)
    const issuerOobId = issuerInvitationResponse.body.outOfBandRecord.id
    const issuerInvitationUrl = issuerInvitationResponse.body.invitationUrl

    const holderAcceptResponse = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: issuerInvitationUrl })
      .expect(200)
    const holderToIssuerConnectionRecordId = holderAcceptResponse.body.connectionRecord.id

    const issuerToHolderConnectionRecordId = await waitForConnectionByOob(issuerClient, issuerOobId)
    await waitForConnectionState(issuerClient, issuerToHolderConnectionRecordId, 'completed')
    await waitForConnectionState(holderClient, holderToIssuerConnectionRecordId, 'completed')

    // 1. ORIGINAL CREDENTIAL: The Issuer offers a credential with two attributes: 'checkName' and 'companyName'.
    const offerResponse = await issuerClient
      .post('/v1/credentials/offer-credential')
      .send({
        protocolVersion: 'v2',
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId,
            attributes: [
              { name: 'checkName', value: 'someName' },
              { name: 'companyName', value: 'someCompanyName' },
            ],
          },
        },
        connectionId: issuerToHolderConnectionRecordId,
        autoAcceptCredential: 'never',
      })
      .expect(200)

    const issuerCredentialRecordId = offerResponse.body.id as UUID

    const holderCredentialRecord = await waitForCredentialRecord(
      holderClient,
      holderToIssuerConnectionRecordId,
      'offer-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )
    const holderCredentialRecordId = holderCredentialRecord.id

    await holderClient
      .post(`/v1/credentials/${holderCredentialRecordId}/accept-offer`)
      .send({ autoAcceptCredential: 'never' })
      .expect(200)

    await waitForCredentialState(issuerClient, issuerCredentialRecordId, 'request-received', {
      maxAttempts: 60,
      intervalMs: 1000,
    })
    await issuerClient.post(`/v1/credentials/${issuerCredentialRecordId}/accept-request`).send({}).expect(200)

    await waitForCredentialState(holderClient, holderCredentialRecordId, 'credential-received', {
      maxAttempts: 60,
      intervalMs: 1000,
    })

    await acceptCredential(holderClient, holderCredentialRecordId)
    await waitForCredentialState(holderClient, holderCredentialRecordId, 'done', { maxAttempts: 60, intervalMs: 1000 })
    await waitForCredentialState(issuerClient, issuerCredentialRecordId, 'done', { maxAttempts: 60, intervalMs: 1000 })

    // Establish connection: Verifier -> Holder
    const verifierInvitationResponse = await verifierClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect(200)
    const verifierOobId = verifierInvitationResponse.body.outOfBandRecord.id
    const verifierInvitationUrl = verifierInvitationResponse.body.invitationUrl

    const holderAcceptVerifierResponse = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: verifierInvitationUrl })
      .expect(200)
    const holderToVerifierConnectionRecordId = holderAcceptVerifierResponse.body.connectionRecord.id

    const verifierToHolderConnectionRecordId = await waitForConnectionByOob(verifierClient, verifierOobId)
    await waitForConnectionState(verifierClient, verifierToHolderConnectionRecordId, 'completed')
    await waitForConnectionState(holderClient, holderToVerifierConnectionRecordId, 'completed')

    // 2. PROOF PROPOSAL: The Holder proposes to prove only the 'checkName' attribute.
    const proposalResponse = await holderClient
      .post('/v1/proofs/propose-proof')
      .send({
        connectionId: holderToVerifierConnectionRecordId,
        protocolVersion: 'v2',
        proofFormats: {
          anoncreds: {
            attributes: [
              {
                name: 'checkName',
                credentialDefinitionId,
              },
            ],
          },
        },
        comment: 'proof proposal',
      })
      .expect(200)

    const holderProposalThreadId = proposalResponse.body.threadId as UUID

    const verifierProofRecord = await waitForProofRecordByThread(
      verifierClient,
      holderProposalThreadId,
      'proposal-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )
    const verifierProofRecordId = verifierProofRecord.id

    // 3. NEGOTIATION: The Verifier accepts the proposal but negotiates to ALSO request the 'companyName' attribute,
    // which was present in the original credential but not included in the Holder's proposal.
    const negotiateResponse = await verifierClient.post(`/v1/proofs/${verifierProofRecordId}/negotiate-proposal`).send({
      proofFormats: {
        anoncreds: {
          name: 'proof-request',
          version: '1.0',
          requested_attributes: {
            req_checkName: {
              names: ['checkName'],
              restrictions: [
                {
                  cred_def_id: credentialDefinitionId,
                },
              ],
            },
            req_companyName: {
              names: ['companyName'],
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
    })

    expect(negotiateResponse.status).to.equal(200)

    expect(negotiateResponse.body).to.have.property('state', 'request-sent')

    const holderProofRecord = await waitForProofRecordByThread(
      holderClient,
      holderProposalThreadId,
      'request-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )

    const credentialsRes = await holderClient
      .get(`/v1/proofs/${holderProofRecord.id}/credentials`)
      .expect('Content-Type', /json/)
      .expect(200)

    const credentialIdCheck = credentialsRes.body.proofFormats?.anoncreds?.attributes?.req_checkName?.[0]?.credentialId
    const credentialIdCompany =
      credentialsRes.body.proofFormats?.anoncreds?.attributes?.req_companyName?.[0]?.credentialId

    if (!credentialIdCheck || !credentialIdCompany) {
      throw new Error('No AnonCreds credential available for proof request')
    }

    // 4. RESPONSE TO NEGOTIATION: The Holder accepts the new presentation definition which now requires both 'checkName' and 'companyName'.
    await holderClient
      .post(`/v1/proofs/${holderProofRecord.id}/accept-request`)
      .send({
        proofFormats: {
          anoncreds: {
            attributes: {
              req_checkName: {
                credentialId: credentialIdCheck,
                revealed: true,
              },
              req_companyName: {
                credentialId: credentialIdCompany,
                revealed: true,
              },
            },
          },
        },
      })
      .expect(200)

    await waitForProofState(verifierClient, verifierProofRecordId, 'presentation-received', {
      maxAttempts: 60,
      intervalMs: 1000,
    })
    await acceptPresentation(verifierClient, verifierProofRecordId)
    await waitForProofState(verifierClient, verifierProofRecordId, 'done', { maxAttempts: 60, intervalMs: 1000 })
  })

  it('should negotiate a Presentation Exchange proof proposal', async function () {
    const issuerResponse = await issuerClient.post('/v1/dids/create').send({
      method: 'key',
      options: {
        keyType: 'ed25519',
      },
    })
    const issuerDid = issuerResponse.body.did as string

    const holderResponse = await holderClient.post('/v1/dids/create').send({
      method: 'key',
      options: {
        keyType: 'ed25519',
      },
    })
    const holderDid = holderResponse.body.did as string

    // Establish connection: Issuer -> Holder
    const issuerInvitationResponse = await issuerClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect(200)
    const issuerOobId = issuerInvitationResponse.body.outOfBandRecord.id
    const issuerInvitationUrl = issuerInvitationResponse.body.invitationUrl

    const holderAcceptResponse = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: issuerInvitationUrl })
      .expect(200)
    const holderToIssuerConnectionRecordId = holderAcceptResponse.body.connectionRecord.id

    // 1. ORIGINAL CREDENTIAL: The Issuer offers a JSON-LD credential with 'givenName' (Alice) and 'familyName' (Doe).
    const issuerToHolderConnectionRecordId = await waitForConnectionByOob(issuerClient, issuerOobId)
    await waitForConnectionState(issuerClient, issuerToHolderConnectionRecordId, 'completed')
    await waitForConnectionState(holderClient, holderToIssuerConnectionRecordId, 'completed')

    await issuerClient
      .post('/v1/credentials/offer-credential')
      .send({
        protocolVersion: 'v2',
        connectionId: issuerToHolderConnectionRecordId,
        credentialFormats: {
          jsonld: {
            credential: {
              '@context': ['https://www.w3.org/2018/credentials/v1', 'http://schema.org/'],
              type: ['VerifiableCredential', 'Person'],
              issuer: issuerDid,
              issuanceDate: new Date().toISOString(),
              credentialSubject: {
                id: holderDid,
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
        autoAcceptCredential: 'never',
      })
      .expect(200)

    const holderCredentialRecord = await waitForCredentialRecord(
      holderClient,
      holderToIssuerConnectionRecordId,
      'offer-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )
    const holderCredentialRecordId = holderCredentialRecord.id

    await holderClient
      .post(`/v1/credentials/${holderCredentialRecordId}/accept-offer`)
      .send({
        credentialFormats: {
          jsonld: {},
        },
        autoAcceptCredential: 'never',
      })
      .expect(200)

    const issuerCredRecPex = await waitForCredentialRecord(
      issuerClient,
      issuerToHolderConnectionRecordId,
      'request-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )
    await issuerClient.post(`/v1/credentials/${issuerCredRecPex.id}/accept-request`).send({}).expect(200)

    await waitForCredentialState(holderClient, holderCredentialRecordId, 'credential-received', {
      maxAttempts: 60,
      intervalMs: 1000,
    })
    await acceptCredential(holderClient, holderCredentialRecordId)
    await waitForCredentialState(holderClient, holderCredentialRecordId, 'done', { maxAttempts: 60, intervalMs: 1000 })

    // Establish connection: Verifier -> Holder
    const verifierInvitationResponse = await verifierClient
      .post('/v1/oob/create-invitation')
      .send(OOB_INVITATION_PAYLOAD)
      .expect(200)
    const verifierOobId = verifierInvitationResponse.body.outOfBandRecord.id
    const verifierInvitationUrl = verifierInvitationResponse.body.invitationUrl

    const holderAcceptVerifierResponse = await holderClient
      .post('/v1/oob/receive-invitation-url')
      .send({ invitationUrl: verifierInvitationUrl })
      .expect(200)
    const holderToVerifierConnectionRecordId = holderAcceptVerifierResponse.body.connectionRecord.id
    const verifierToHolderConnectionRecordId = await waitForConnectionByOob(verifierClient, verifierOobId)
    await waitForConnectionState(verifierClient, verifierToHolderConnectionRecordId, 'completed')
    await waitForConnectionState(holderClient, holderToVerifierConnectionRecordId, 'completed')

    // 2. PROOF PROPOSAL: The Holder proposes a presentation definition asking only for 'givenName'.
    const proposalResponse = await holderClient
      .post('/v1/proofs/propose-proof')
      .send({
        connectionId: holderToVerifierConnectionRecordId,
        protocolVersion: 'v2',
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'negotiation-pex-definition',
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
        comment: 'pex proof proposal',
      })
      .expect(200)

    const holderProposalThreadId = proposalResponse.body.threadId as UUID

    const verifierProofRecord = await waitForProofRecordByThread(
      verifierClient,
      holderProposalThreadId,
      'proposal-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )
    const verifierProofRecordId = verifierProofRecord.id

    // 3. NEGOTIATION: The Verifier negotiates to include a second input descriptor for 'familyName'.
    await verifierClient
      .post(`/v1/proofs/${verifierProofRecordId}/negotiate-proposal`)
      .send({
        proofFormats: {
          presentationExchange: {
            presentationDefinition: {
              id: 'negotiation-pex-definition',
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
                {
                  id: 'person_credential_family_name',
                  name: 'Person Credential Family Name',
                  constraints: {
                    fields: [
                      {
                        path: ['$.credentialSubject.familyName'],
                        filter: {
                          type: 'string',
                          pattern: 'Doe',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
        willConfirm: true,
        autoAcceptProof: 'never',
      })
      .expect(200)

    const holderProofRecord = await waitForProofRecordByThread(
      holderClient,
      holderProposalThreadId,
      'request-received',
      { maxAttempts: 60, intervalMs: 1000 }
    )

    // 4. RESPONSE TO NEGOTIATION: The Holder accepts the new presentation definition which now requires both 'givenName' and 'familyName'.
    await holderClient
      .post(`/v1/proofs/${holderProofRecord.id}/accept-request`)
      .send({
        proofFormats: {
          presentationExchange: {},
        },
      })
      .expect(200)

    await waitForProofState(verifierClient, verifierProofRecordId, 'presentation-received', {
      maxAttempts: 60,
      intervalMs: 1000,
    })
    await acceptPresentation(verifierClient, verifierProofRecordId)
    await waitForProofState(verifierClient, verifierProofRecordId, 'done', { maxAttempts: 60, intervalMs: 1000 })
  })
})
