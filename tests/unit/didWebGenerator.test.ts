import { type Agent, DidCommV1Service } from '@credo-ts/core'
import { expect } from 'chai'
import { Logger } from 'pino'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'
import { getTestAgent } from './utils/helpers.js'

describe('didWebGenerator', function () {
  let aliceAgent: Agent
  let logger: Logger
  const did = `did:web:localhost%3A5002`

  before(async () => {
    aliceAgent = await getTestAgent('DID REST Agent Test Alice', 3999)
    logger = new PinoLogger('silent').logger
  })

  after(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  it('should make a new instance of DidWebDocGenerator', function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)
    expect(didWebDocGenerator).to.be.an.instanceof(DidWebDocGenerator)
  })

  it('should generate a did doc', async function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)
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
