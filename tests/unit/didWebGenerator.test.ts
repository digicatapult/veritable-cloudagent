import { type Agent } from '@credo-ts/core'
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
  })
})
