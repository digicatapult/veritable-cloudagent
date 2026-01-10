import { type Agent, type ProofStateChangedEvent, ProofEventTypes } from '@credo-ts/core'

import type { ServerConfig } from '../utils/ServerConfig.js'
import { sendWebSocketEvent } from './WebSocketEvents.js'
import { sendWebhookEvent } from './WebhookEvent.js'

export const proofEvents = async (agent: Agent, config: ServerConfig) => {
  agent.events.on(ProofEventTypes.ProofStateChanged, async (event: ProofStateChangedEvent) => {
    const record = event.payload.proofRecord

    // Noise reduction: filter out events where the proof state hasn't changed.
    // This assumes that repeated emissions of the same state are not semantically meaningful
    // for our webhooks / WebSocket clients. If the underlying state machine ever starts
    // emitting legitimate same-state transitions (e.g. retry logic), this filter will
    // intentionally hide those from external consumers, but we still log them for debugging.
    if (event.payload.previousState === record.state) {
      agent.config.logger.debug?.(
        `Filtered ProofStateChanged event with unchanged state '${record.state}' for proofRecord ${record.id} (previousState=${String(
          event.payload.previousState
        )})`
      )
      return
    }

    const body = record.toJSON()

    // Only send webhook if webhook url is configured
    if (config.webhookUrl) {
      for (const webhookUrl of config.webhookUrl) {
        sendWebhookEvent(`${webhookUrl}/proofs`, body, agent.config.logger)
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
