import { describe, it } from 'mocha'
import { expect } from 'chai'
import PolicyAgent from '..'
import { withGetPoliciesResponse } from './fixtures/mock'

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
    const { origin } = withGetPoliciesResponse()

    it('should return all policies', async function () {
      const policyAgent = new PolicyAgent(origin)
      const { result } = await policyAgent.getPolicies()
      expect(result).to.be.an('array')
      expect(result[0]).to.include.all.keys('id', 'raw', 'ast')
      expect(result[0].id).to.equal('example.rego')
    })
  })
})
