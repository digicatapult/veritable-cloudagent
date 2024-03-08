import {
  TrustPingEventTypes,
  type Agent,
  type TrustPingReceivedEvent,
  type TrustPingResponseReceivedEvent,
} from '@aries-framework/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const trustPingEvents = async (agent: Agent, config: ServerConfig) => {
  const eventHandler = async (event: TrustPingReceivedEvent | TrustPingResponseReceivedEvent) => {
    const record = event.payload.connectionRecord
    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      await sendWebhookEvent(config.webhookUrl + '/trust-ping', body, agent.config.logger)
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          message: event.payload.message.toJSON(),
          basicMessageRecord: event.payload.connectionRecord.toJSON(),
        },
      })
    }
  }
  agent.events.on(TrustPingEventTypes.TrustPingReceivedEvent, eventHandler)
  agent.events.on(TrustPingEventTypes.TrustPingResponseReceivedEvent, eventHandler)
}
