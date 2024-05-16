import type { FeatureRegistry, DependencyManager, Module } from '@credo-ts/core'

import { Protocol, AgentConfig } from '@credo-ts/core'

import { VerifiedDrpcApi } from './VerifiedDrpcApi'
import { VerifiedDrpcRole } from './models/VerifiedDrpcRole'
import { VerifiedDrpcRepository } from './repository'
import { VerifiedDrpcService } from './services'

export class VerifiedDrpcModule implements Module {
  public readonly api = VerifiedDrpcApi

  /**
   * Registers the dependencies of the verified-drpc message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)

    // Services
    dependencyManager.registerSingleton(VerifiedDrpcService)

    // Repositories
    dependencyManager.registerSingleton(VerifiedDrpcRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/drpc/1.0',
        roles: [VerifiedDrpcRole.Client, VerifiedDrpcRole.Server],
      })
    )
  }
}
