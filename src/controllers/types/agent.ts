/**
 * General Agent information and message types.
 */
import type { UUID } from './common.js'

export interface AgentInfo {
  label: string
  endpoints: string[]
  isInitialized: boolean
}

export interface AgentMessageType {
  '@id': UUID
  '@type': string
  [key: string]: unknown
}
