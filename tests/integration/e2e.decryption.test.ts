import { Agent, Buffer, Key, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { after, before, describe, it } from 'mocha'
import request from 'supertest'
import { getTestAgent } from '../unit/utils/helpers.js'

const ALICE_BASE_URL = process.env.ALICE_BASE_URL ?? 'http://localhost:3000'

describe('Encrypt and decrypt - ECDH-ES', function () {
  let agent: Agent
  let publicEncryptionKeyBuffer: Buffer
  let jwe: string
  const alice = request(ALICE_BASE_URL)
  const plainText = 'plaintext'

  before(async function () {
    agent = await getTestAgent('DID REST Agent Test Alice', 3999)
  })

  after(async function () {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('should create DID with X25519 key', async function () {
    const createDid = {
      method: 'key',
      options: {
        keyType: KeyType.X25519,
      },
    }

    const response = await alice.post('/v1/dids/create').send(createDid).expect('Content-Type', /json/).expect(200)

    publicEncryptionKeyBuffer = TypedArrayEncoder.fromBase58(response.body.didDocument.keyAgreement[0].publicKeyBase58)
  })

  it('should create ciphertext with ECDH-ES using local agent', async function () {
    const recipientKey = new Key(publicEncryptionKeyBuffer, KeyType.X25519)

    // Use the local agent wallet to encrypt (for testing purposes)
    if (!agent.context.wallet.directEncryptCompactJweEcdhEs) {
      throw Error('Wallet not configured for ECDH-ES')
    }
    jwe = await agent.context.wallet.directEncryptCompactJweEcdhEs({
      recipientKey,
      encryptionAlgorithm: 'A256GCM',
      data: TypedArrayEncoder.fromString(plainText),
      header: {},
    })
  })

  it('should 200 - decrypt JWE back to plaintext via /wallet/decrypt endpoint', async function () {
    const decryptPayload = {
      jwe,
      recipientPublicKey: TypedArrayEncoder.toBase64(publicEncryptionKeyBuffer),
      enc: 'A256GCM',
      alg: 'ECDH-ES',
    }

    const response = await alice
      .post('/v1/wallet/decrypt')
      .send(decryptPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(response.body).to.equal(plainText)
  })

  it('should 500 - unknown public key', async function () {
    const unknownKeyDecryptPayload = {
      jwe,
      recipientPublicKey: TypedArrayEncoder.toBase64(new Uint8Array(32).fill(99)),
      enc: 'A256GCM',
      alg: 'ECDH-ES',
    }

    const response = await alice.post('/v1/wallet/decrypt').send(unknownKeyDecryptPayload).expect(500)
    expect(response.body).to.equal('Key entry not found')
  })
})
