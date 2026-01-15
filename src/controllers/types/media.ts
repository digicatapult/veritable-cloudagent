import type { UUID } from './common.js'

// Media Sharing
export interface MediaItemRequest {
  uri: string
  mimeType: string
  description?: string
  byteCount?: number
  fileName?: string
  metadata?: Record<string, unknown>
}

export interface MediaShareRequest {
  connectionId: UUID
  description?: string
  metadata?: Record<string, unknown>
  items?: MediaItemRequest[]
}
