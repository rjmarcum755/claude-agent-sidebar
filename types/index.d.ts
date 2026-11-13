export type AgentStatus = 'running' | 'idle' | 'waiting' | 'error'

export type Agent = {
  id: string
  name: string
  business: string
  status: AgentStatus
  task: string
  profitToday: number
  profitTotal: number
}

export type Feed = {
  agents: Agent[]
  source: 'live' | 'demo'
  updatedAt: string
}

declare module 'claude-code' {
  interface PluginState {
    'agent-sidebar': {
      feed: Shaped<Feed>
      selected: string
    }
  }
}
