import type { Agent } from '@credo-ts/core'
import {
  VerifiedDrpcRequestEventTypes,
  type VerifiedDrpcRequestStateChangedEvent,
  VerifiedDrpcResponseEventTypes,
  type VerifiedDrpcResponseStateChangedEvent,
} from '../modules/verified-drpc/index.js'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const verifiedDrpcEvents = async (agent: Agent, config: ServerConfig) => {
  const eventHandler = async (event: VerifiedDrpcRequestStateChangedEvent | VerifiedDrpcResponseStateChangedEvent) => {
    const record = event.payload.verifiedDrpcMessageRecord
    const body = record.toJSON()

    agent.config.logger.info(`Verified DRPC event`, { event, record, body })

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        await sendWebhookEvent(webhookUrl + '/verified-drpc', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          verifiedDrpcMessageRecord: event.payload.verifiedDrpcMessageRecord.toJSON(),
        },
      })
    }
  }
  agent.events.on(VerifiedDrpcRequestEventTypes.VerifiedDrpcRequestStateChanged, eventHandler)
  agent.events.on(VerifiedDrpcResponseEventTypes.VerifiedDrpcResponseStateChanged, eventHandler)
}
