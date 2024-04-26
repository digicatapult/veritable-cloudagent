import 'reflect-metadata'

import type { ServerConfig } from './utils/ServerConfig.js'
import type { Agent } from '@credo-ts/core'
import type { Socket } from 'net'

import WebSocket from 'ws'

import { setupServer } from './server.js'

export const startServer = async (agent: Agent, config: ServerConfig) => {
  const socketServer = config.socketServer ?? new WebSocket.Server({ noServer: true })
  const app = await setupServer(agent, { ...config, socketServer })
  const server = app.listen(config.port)

  // If no socket server is provided, we will use the existing http server
  // to also host the websocket server
  if (!config.socketServer) {
    server.on('upgrade', (request, socket, head) => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      socketServer.handleUpgrade(request, socket as Socket, head, () => {})
    })
  }

  return server
}
