import { expect } from 'chai'
import express from 'express'
import { describe, test } from 'mocha'

import { createOpenId4VcModuleOptions, type OpenId4VcConfig } from '../../src/openid4vc/config.js'

const defaultConfig: OpenId4VcConfig = {
  issuerEnabled: false,
  verifierEnabled: false,
  publicBaseUrl: '',
  issuerId: '',
  verifierId: '',
}

describe('OpenID4VC configuration', () => {
  test('creates holder-only module options without requiring an Express application', () => {
    expect(createOpenId4VcModuleOptions(defaultConfig)).to.deep.equal({})
  })

  test('requires an Express application when the issuer or verifier role is enabled', () => {
    expect(() =>
      createOpenId4VcModuleOptions({
        ...defaultConfig,
        issuerEnabled: true,
        publicBaseUrl: 'https://issuer.example',
        issuerId: 'issuer',
      })
    ).to.throw('An Express application is required')
  })

  test('requires an issuer ID when the issuer role is enabled', () => {
    expect(() =>
      createOpenId4VcModuleOptions(
        {
          ...defaultConfig,
          issuerEnabled: true,
        },
        express()
      )
    ).to.throw('OPENID4VC_ISSUER_ID is required')
  })

  test('requires a verifier ID when the verifier role is enabled', () => {
    expect(() =>
      createOpenId4VcModuleOptions(
        {
          ...defaultConfig,
          verifierEnabled: true,
        },
        express()
      )
    ).to.throw('OPENID4VC_VERIFIER_ID is required')
  })

  test('passes the configured public URL through when constructing role options', () => {
    const config: OpenId4VcConfig = {
      issuerEnabled: true,
      verifierEnabled: true,
      publicBaseUrl: 'https://issuer.example/prefix',
      issuerId: 'issuer',
      verifierId: 'verifier',
    }

    const options = createOpenId4VcModuleOptions(config, express())

    expect(options.issuer?.baseUrl).to.equal('https://issuer.example/prefix/oid4vci')
    expect(options.verifier?.baseUrl).to.equal('https://issuer.example/prefix/oid4vp')
  })
})
