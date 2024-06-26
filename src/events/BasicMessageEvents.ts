import { type Agent, type BasicMessageStateChangedEvent, BasicMessageEventTypes } from '@credo-ts/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const basicMessageEvents = async (agent: Agent, config: ServerConfig) => {
  agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, async (event: BasicMessageStateChangedEvent) => {
    const record = event.payload.basicMessageRecord
    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(webhookUrl + '/basic-messages', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          message: event.payload.message.toJSON(),
          basicMessageRecord: body,
        },
      })
    }
  })
}
