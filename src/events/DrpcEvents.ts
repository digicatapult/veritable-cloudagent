import type { Agent } from '@credo-ts/core'
import {
  DrpcRequestEventTypes,
  type DrpcRequestStateChangedEvent,
  DrpcResponseEventTypes,
  type DrpcResponseStateChangedEvent,
} from '@credo-ts/drpc'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const drpcEvents = async (agent: Agent, config: ServerConfig) => {
  const eventHandler = async (event: DrpcRequestStateChangedEvent | DrpcResponseStateChangedEvent) => {
    const record = event.payload.drpcMessageRecord
    const body = record.toJSON()

    agent.config.logger.info(`DRPC event`, { event, record, body })

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        await sendWebhookEvent(webhookUrl + '/drpc', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          drpcMessageRecord: event.payload.drpcMessageRecord.toJSON(),
        },
      })
    }
  }
  agent.events.on(DrpcRequestEventTypes.DrpcRequestStateChanged, eventHandler)
  agent.events.on(DrpcResponseEventTypes.DrpcResponseStateChanged, eventHandler)
}
