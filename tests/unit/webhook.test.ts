/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, before, after, test } from 'mocha'
import { expect } from 'chai'

import type { WebhookData } from '../../src/utils/webhook.js'
import type { Agent, CredentialStateChangedEvent, ProofStateChangedEvent } from '@credo-ts/core'
import type { Server } from 'net'

import {
  CredentialExchangeRecord,
  ProofEventTypes,
  ProofState,
  ProofExchangeRecord,
  CredentialState,
  CredentialEventTypes,
  CredentialRole,
  ProofRole,
} from '@credo-ts/core'

import { setupServer } from '../../src/server.js'
import { waitForHook, webhookListener } from '../../src/utils/webhook.js'

import { getTestAgent } from './utils/helpers.js'

describe('WebhookTests', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let server: Server
  const webhooks: WebhookData[] = []

  before(async () => {
    aliceAgent = await getTestAgent('Webhook REST Agent Test Alice', 3042)
    bobAgent = await getTestAgent('Webhook REST Agent Test Bob', 3043)
    server = await webhookListener(3044, webhooks)
    await setupServer(bobAgent, { webhookUrl: ['http://localhost:3044'], port: 6045 })
  })

  test('should return a webhook event when basic message state changed', async () => {
    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation()
    const { connectionRecord } = await bobAgent.oob.receiveInvitation(outOfBandInvitation)
    const connection = await bobAgent.connections.returnWhenIsConnected(connectionRecord!.id)

    await bobAgent.basicMessages.sendMessage(connection.id, 'Hello')

    const webhook = await waitForHook(webhooks, (webhook) => webhook.topic !== 'connections')

    expect(webhook).to.not.be.an('undefined')
  })

  test('should return a webhook event when connection state changed', async () => {
    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation()
    const { connectionRecord } = await bobAgent.oob.receiveInvitation(outOfBandInvitation)
    const connection = await bobAgent.connections.returnWhenIsConnected(connectionRecord!.id)

    const webhook = await waitForHook(
      webhooks,
      (webhook) =>
        webhook.topic === 'connections' && webhook.body.id === connection.id && webhook.body.state === connection.state
    )

    expect(JSON.parse(JSON.stringify(connection.toJSON()))).to.deep.include(webhook?.body as Record<string, unknown>)
  })

  test('should return a webhook event when credential state changed', async () => {
    const credentialRecord = new CredentialExchangeRecord({
      id: 'testest',
      state: CredentialState.OfferSent,
      threadId: 'random',
      protocolVersion: 'v1',
      role: CredentialRole.Holder,
    })

    bobAgent.events.emit<CredentialStateChangedEvent>(bobAgent.context, {
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        previousState: null,
        credentialRecord,
      },
    })

    const webhook = await waitForHook(
      webhooks,
      (webhook) =>
        webhook.topic === 'credentials' &&
        webhook.body.id === credentialRecord.id &&
        webhook.body.state === credentialRecord.state
    )

    expect(JSON.parse(JSON.stringify(credentialRecord.toJSON()))).to.deep.include(
      webhook?.body as Record<string, unknown>
    )
  })

  test('should return a webhook event when proof state changed', async () => {
    const proofRecord = new ProofExchangeRecord({
      id: 'testest',
      protocolVersion: 'v2',
      state: ProofState.ProposalSent,
      threadId: 'random',
      role: ProofRole.Prover,
    })

    bobAgent.events.emit<ProofStateChangedEvent>(bobAgent.context, {
      type: ProofEventTypes.ProofStateChanged,
      payload: {
        previousState: null,
        proofRecord,
      },
    })

    const webhook = await waitForHook(
      webhooks,
      (webhook) =>
        webhook.topic === 'proofs' && webhook.body.id === proofRecord.id && webhook.body.state === proofRecord.state
    )

    expect(JSON.parse(JSON.stringify(proofRecord.toJSON()))).to.deep.include(webhook?.body as Record<string, unknown>)
  })

  after(async () => {
    await new Promise((r) => setTimeout(r, 2000))
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    server.close()
  })
})
