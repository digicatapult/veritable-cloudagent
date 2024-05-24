import { describe, it } from 'mocha'
import { expect } from 'chai'
import * as sinon from 'sinon'
import type { SinonStubbedInstance } from 'sinon'

import { DependencyManager, FeatureRegistry } from '@credo-ts/core'

import { withVerifiedDrpcModuleConfig } from './fixtures/verifiedDrpcModuleConfig.js'

import { VerifiedDrpcModule } from '../VerifiedDrpcModule.js'
import { VerifiedDrpcRepository } from '../repository/index.js'
import { VerifiedDrpcService } from '../services/index.js'


const mockFeatureRegistryMock: SinonStubbedInstance<FeatureRegistry> = sinon.createStubInstance(FeatureRegistry)
const mockDependencyManager: SinonStubbedInstance<DependencyManager> = sinon.createStubInstance(DependencyManager)

describe('VerifiedDrpcModule', () => {
  it('registers dependencies on the dependency manager', () => {
    new VerifiedDrpcModule(withVerifiedDrpcModuleConfig()).register(mockDependencyManager, mockFeatureRegistryMock)

    sinon.assert.calledTwice(mockDependencyManager.registerSingleton)
    sinon.assert.calledWith(mockDependencyManager.registerSingleton, VerifiedDrpcService)
    sinon.assert.calledWith(mockDependencyManager.registerSingleton, VerifiedDrpcRepository)
  })
})
