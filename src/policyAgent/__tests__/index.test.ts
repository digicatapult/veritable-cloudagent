import { describe, it } from 'mocha'
import { expect } from 'chai'
import PolicyAgent from '..'
import { withGetPoliciesResponse, withGetPolicyResponse } from './fixtures/mock'

const exampleId = 'example.rego'

describe('policy agent', function () {
  describe('ctor', function () {
    it('should construct a PolicyAgent if origin is valid', function () {
      const policyAgent = new PolicyAgent('https://example.com')
      expect(policyAgent).instanceOf(PolicyAgent)
    })

    it('should throw if origin is invalid', function () {
      let error: Error | null = null
      try {
        new PolicyAgent('wibble')
      } catch (err) {
        error = err as Error
      }

      if (error === null) {
        expect.fail('Expected an error')
      }
      expect(error).instanceOf(Error)
    })
  })

  describe('getPolicies', function () {
    const { origin } = withGetPoliciesResponse(exampleId)

    it('should return all policies', async function () {
      const policyAgent = new PolicyAgent(origin)
      const { result } = await policyAgent.getPolicies()
      expect(result).to.be.an('array')
      expect(result[0]).to.include.all.keys('id', 'raw', 'ast')
      expect(result[0].id).to.equal(exampleId)
    })
  })

  describe('getPolicy', function () {
    const { origin } = withGetPolicyResponse(exampleId)

    it('should return a single policy', async function () {
      const policyAgent = new PolicyAgent(origin)
      const { result } = await policyAgent.getPolicy(exampleId)
      expect(result).to.be.an('object')
      expect(result).to.include.all.keys('id', 'raw', 'ast')
      expect(result.id).to.equal(exampleId)
    })
  })
})
