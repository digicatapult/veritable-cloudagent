import { describe, it } from 'mocha'
import { expect } from 'chai'

import { withHappyIpfs, withIpfsErrors, exampleCid, exampleContent } from './fixtures/ipfs'
import { withMockedAgentContext } from './fixtures/agentContext'
import VeritableAnonCredsRegistry from '..'
import { RegisterRevocationRegistryDefinitionOptions } from '@aries-framework/anoncreds/build/services/registry'

describe('VeritableAnonCredsRegistry', function () {
  describe('methodName', function () {
    const ipfs = withHappyIpfs()
    const registry = new VeritableAnonCredsRegistry(ipfs)

    it('should export the correct methodName', function () {
      expect(registry.methodName).to.equal('veritable')
    })
  })

  describe('supportedIdentifier', function () {
    const ipfs = withHappyIpfs()
    const registry = new VeritableAnonCredsRegistry(ipfs)

    const cases: [string, string, boolean][] = [
      ['cid v0', 'ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR', true],
      ['cid v1', 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', true],
      ['wrong proto', 'http://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR', false],
      ['not uri', 'ipfs:QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR', false],
      ['no proto', 'QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR', false],
      ['chars before', 'something ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR', false],
      ['chars after', 'ipfs://QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR something', false],
      ['invalid chars', 'ipfs://!?/', false],
    ]

    for (const [desc, id, expectation] of cases) {
      it(`should ${expectation ? '' : 'not '}match (${desc})`, function () {
        const result = !!id.match(registry.supportedIdentifier)
        expect(result).equal(expectation)
      })
    }
  })

  describe('getSchema', function () {
    it('should return the schema as fetched from IPFS', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const schemaId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getSchema(agentContext, schemaId)
      expect(result).to.deep.equal({
        schema: exampleContent,
        schemaId,
        resolutionMetadata: {},
        schemaMetadata: {},
      })
    })

    it('should return invalid error if schemaId is not a valid identifier', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const schemaId = `invalid`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getSchema(agentContext, schemaId)

      expect(result).to.deep.equal({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: `id provided is invalid`,
        },
        schemaMetadata: {},
      })
    })

    it('should return notFound error if fetch to ipfs fails', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withIpfsErrors()
      const schemaId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getSchema(agentContext, schemaId)

      expect(result).to.deep.equal({
        schemaId,
        resolutionMetadata: {
          error: 'notFound',
          message: `ipfs fetch error`,
        },
        schemaMetadata: {},
      })
    })

    it('should return invalid error if fetch to ipfs returns invalid JSON', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs(Buffer.from('invalid', 'utf8'))
      const schemaId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getSchema(agentContext, schemaId)

      expect(result).to.deep.equal({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: `contents could not be parsed`,
        },
        schemaMetadata: {},
      })
    })
  })

  describe('registerSchema', function () {
    const exampleRegisterSchemaOptions = {
      schema: {
        attrNames: [],
        issuerId: 'issuer',
        name: 'name',
        version: '1',
      },
      options: {},
    }

    it('should upload the schema to IPFS and return the cid', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerSchema(agentContext, exampleRegisterSchemaOptions)
      expect(result).to.deep.equal({
        schemaState: {
          state: 'finished',
          schema: exampleRegisterSchemaOptions.schema,
          schemaId: `ipfs://${exampleCid}`,
        },
        registrationMetadata: {},
        schemaMetadata: {},
      })
      expect(ipfs.uploadFile.callCount).to.equal(1)
      expect(ipfs.uploadFile.firstCall.args).to.deep.equal([
        Buffer.from(JSON.stringify(exampleRegisterSchemaOptions.schema), 'utf8'),
      ])
    })

    it('should return an unknown error on ipfs error', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withIpfsErrors()
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerSchema(agentContext, exampleRegisterSchemaOptions)
      expect(result).to.deep.equal({
        schemaMetadata: {},
        registrationMetadata: {},
        schemaState: {
          state: 'failed',
          schema: exampleRegisterSchemaOptions.schema,
          reason: `unknownError`,
        },
      })
    })
  })

  describe('getCredentialDefinition', function () {
    it('should return the credentialDefinition as fetched from IPFS', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const credentialDefinitionId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getCredentialDefinition(agentContext, credentialDefinitionId)
      expect(result).to.deep.equal({
        credentialDefinition: exampleContent,
        credentialDefinitionId,
        resolutionMetadata: {},
        credentialDefinitionMetadata: {},
      })
    })

    it('should return invalid error if credentialDefinitionId is not a valid identifier', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const credentialDefinitionId = `invalid`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getCredentialDefinition(agentContext, credentialDefinitionId)

      expect(result).to.deep.equal({
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'invalid',
          message: `id provided is invalid`,
        },
        credentialDefinitionMetadata: {},
      })
    })

    it('should return notFound error if fetch to ipfs fails', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withIpfsErrors()
      const credentialDefinitionId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getCredentialDefinition(agentContext, credentialDefinitionId)

      expect(result).to.deep.equal({
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'notFound',
          message: `ipfs fetch error`,
        },
        credentialDefinitionMetadata: {},
      })
    })

    it('should return invalid error if fetch to ipfs returns invalid JSON', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs(Buffer.from('invalid', 'utf8'))
      const credentialDefinitionId = `ipfs://${exampleCid}`
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.getCredentialDefinition(agentContext, credentialDefinitionId)

      expect(result).to.deep.equal({
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'invalid',
          message: `contents could not be parsed`,
        },
        credentialDefinitionMetadata: {},
      })
    })
  })

  describe('registerCredentialDefinition', function () {
    const exampleRegisterOptions = {
      credentialDefinition: {
        issuerId: 'did:key:1234',
        schemaId: `ipfs://${exampleCid}`,
        type: 'CL' as const,
        tag: '1',
        value: {
          primary: {},
        },
      },
      options: {},
    }

    it('should upload the credential definition to IPFS and return the cid', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerCredentialDefinition(agentContext, exampleRegisterOptions)
      expect(result).to.deep.equal({
        credentialDefinitionState: {
          state: 'finished',
          credentialDefinition: exampleRegisterOptions.credentialDefinition,
          credentialDefinitionId: `ipfs://${exampleCid}`,
        },
        registrationMetadata: {},
        credentialDefinitionMetadata: {},
      })
      expect(ipfs.uploadFile.callCount).to.equal(1)
      expect(ipfs.uploadFile.firstCall.args).to.deep.equal([
        Buffer.from(JSON.stringify(exampleRegisterOptions.credentialDefinition), 'utf8'),
      ])
    })

    it('should return an unknown error on ipfs error', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withIpfsErrors(false, true)
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerCredentialDefinition(agentContext, exampleRegisterOptions)
      expect(result).to.deep.equal({
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: exampleRegisterOptions.credentialDefinition,
          reason: `unknownError`,
        },
      })
    })

    it('should return an invalid error if schema fetch fails', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withIpfsErrors(true, false)
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerCredentialDefinition(agentContext, exampleRegisterOptions)
      expect(result).to.deep.equal({
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          state: 'failed',
          credentialDefinition: exampleRegisterOptions.credentialDefinition,
          reason: `invalid`,
        },
      })
    })
  })

  // =====REVOCATION=========
  describe.only('registerRevocationRegistryDefinition', function () {
    const revocRegisterOptions: RegisterRevocationRegistryDefinitionOptions = {
      revocationRegistryDefinition: {
        issuerId: 'did:key:1234',
        revocDefType: 'CL_ACCUM',
        credDefId: `ipfs://${exampleCid}`,
        tag: '1',
        value: {
          publicKeys: {
            accumKey: {
              z: `some_key`,
            },
          },
          maxCredNum: 20,
          tailsLocation: `some/tails/location`,
          tailsHash: ``,
        },
      },
      options: {},
    }

    it.only('should upload the revocation registry definition to IPFS and return the positive response containing a cid', async function () {
      const agentContext = withMockedAgentContext()
      const ipfs = withHappyIpfs()
      const registry = new VeritableAnonCredsRegistry(ipfs)

      const result = await registry.registerRevocationRegistryDefinition(agentContext, revocRegisterOptions)
      console.log(result)
      expect(result).to.deep.equal({
        revocationRegistryDefinitionMetadata: {},
        revocationRegistryDefinitionState: {
          revocationRegistryDefinition: revocRegisterOptions.revocationRegistryDefinition,
          revocationRegistryDefinitionId: `ipfs://${exampleCid}`,
          state: 'finished',
        },
        registrationMetadata: {},
      })
      expect(ipfs.uploadFile.callCount).to.equal(1)
      expect(ipfs.uploadFile.firstCall.args).to.deep.equal([
        Buffer.from(JSON.stringify(revocRegisterOptions.revocationRegistryDefinition), 'utf8'),
      ])
    })
  })
})
