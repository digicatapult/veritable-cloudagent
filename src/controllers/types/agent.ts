import type { UUID } from './common'

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
