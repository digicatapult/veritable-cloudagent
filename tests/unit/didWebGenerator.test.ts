import { DidCommV1Service, TypedArrayEncoder } from '@credo-ts/core'
import { expect } from 'chai'
import { Logger } from 'pino'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'

describe('didWebGenerator', function () {
  let aliceAgent: {
    kms: {
      createKey: (options: { type: { kty: 'OKP'; crv: 'Ed25519' | 'X25519' } }) => Promise<{
        keyId: string
        publicJwk: { kty: 'OKP'; crv: 'Ed25519' | 'X25519'; x: string }
      }>
    }
  }
  let logger: Logger
  const did = `did:web:localhost%3A5002`

  before(() => {
    const authenticationPublicKey = TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(11))
    const assertionPublicKey = TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(33))
    const encryptionPublicKey = TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(22))

    let keyCallCount = 0
    aliceAgent = {
      kms: {
        createKey: async () => {
          keyCallCount += 1
          if (keyCallCount === 1) {
            return {
              keyId: 'auth-key-id',
              publicJwk: {
                kty: 'OKP',
                crv: 'Ed25519',
                x: authenticationPublicKey,
              },
            }
          }

          if (keyCallCount === 2) {
            return {
              keyId: 'assertion-key-id',
              publicJwk: {
                kty: 'OKP',
                crv: 'Ed25519',
                x: assertionPublicKey,
              },
            }
          }

          return {
            keyId: 'encryption-key-id',
            publicJwk: {
              kty: 'OKP',
              crv: 'X25519',
              x: encryptionPublicKey,
            },
          }
        },
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
    expect(generated.didDocument.capabilityInvocation).to.deep.equal([`${did}#auth-key`])

    const authKey = generated.didDocument.verificationMethod![0]
    expect(authKey.id).to.equal(`${did}#auth-key`)
    expect(authKey.type).to.equal('Ed25519VerificationKey2020')
    expect(authKey.controller).to.equal(did)
    expect(authKey.publicKeyMultibase).to.equal(
      `z${TypedArrayEncoder.toBase58(new Uint8Array([0xed, 0x01, ...new Uint8Array(32).fill(11)]))}`
    )

    const assertionKey = generated.didDocument.verificationMethod![1]
    expect(assertionKey.id).to.equal(`${did}#assertion-key`)
    expect(assertionKey.type).to.equal('Ed25519VerificationKey2020')
    expect(assertionKey.controller).to.equal(did)
    expect(assertionKey.publicKeyMultibase).to.equal(
      `z${TypedArrayEncoder.toBase58(new Uint8Array([0xed, 0x01, ...new Uint8Array(32).fill(33)]))}`
    )

    const agreementKey = generated.didDocument.verificationMethod![2]
    expect(agreementKey.id).to.equal(`${did}#agreement-key`)
    expect(agreementKey.type).to.equal('X25519KeyAgreementKey2019')
    expect(agreementKey.controller).to.equal(did)
    expect(agreementKey.publicKeyBase58).to.equal(
      TypedArrayEncoder.toBase58(
        TypedArrayEncoder.fromBase64(TypedArrayEncoder.toBase64URL(new Uint8Array(32).fill(22)))
      )
    )

    expect(generated.didDocument.authentication).to.deep.equal([`${did}#auth-key`])
    expect(generated.didDocument.assertionMethod).to.deep.equal([`${did}#assertion-key`])
    const keyAgreement = generated.didDocument.keyAgreement![0]
    expect(keyAgreement).to.equal(`${did}#agreement-key`)

    const service = generated.didDocument.service![0]
    expect((service as DidCommV1Service).recipientKeys).to.deep.equal([`${did}#auth-key`])

    expect(generated.keys).to.deep.equal([
      {
        didDocumentRelativeKeyId: '#auth-key',
        kmsKeyId: 'auth-key-id',
      },
      {
        didDocumentRelativeKeyId: '#assertion-key',
        kmsKeyId: 'assertion-key-id',
      },
      {
        didDocumentRelativeKeyId: '#agreement-key',
        kmsKeyId: 'encryption-key-id',
      },
    ])
  })
})
