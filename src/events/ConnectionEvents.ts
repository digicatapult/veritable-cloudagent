import {
  type Agent,
  type ConnectionDidRotatedEvent,
  type ConnectionStateChangedEvent,
  ConnectionEventTypes,
} from '@credo-ts/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const connectionEvents = async (agent: Agent, config: ServerConfig) => {
  const eventHandler = async (event: ConnectionStateChangedEvent | ConnectionDidRotatedEvent) => {
    const body = event.payload

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(`${webhookUrl}/connections`, body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          ...body,
        },
      })
    }
  }
  agent.events.on(ConnectionEventTypes.ConnectionStateChanged, eventHandler)
  agent.events.on(ConnectionEventTypes.ConnectionDidRotated, eventHandler)
}
