import { connect } from 'ngrok'

import { startServer } from '../src/index'
import { setupAgent } from '../src/utils/agent'

const run = async () => {
  const endpoint = await connect(3001)

  const agent = await setupAgent({
    port: 3001,
    endpoints: [endpoint],
    name: 'Aries Test Agent',
    logLevel: 'debug',
  })

  const conf = {
    port: 3000,
    cors: true,
  }

  await startServer(agent, conf)
}

run()
