import type { DependencyManager } from '../../../core/src/plugins/DependencyManager'

import { FeatureRegistry } from '../../../core/src/agent/FeatureRegistry'
import { VerifiedDrpcModule } from '../VerifiedDrpcModule'
import { VerifiedDrpcRepository } from '../repository'
import { VerifiedDrpcService } from '../services'

jest.mock('../../../core/src/plugins/DependencyManager')

jest.mock('../../../core/src/agent/FeatureRegistry')
const FeatureRegistryMock = FeatureRegistry as jest.Mock<FeatureRegistry>

const featureRegistry = new FeatureRegistryMock()

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('VerifiedDrpcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    new VerifiedDrpcModule().register(dependencyManager, featureRegistry)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(VerifiedDrpcService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(VerifiedDrpcRepository)
  })
})
