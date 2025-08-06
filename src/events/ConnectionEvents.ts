import {
  type Agent,
  type ConnectionStateChangedEvent,
  ConnectionDidRotatedEvent,
  ConnectionEventTypes,
} from '@credo-ts/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const connectionEvents = async (agent: Agent, config: ServerConfig) => {
  agent.events.on(ConnectionEventTypes.ConnectionStateChanged, async (event: ConnectionStateChangedEvent) => {
    const record = event.payload.connectionRecord
    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(webhookUrl + '/connections', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          ...event.payload,
          connectionRecord: body,
        },
      })
    }
  })

  agent.events.on(ConnectionEventTypes.ConnectionDidRotated, async (event: ConnectionDidRotatedEvent) => {
    const record = event.payload.connectionRecord
    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(webhookUrl + '/connections', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          ...event.payload,
          connectionRecord: body,
        },
      })
    }
  })
}
