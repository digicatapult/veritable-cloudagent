import type {
  FeatureRegistry,
  DependencyManager,
  Module,
} from '@credo-ts/core'

import { Protocol, AgentConfig } from '@credo-ts/core'

import { VerifiedDrpcApi } from './VerifiedDrpcApi.js'
import { VerifiedDrpcRole } from './models/VerifiedDrpcRole.js'
import { VerifiedDrpcRepository } from './repository/index.js'
import { VerifiedDrpcService } from './services/index.js'

export class VerifiedDrpcModule implements Module {
  public readonly api = VerifiedDrpcApi

  /**
   * Registers the dependencies of the verified-drpc message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    dependencyManager.resolve(AgentConfig)

    // Services
    dependencyManager.registerSingleton(VerifiedDrpcService)

    // Repositories
    dependencyManager.registerSingleton(VerifiedDrpcRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/verified-drpc/1.0',
        roles: [VerifiedDrpcRole.Client, VerifiedDrpcRole.Server],
      })
    )
  }
}
