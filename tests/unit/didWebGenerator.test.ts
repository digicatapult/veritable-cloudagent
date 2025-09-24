import { type Agent } from '@credo-ts/core'
import { expect } from 'chai'
import fs from 'fs'
import sinon from 'sinon'
import { container } from 'tsyringe'
import { Env } from '../../src/env.js'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'
import { cleanupCreatedDids, getTestAgent, testEnv } from './utils/helpers.js'

const env = container.resolve(Env)

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
    testEnv()
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
    expect(didWebDocGenerator).to.be.an.instanceof(DidWebDocGenerator)
  })
  it('should generate a did doc if it does not exist', async function () {
    testEnv()
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
    const generatedDoc = await didWebDocGenerator.generateDidWebDocument()

    // Check that the DID doc file was created
    const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
    const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
    const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
    expect(fileExists).to.be.equal(true)
  })

  it('should not create 2nd document if one already exists ', async function () {
    testEnv()
    const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
    const generatedDoc = await didWebDocGenerator.generateDidWebDocument()

    // Check that the DID doc file was created
    const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
    const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
    const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
    expect(fileExists).to.be.equal(true)
    await didWebDocGenerator.generateDidWebDocument()
    // Check that only one file exists in public/dids
    const didsDir = `${process.cwd()}/public/dids`
    const files = await fs.promises.readdir(didsDir)
    expect(files.length).to.equal(1)
  })
})
