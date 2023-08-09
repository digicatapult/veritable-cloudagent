import { AgentContext, ConsoleLogger } from '@aries-framework/core'

import sinon from 'sinon'

export const withMockedAgentContext = () => {
  return {
    config: {
      logger: sinon.createStubInstance(ConsoleLogger),
    },
  } as unknown as AgentContext
}
