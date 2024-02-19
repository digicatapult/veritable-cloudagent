import { describe, it } from 'mocha'
import { expect } from 'chai'

import PolicyAgent from '../index.js'
import { withGetPoliciesResponse, withGetPolicyResponse, withEvaluateResponse } from './fixtures/mock.js'

const exampleId = 'example.rego'
const examplePackageId = 'example'

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
      const policies = await policyAgent.getPolicies()
      expect(policies).to.be.an('array')
      expect(policies[0].id).to.equal(exampleId)
    })
  })

  describe('getPolicy', function () {
    const { origin } = withGetPolicyResponse(exampleId)

    it('should return a single policy', async function () {
      const policyAgent = new PolicyAgent(origin)
      const policy = await policyAgent.getPolicy(exampleId)
      expect(policy).to.be.an('object')
      expect(policy.id).to.equal(exampleId)
    })
  })

  describe('evaluate', function () {
    const { origin } = withEvaluateResponse(examplePackageId)

    it('should return allow true', async function () {
      const policyAgent = new PolicyAgent(origin)
      const result = await policyAgent.evaluate(examplePackageId, {})
      expect(result).to.deep.equal({ allow: true })
    })
  })
})
