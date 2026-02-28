import type { Agent } from '@credo-ts/core'
import {
  DidCommConnectionEventTypes,
  type DidCommConnectionDidRotatedEvent,
  type DidCommConnectionStateChangedEvent,
} from '@credo-ts/didcomm'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const connectionEvents = async (agent: Agent, config: ServerConfig) => {
  const eventHandler = async (event: DidCommConnectionStateChangedEvent | DidCommConnectionDidRotatedEvent) => {
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
  agent.events.on(DidCommConnectionEventTypes.DidCommConnectionStateChanged, eventHandler)
  agent.events.on(DidCommConnectionEventTypes.DidCommConnectionDidRotated, eventHandler)
}
