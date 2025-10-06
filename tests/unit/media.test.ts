import { expect } from 'chai'
import { after, before, describe, test } from 'mocha'
import type { Server } from 'node:net'
import { restore as sinonRestore, stub } from 'sinon'
import request from 'supertest'

import {
  MediaSharingRecord,
  MediaSharingRole,
  MediaSharingState,
  SharedMediaItem,
} from '@2060.io/credo-ts-didcomm-media-sharing'

import { getTestAgent, getTestServer, objectToJson } from './utils/helpers.js'

import type { RestAgent } from '../../src/agent.js'
import type { MediaShareRequest } from '../../src/controllers/types.js'

/**
 * Unit tests for MediaController POST /v1/media/share
 */
describe('MediaController', () => {
  let app: Server
  let agent: RestAgent

  before(async () => {
    agent = await getTestAgent('Media REST Agent Test', 3050)
    app = await getTestServer(agent)
  })

  after(async () => {
    sinonRestore()
    await agent.shutdown()
    await agent.wallet.delete()
    app.close()
  })

  describe('POST /v1/media/share', () => {
    test('should create and share media and return updated record', async () => {
      // Arrange
      const createStub = stub(agent.modules.media, 'create')
      const shareStub = stub(agent.modules.media, 'share')

      const fakeRecord = new MediaSharingRecord({
        id: 'rec-123',
        createdAt: new Date(),
        connectionId: '52907745-7672-470e-a803-a2f8feb52944',
        role: MediaSharingRole.Sender,
        state: MediaSharingState.Init,
        items: [],
      })
      createStub.resolves(fakeRecord)
      const sharedRecord = new MediaSharingRecord({
        id: 'rec-123',
        createdAt: new Date(),
        connectionId: '52907745-7672-470e-a803-a2f8feb52944',
        role: MediaSharingRole.Sender,
        state: MediaSharingState.MediaShared,
        items: [],
      })
      shareStub.resolves(sharedRecord)

      const body: MediaShareRequest = {
        connectionId: '52907745-7672-470e-a803-a2f8feb52944',
        description: 'Optional description',
        items: [
          {
            uri: 'https://example.com/file.pdf',
            mimeType: 'application/pdf',
            description: 'Manual v1',
            fileName: 'manual.pdf',
          },
        ],
      }

      // Act
      const res = await request(app).post('/v1/media/share').send(body)

      // Assert
      expect(res.status).to.equal(200)
      expect(createStub.calledOnce).to.equal(true)
      const itemsArg = createStub.firstCall.args[0].items as SharedMediaItem[]
      expect(Array.isArray(itemsArg)).to.equal(true)
      expect(itemsArg[0]).to.be.instanceOf(SharedMediaItem)
      expect(shareStub.calledOnce).to.equal(true)
      expect(shareStub.firstCall.args[0]).to.deep.include({ recordId: 'rec-123' })
      expect(res.body).to.deep.equal(objectToJson(sharedRecord))
    })
  })
})
