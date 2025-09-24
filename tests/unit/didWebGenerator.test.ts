import { type Agent } from '@credo-ts/core'
import { expect } from 'chai'
import fs from 'fs'
import sinon from 'sinon'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'
import { cleanupCreatedDids, getTestAgent } from './utils/helpers.js'

describe('didWebGenerator', function () {
  let aliceAgent: Agent
  let logger: PinoLogger

  before(async () => {
    sinon.stub(DidWebDocGenerator.prototype, 'importDidWeb').resolves()
    aliceAgent = await getTestAgent('DID REST Agent Test Alice', 3999)
    logger = new PinoLogger('silent')
  })
  beforeEach(async () => {
    await cleanupCreatedDids()
  })

  after(async () => {
    await cleanupCreatedDids()
    sinon.restore()
  })
  it('should make a new instance of DidWebDocGenerator', function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)
    expect(didWebDocGenerator).to.be.an.instanceof(DidWebDocGenerator)
  })
  it('should generate a did doc if it does not exist', async function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)
    const generatedDoc = await didWebDocGenerator.generateDidWebDocument(
      'did:web:localhost:5002',
      'http://localhost%3A5002'
    )

    // Check that the DID doc file was created
    const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
    const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
    const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
    expect(fileExists).to.be.equal(true)
  })

  it('should not create 2nd document if one already exists ', async function () {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)
    const generatedDoc = await didWebDocGenerator.generateDidWebDocument(
      'did:web:localhost:5002',
      'http://localhost%3A5002'
    )

    // Check that the DID doc file was created
    const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
    const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
    const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
    expect(fileExists).to.be.equal(true)
    await didWebDocGenerator.generateDidWebDocument('did:web:localhost:5002', 'http://localhost%3A5002')
    // Check that only one file exists in public/dids
    const didsDir = `${process.cwd()}/public/dids`
    const files = await fs.promises.readdir(didsDir)
    expect(files.length).to.equal(1)
  })
  it('should throw if did is of wrong format', async () => {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)

    try {
      await didWebDocGenerator.generateAndRegisterIfNeeded('invalid-did', 'http://localhost%3A5002', true)
      throw new Error('Expected method to throw.')
    } catch (err) {
      expect(err).to.be.instanceOf(Error)
      expect(err).to.have.property('message', 'Invalid DID:web ID format: invalid-did')
    }
  })
  it('should throw if endpoint is of wrong format', async () => {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)

    try {
      await didWebDocGenerator.generateAndRegisterIfNeeded('did:web:localhost:5002', 'invalid-endpoint', true)
      throw new Error('Expected method to throw.')
    } catch (err) {
      expect(err).to.be.instanceOf(Error)
      expect(err).to.have.property('message', 'Invalid service endpoint format: invalid-endpoint')
    }
  })
  it('should throw if endpoint is of wrong format with a colon', async () => {
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, logger)

    try {
      await didWebDocGenerator.generateAndRegisterIfNeeded('did:web:localhost:5002', 'http://localhost:5002', true)
      throw new Error('Expected method to throw.')
    } catch (err) {
      expect(err).to.be.instanceOf(Error)
      expect(err).to.have.property('message', 'Invalid service endpoint format: http://localhost:5002')
    }
  })
})
