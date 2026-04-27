import { type AgentContext, type DependencyManager, type Module } from '@credo-ts/core'
import { DidCommFeatureRegistry, type DidCommProofProtocol, DidCommProtocol } from '@credo-ts/didcomm'

import { VerifiedDrpcApi } from './VerifiedDrpcApi.js'
import { VerifiedDrpcModuleConfig, VerifiedDrpcModuleConfigOptions } from './VerifiedDrpcModuleConfig.js'
import { VerifiedDrpcRole } from './models/VerifiedDrpcRole.js'
import { VerifiedDrpcRepository } from './repository/index.js'
import { VerifiedDrpcService } from './services/index.js'

export class VerifiedDrpcModule<PPs extends DidCommProofProtocol[]> implements Module {
  public readonly api = VerifiedDrpcApi
  public readonly config: VerifiedDrpcModuleConfig<PPs>

  public constructor(config: VerifiedDrpcModuleConfigOptions<PPs>) {
    this.config = new VerifiedDrpcModuleConfig(config)
  }

  /**
   * Registers the dependencies of the verified-drpc message module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(VerifiedDrpcModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(VerifiedDrpcService)

    // Repositories
    dependencyManager.registerSingleton(VerifiedDrpcRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    // Features
    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/verified-drpc/1.0',
        roles: [VerifiedDrpcRole.Client, VerifiedDrpcRole.Server],
      })
    )
  }
}
