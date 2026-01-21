export interface HttpResponseLike {
  status?: number
  statusCode?: number
  body?: unknown
}

export interface QueryableRequest {
  query(query: Record<string, unknown>): Promise<HttpResponseLike>
}

export interface SupertestLikeClient {
  get(url: string): QueryableRequest
  delete(url: string): QueryableRequest
}

const getStatusCode = (response: HttpResponseLike): number | undefined => response.statusCode ?? response.status

const isMissing = (status: number | undefined): boolean => status === 404 || status === 410

export async function safeDeleteConnection(
  client: SupertestLikeClient,
  connectionId: string,
  label: string
): Promise<void> {
  try {
    const response = await client.delete(`/v1/connections/${connectionId}`).query({ deleteConnectionRecord: true })

    const status = getStatusCode(response)
    if (isMissing(status)) return

    if (status && status >= 400) {
      // Teardown should not mask test failures; log for visibility.
      // eslint-disable-next-line no-console
      console.warn(`[cleanup] ${label}: failed to delete connection ${connectionId} (status ${status})`)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[cleanup] ${label}: error deleting connection ${connectionId}`, error)
  }
}

function isConnectionIdList(value: unknown): value is Array<{ id: string }> {
  return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'id' in item)
}

export async function safeDeleteConnectionsByOutOfBandId(
  client: SupertestLikeClient,
  outOfBandId: string,
  label: string
): Promise<void> {
  try {
    const response = await client.get('/v1/connections').query({ outOfBandId })
    const status = getStatusCode(response)

    if (status && status >= 400) {
      // eslint-disable-next-line no-console
      console.warn(`[cleanup] ${label}: failed to list connections for outOfBandId ${outOfBandId} (status ${status})`)
      return
    }

    if (!isConnectionIdList(response.body)) return

    for (const connection of response.body) {
      if (typeof connection.id === 'string' && connection.id) {
        await safeDeleteConnection(client, connection.id, label)
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[cleanup] ${label}: error listing/deleting connections for outOfBandId ${outOfBandId}`, error)
  }
}

export function safeCloseWebSocket(ws: { close: () => void } | undefined, label: string): void {
  if (!ws) return

  try {
    ws.close()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[cleanup] ${label}: error closing websocket`, error)
  }
}
