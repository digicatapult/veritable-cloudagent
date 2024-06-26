import { type Agent, type ProofStateChangedEvent, ProofEventTypes } from '@credo-ts/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const proofEvents = async (agent: Agent, config: ServerConfig) => {
  agent.events.on(ProofEventTypes.ProofStateChanged, async (event: ProofStateChangedEvent) => {
    const record = event.payload.proofRecord
    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(webhookUrl + '/proofs', body, agent.config.logger)
      }
    }

    if (config.socketServer) {
      // Always emit websocket event to clients (could be 0)
      sendWebSocketEvent(config.socketServer, {
        ...event,
        payload: {
          ...event.payload,
          proofRecord: body,
        },
      })
    }
  })
}
