process.env.ENABLE_DID_WEB_GENERATION = 'true'
import { type Agent } from '@credo-ts/core'
import { expect } from 'chai'
import fs from 'fs'
import type { Server } from 'node:net'
import sinon from 'sinon'
import { container } from 'tsyringe'
import { Env } from '../../src/env.js'
import { DidWebDocGenerator } from '../../src/utils/didWebGenerator.js'
import PinoLogger from '../../src/utils/logger.js'
import { cleanupCreatedDids, getTestAgent, getTestServer } from './utils/helpers.js'

describe('didWebGenerator', function () {
  let app: Server
  let aliceAgent: Agent
  let env: Env
  let logger: PinoLogger

  before(async () => {
    sinon.stub(DidWebDocGenerator.prototype, 'importDidWeb').resolves()
    aliceAgent = await getTestAgent('DID REST Agent Test Alice', 3999)
    app = await getTestServer(aliceAgent)
    process.env.ENABLE_DID_WEB_GENERATION = 'false'
    env = container.resolve(Env)
    logger = new PinoLogger('silent')
  })
  beforeEach(async () => {
    await cleanupCreatedDids()
  })

  after(async () => {
    await cleanupCreatedDids()
    sinon.restore()
  })
  describe('happy path', function () {
    it('should make a new instance of DidWebDocGenerator', function () {
      const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
      expect(didWebDocGenerator).to.be.an.instanceof(DidWebDocGenerator)
    })
    it('should generate a did doc if it does not exist', async function () {
      const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
      const generatedDoc = await didWebDocGenerator.generateDidWebDocument()

      // Check that the DID doc file was created
      const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
      const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
      const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
      expect(fileExists).to.be.true
    })

    it('should not create 2nd document if one already exists ', async function () {
      const didWebDocGenerator = new DidWebDocGenerator(aliceAgent, env, logger)
      const generatedDoc = await didWebDocGenerator.generateDidWebDocument()

      // Check that the DID doc file was created
      const didFileName = generatedDoc.did.replace(/^did:web:/, '').replace(/[:/]/g, '_') + '.json'
      const didFilePath = `${process.cwd()}/public/dids/${didFileName}`
      const fileExists = !!(await fs.promises.stat(didFilePath).catch(() => false))
      expect(fileExists).to.be.true
      await didWebDocGenerator.generateDidWebDocument()
      // Check that only one file exists in public/dids
      const didsDir = `${process.cwd()}/public/dids`
      const files = await fs.promises.readdir(didsDir)
      expect(files.length).to.equal(1)
    })
  })
})
