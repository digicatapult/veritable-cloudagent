import { AgentContext, ConsoleLogger, DependencyManager } from '@credo-ts/core'
import type { SinonStubbedInstance } from 'sinon'

import sinon from 'sinon'

export const withMockedAgentContext = () => {
  return {
    config: {
      logger: sinon.createStubInstance(ConsoleLogger),
    },
    dependencyManager: sinon.createStubInstance(DependencyManager) as SinonStubbedInstance<DependencyManager>
  } as unknown as AgentContext
}
