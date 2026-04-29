import type { Agent } from '@credo-ts/core'
import { DidCommCredentialEventTypes, type DidCommCredentialStateChangedEvent } from '@credo-ts/didcomm'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const credentialEvents = async (agent: Agent, config: ServerConfig) => {
  agent.events.on(
    DidCommCredentialEventTypes.DidCommCredentialStateChanged,
    async (event: DidCommCredentialStateChangedEvent) => {
      const record = event.payload.credentialExchangeRecord
      const body = record.toJSON()

      // Only send webhook if webhook url is configured
      if (config.webhookUrl) {
        for (const webhookUrl of config.webhookUrl) {
          sendWebhookEvent(`${webhookUrl}/credentials`, body, agent.config.logger)
        }
      }

      if (config.socketServer) {
        // Always emit websocket event to clients (could be 0)
        sendWebSocketEvent(config.socketServer, {
          ...event,
          payload: {
            ...event.payload,
            credentialExchangeRecord: body,
          },
        })
      }
    }
  )
}
