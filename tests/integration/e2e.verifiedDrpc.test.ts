import { expect } from 'chai'
import { describe, it } from 'mocha'
import request from 'supertest'

import type { UUID } from '../../src/controllers/types/index.js'
import { ALICE_BASE_URL, BOB_BASE_URL, OOB_INVITATION_PAYLOAD } from './utils/fixtures.js'
import {
  acceptCredential,
  acceptPresentation,
  sleep,
  waitForConnectionByOob,
  waitForConnectionState,
  waitForCredentialRecord,
  waitForCredentialState,
  waitForProofRecordByThread,
  waitForProofState,
} from './utils/helpers.js'

describe('Verified DRPC request', function () {
  this.timeout(180000)
  const alice = request(ALICE_BASE_URL)
  const bob = request(BOB_BASE_URL)

  const createConnection = async () => {
    const invitation = await alice.post('/v1/oob/create-invitation').send(OOB_INVITATION_PAYLOAD).expect(200)
    const bobConnectionId = (
      await bob
        .post('/v1/oob/receive-invitation-url')
        .send({ invitationUrl: invitation.body.invitationUrl, label: 'Bob (Verified DRPC)' })
        .expect(200)
    ).body.connectionRecord.id as UUID
    const aliceConnectionId = await waitForConnectionByOob(alice, invitation.body.outOfBandRecord.id)
    await waitForConnectionState(alice, aliceConnectionId, 'completed')
    await waitForConnectionState(bob, bobConnectionId, 'completed')
    return { aliceConnectionId, bobConnectionId }
  }

  const waitForProofRequest = async (client: typeof alice, connectionId: UUID) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = await client.get('/v1/proofs').expect(200)
      const proof = (response.body as { id: UUID; threadId: UUID; connectionId: UUID; state: string }[]).find(
        (record) => record.connectionId === connectionId && record.state === 'request-received'
      )
      if (proof) return proof
      await sleep(100)
    }
    throw new Error(`Timed out waiting for a proof request on connection ${connectionId}`)
  }

  it('holds the request and response until their respective proofs complete', async function () {
    const { aliceConnectionId, bobConnectionId } = await createConnection()
    const issueCredential = async (
      issuer: typeof alice,
      holder: typeof bob,
      issuerConnectionId: UUID,
      holderConnectionId: UUID,
      name: string,
      holderAutoAccepts: boolean
    ) => {
      const issuerId = (
        await issuer
          .post('/v1/dids/create')
          .send({ method: 'key', options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } } })
          .expect(200)
      ).body.did as string
      const schemaId = (
        await issuer
          .post('/v1/schemas')
          .send({ issuerId, name, version: '1.0', attrNames: ['companiesHouseNumber'] })
          .expect(200)
      ).body.id as string
      const credentialDefinitionId = (
        await issuer.post('/v1/credential-definitions').send({ issuerId, schemaId, tag: name }).expect(200)
      ).body.id as string
      const offer = await issuer
        .post('/v1/credentials/offer-credential')
        .send({
          connectionId: issuerConnectionId,
          protocolVersion: 'v2',
          autoAcceptCredential: 'never',
          credentialFormats: {
            anoncreds: {
              credentialDefinitionId,
              attributes: [{ name: 'companiesHouseNumber', value: '12345678' }],
            },
          },
        })
        .expect(200)

      if (!holderAutoAccepts) {
        const holderRecord = await waitForCredentialRecord(holder, holderConnectionId, 'offer-received')
        await holder
          .post(`/v1/credentials/${holderRecord.id}/accept-offer`)
          .send({ autoAcceptCredential: 'never' })
          .expect(200)
      } else {
        await waitForCredentialRecord(holder, holderConnectionId, 'request-sent')
      }
      const issuerRecord = await waitForCredentialRecord(issuer, issuerConnectionId, 'request-received')
      await issuer.post(`/v1/credentials/${issuerRecord.id}/accept-request`).send({}).expect(200)
      if (!holderAutoAccepts) {
        const holderRecord = await waitForCredentialRecord(holder, holderConnectionId, 'credential-received')
        await acceptCredential(holder, holderRecord.id)
      }
      await waitForCredentialState(issuer, offer.body.id, 'done')
      await waitForCredentialRecord(holder, holderConnectionId, 'done')
    }

    await issueCredential(alice, bob, aliceConnectionId, bobConnectionId, `verifiedDrpcAlice${Date.now()}`, false)
    await issueCredential(bob, alice, bobConnectionId, aliceConnectionId, `verifiedDrpcBob${Date.now()}`, true)

    const completeProof = async (verifier: typeof alice, prover: typeof bob, proof: { id: UUID; threadId: UUID }) => {
      await prover.post(`/v1/proofs/${proof.id}/accept-request`).send({}).expect(200)
      const verifierProof = await waitForProofRecordByThread(verifier, proof.threadId, 'presentation-received', {
        maxAttempts: 50,
        intervalMs: 100,
      })
      await acceptPresentation(verifier, verifierProof.id)
      await waitForProofState(verifier, verifierProof.id, 'done', { maxAttempts: 50, intervalMs: 100 })
    }
    const drpcRequest = { jsonrpc: '2.0', method: 'hello', id: 1 }
    let responseReceived = false
    const responsePromise = alice
      .post(`/v1/verified-drpc/request/${aliceConnectionId}`)
      .query({ timeout: 90000 })
      .send({ drpcRequest })
      .then((response) => {
        responseReceived = true
        return response
      })

    const serverProof = await waitForProofRequest(bob, bobConnectionId)
    await sleep(200)
    const aliceProofs = await alice.get('/v1/proofs').expect(200)
    expect(
      (aliceProofs.body as { connectionId: UUID; state: string }[]).filter(
        (proof) => proof.connectionId === aliceConnectionId && proof.state === 'request-received'
      )
    ).to.have.length(0)
    expect(responseReceived).to.equal(false)

    await completeProof(alice, bob, serverProof)
    const clientProof = await waitForProofRequest(alice, aliceConnectionId)
    expect(responseReceived).to.equal(false)
    await completeProof(bob, alice, clientProof)

    const response = await responsePromise
    expect(response.status).to.equal(200, JSON.stringify(response.body))
    expect(response.body).to.include({ jsonrpc: '2.0' })
    expect(response.body.result).to.deep.equal({ a: 123, b: 456 })
    expect(response.body.id).to.be.a('string')
  })

  it('does not send a request when the server proof times out', async function () {
    const { aliceConnectionId, bobConnectionId } = await createConnection()
    const responsePromise = alice
      .post(`/v1/verified-drpc/request/${aliceConnectionId}`)
      .send({ drpcRequest: { jsonrpc: '2.0', method: 'hello', id: 2 } })
      .then((response) => response)

    await waitForProofRequest(bob, bobConnectionId)
    const response = await responsePromise
    expect(response.status).to.equal(500, JSON.stringify(response.body))
    expect(response.body.message).to.include('invalid state abandoned')

    await sleep(200)
    const aliceProofs = await alice.get('/v1/proofs').expect(200)
    expect(
      (aliceProofs.body as { connectionId: UUID; state: string }[]).filter(
        (proof) => proof.connectionId === aliceConnectionId && proof.state === 'request-received'
      )
    ).to.have.length(0)
  })
})
