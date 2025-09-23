import { Agent } from '@credo-ts/core'
import express from 'express'
import { Body, Controller, Example, Post, Request, Response, Route, Tags } from 'tsoa'
import { injectable } from 'tsyringe'

import { SharedMediaItem } from '@2060.io/credo-ts-didcomm-media-sharing'
import { RestAgent } from '../../../agent.js'
import { HttpResponse, NotFoundError } from '../../../error.js'
import type { MediaItemRequest, MediaShareRequest } from '../../types.js'

@Tags('Media')
@Route('/v1/media')
@injectable()
export class MediaController extends Controller {
  private agent: RestAgent

  public constructor(agent: Agent) {
    super()
    this.agent = agent
  }

  /**
   * Share media items with a connection
   *
   * @param request body containing connectionId and items array
   */
  @Example<MediaShareRequest>({
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
  })
  @Post('/share')
  @Response<NotFoundError['message']>(404)
  @Response<HttpResponse>(500)
  public async share(@Request() req: express.Request, @Body() body: MediaShareRequest) {
    req.log.info('sharing media to connection %s: %j', body.connectionId, body)

    // Create a record first (no network send yet)
    const items = body.items?.map(
      (i: MediaItemRequest) =>
        new SharedMediaItem({
          uri: i.uri,
          mimeType: i.mimeType,
          description: i.description,
          byteCount: i.byteCount,
          fileName: i.fileName,
          metadata: i.metadata,
        })
    )

    const record = await this.agent.modules.media.create({
      connectionId: body.connectionId,
      description: body.description,
      metadata: body.metadata,
      items,
    })

    // Then send the share message with (optional) updated items
    const updated = await this.agent.modules.media.share({
      recordId: record.id,
      description: body.description,
      items,
    })

    this.setStatus(200)
    return updated
  }
}
