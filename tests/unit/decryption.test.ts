import { Agent, Buffer, Key, KeyType, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { after, afterEach, before, describe, it } from 'mocha'
import type { Server } from 'node:net'
import { restore as sinonRestore } from 'sinon'
import request from 'supertest'
import { getTestAgent, getTestServer } from './utils/helpers.js'

describe('Decryption', () => {
  let app: Server
  let agent: Agent
  let publicEncryptionKeyBuffer: Buffer
  let jwe: string
  // Payload to encrypt
  const file = Buffer.from('someFile')

  before(async function () {
    agent = await getTestAgent('DID REST Agent Test Alice Decryption', 4000)
    app = await getTestServer(agent)
  })

  afterEach(() => {
    sinonRestore()
  })

  after(async function () {
    await agent.shutdown()
    await agent.wallet.delete()
    app.close()
  })

  it('should create DID with X25519 key (real Agent)', async function () {
    const createDid = {
      method: 'key',
      options: {
        keyType: KeyType.X25519,
      },
    }

    // Call the API (which calls agent.dids.create)
    const response = await request(app)
      .post('/v1/dids/create')
      .send(createDid)
      .expect('Content-Type', /json/)
      .expect(200)

    // Extract the public key from the response
    publicEncryptionKeyBuffer = TypedArrayEncoder.fromBase58(response.body.didDocument.keyAgreement[0].publicKeyBase58)
  })

  it('should create ciphertext with ECDH-ES using local agent logic', async function () {
    const recipientKey = new Key(publicEncryptionKeyBuffer, KeyType.X25519)

    // Use the *same* agent's wallet to encrypt (acting as the sender)
    // This verifies the wallet functionality directly
    if (!agent.context.wallet.directEncryptCompactJweEcdhEs) {
      throw Error('Wallet not configured for ECDH-ES')
    }
    jwe = await agent.context.wallet.directEncryptCompactJweEcdhEs({
      recipientKey,
      encryptionAlgorithm: 'A256GCM',
      data: file,
      header: {},
    })
  })

  it('should 200 - decrypt JWE back to plaintext via /wallet/decrypt endpoint (real Agent)', async function () {
    const decryptPayload = {
      jwe,
      recipientPublicKey: TypedArrayEncoder.toBase64(publicEncryptionKeyBuffer),
      enc: 'A256GCM',
      alg: 'ECDH-ES',
    }

    // Call the API (which calls agent.wallet.decrypt)
    const response = await request(app)
      .post('/v1/wallet/decrypt')
      .send(decryptPayload)
      .expect('Content-Type', /json/)
      .expect(200)

    expect(Buffer.from(response.body, 'base64')).to.deep.equal(file)
  })

  it('should 500 - unknown public key', async function () {
    const unknownKeyDecryptPayload = {
      jwe,
      recipientPublicKey: TypedArrayEncoder.toBase64(new Uint8Array(32).fill(99)),
      enc: 'A256GCM',
      alg: 'ECDH-ES',
    }

    const response = await request(app).post('/v1/wallet/decrypt').send(unknownKeyDecryptPayload).expect(500)
    expect(response.body).to.equal('Key entry not found')
  })
})
