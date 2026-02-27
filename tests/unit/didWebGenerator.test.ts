import { DidCommV1Service, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { Logger } from 'pino'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'

describe('didWebGenerator', function () {
  let aliceAgent: {
    context: {
      resolve: () => {
        createKey: (options: { type: { kty: 'OKP'; crv: 'Ed25519' | 'X25519' } }) => Promise<{
          keyId: string
          publicJwk: { x: string }
        }>
      }
    }
  }
  let logger: Logger
  const did = `did:web:localhost%3A5002`

  before(() => {
    const signingPublicKey = TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(11))
    const encryptionPublicKey = TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(22))

    let keyCallCount = 0
    aliceAgent = {
      context: {
        resolve: () => ({
          createKey: async () => {
            keyCallCount += 1
            if (keyCallCount === 1) {
              return {
                keyId: 'signing-key-id',
                publicJwk: {
                  x: signingPublicKey,
                },
              }
            }

            return {
              keyId: 'encryption-key-id',
              publicJwk: {
                x: encryptionPublicKey,
              },
            }
          },
        }),
      },
    }

    logger = new PinoLogger('silent').logger
  })

  it('should make a new instance of DidWebDocGenerator', function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent as never, logger)
    expect(didWebDocGenerator).to.be.an.instanceof(DidWebDocGenerator)
  })

  it('should generate a did doc', async function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent as never, logger)
    const generated = await didWebDocGenerator.generateDidWebDocument(did, 'http://localhost%3A5002')
    expect(generated.did).to.equal(did)
    expect(generated.didDocument.id).to.equal(did)

    // Verify signing key (verificationMethod[0])
    const signingKey = generated.didDocument.verificationMethod![0]
    expect(signingKey.id).to.equal(`${did}#owner`)
    expect(signingKey.type).to.equal('Ed25519VerificationKey2020')
    expect(signingKey.controller).to.equal(did)
    expect(signingKey.publicKeyMultibase).to.be.a('string')
    expect(signingKey.publicKeyMultibase!.length).to.be.greaterThan(0)
    expect(signingKey.publicKeyMultibase!.startsWith('z')).to.equal(true)

    // Verify encryption key (verificationMethod[1])
    const encryptionKey = generated.didDocument.verificationMethod![1]
    expect(encryptionKey.id).to.equal(`${did}#encryption`)
    expect(encryptionKey.type).to.equal('X25519KeyAgreementKey2019')
    expect(encryptionKey.controller).to.equal(did)
    expect(encryptionKey.publicKeyBase58).to.be.a('string')

    // Verify keyAgreement (reference to encryption key)
    const keyAgreement = generated.didDocument.keyAgreement![0]
    expect(keyAgreement).to.equal(`${did}#encryption`)

    // Verify service recipientKeys (reference to encryption key)
    const service = generated.didDocument.service![0]
    expect((service as DidCommV1Service).recipientKeys).to.deep.equal([`${did}#owner`])
  })
})
