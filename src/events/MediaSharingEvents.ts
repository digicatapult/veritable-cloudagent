import { MediaSharingEventTypes, type MediaSharingStateChangedEvent } from '@2060.io/credo-ts-didcomm-media-sharing'
import type { Agent } from '@credo-ts/core'
import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const mediaSharingEvents = async (agent: Agent, config: ServerConfig) => {
  try {
    agent.events.on<MediaSharingStateChangedEvent>(MediaSharingEventTypes.StateChanged, async (event) => {
      const record = event.payload.mediaSharingRecord
      const body = record?.toJSON?.() ?? record

      agent.config.logger.info('Media sharing event', { event, record: body })

      if (config.webhookUrl) {
        for (const webhookUrl of config.webhookUrl) {
          sendWebhookEvent(`${webhookUrl}/media-sharing`, body, agent.config.logger)
        }
      }

      if (config.socketServer) {
        sendWebSocketEvent(config.socketServer, {
          ...event,
          payload: {
            ...event.payload,
            mediaSharingRecord: body,
          },
        })
      }
    })
  } catch (e) {
    agent.config.logger.error('Failed to register media sharing events', { error: e })
  }
}
