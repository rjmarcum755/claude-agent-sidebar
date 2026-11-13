import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, AgentStatus, Feed } from '../types'

const PANE = 'agent-sidebar'
const TITLE = 'Agents'
const REFRESH_MS = 5000

// Where the live feed is looked for, first match wins: $AGENT_FEED_FILE, then
// ~/.claude/agent-sidebar/agents.json (where Crewdeck writes on your computer),
// then the project's shared folder. Until one exists the pane shows demo data.
const FEED_PATHS = ['/mnt/project-files/agent-sidebar/agents.json']

async function feedPaths($: EngineInterface): Promise<string[]> {
  const paths: string[] = []
  try {
    const custom = await $.env.get('AGENT_FEED_FILE')
    if (custom) paths.push(custom)
    const home = await $.env.get('HOME') ?? await $.env.get('USERPROFILE')
    if (home) paths.push(`${home}/.claude/agent-sidebar/agents.json`)
  } catch {
    // no environment access: fall back to the fixed paths
  }
  return [...paths, ...FEED_PATHS]
}

const DEMO: Agent[] = [
  { id: 'clipper-yt', name: 'Clipper YT', business: 'Content clipping', status: 'running', task: 'Cutting 3 clips from a trending podcast', profitToday: 42.5, profitTotal: 1180 },
  { id: 'clipper-ig', name: 'Clipper IG', business: 'Content clipping', status: 'running', task: 'Captioning reels for the afternoon post', profitToday: 31.2, profitTotal: 865 },
  { id: 'clipper-x', name: 'Clipper X', business: 'Content clipping', status: 'waiting', task: 'Waiting on X API posting limit reset', profitToday: 8.75, profitTotal: 240 },
  { id: 'clipper-fb', name: 'Clipper FB', business: 'Content clipping', status: 'idle', task: 'Queue empty, scanning for sources', profitToday: 0, profitTotal: 112 },
  { id: 'lead-gen', name: 'Lead Hunter', business: 'Local lead gen', status: 'running', task: 'Texting 12 warm leads over iMessage', profitToday: 150, profitTotal: 2310 },
  { id: 'store-ops', name: 'Store Ops', business: 'Print-on-demand store', status: 'error', task: 'Shopify token expired, needs re-auth', profitToday: 0, profitTotal: 640 },
]

const DEMO_TASKS: Record<string, string[]> = {
  'Content clipping': ['Finding viral moments in new uploads', 'Cutting 3 clips from a trending podcast', 'Writing captions and hashtags', 'Posting clip and logging views'],
  'Local lead gen': ['Texting 12 warm leads over iMessage', 'Booking a call for tomorrow', 'Scraping new listings', 'Following up on yesterday\'s replies'],
  'Print-on-demand store': ['Shopify token expired, needs re-auth'],
}

const feed = atom({ plugin: 'agent-sidebar', key: 'feed' } as const, { agents: DEMO, source: 'demo', updatedAt: '' } as Feed, { shape: 'feed-1' })
const selected = atom({ plugin: 'agent-sidebar', key: 'selected' } as const, '')

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: 'success',
  idle: 'inactive',
  waiting: 'warning',
  error: 'error',
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUSES: AgentStatus[] = ['running', 'idle', 'waiting', 'error']

function parseFeed(text: string): Agent[] | undefined {
  const raw = JSON.parse(text)
  const list = Array.isArray(raw) ? raw : raw?.agents
  if (!Array.isArray(list)) return undefined
  return list.map((a: Record<string, unknown>, i: number) => ({
    id: String(a.id ?? `agent-${i}`),
    name: String(a.name ?? a.id ?? `Agent ${i + 1}`),
    business: String(a.business ?? ''),
    status: STATUSES.includes(a.status as AgentStatus) ? (a.status as AgentStatus) : 'idle',
    task: String(a.task ?? a.currentTask ?? ''),
    profitToday: Number(a.profitToday ?? 0),
    profitTotal: Number(a.profitTotal ?? a.profit ?? 0),
  }))
}

// One small random step of the demo, so the pane visibly updates.
function stepDemo(agents: Agent[]): Agent[] {
  return agents.map(a => {
    if (a.status === 'error') return a
    const roll = Math.random()
    let { status, task, profitToday, profitTotal } = a
    if (status === 'running' && roll < 0.35) {
      const earned = Math.round(Math.random() * 600) / 100
      profitToday += earned
      profitTotal += earned
    }
    if (roll > 0.9) {
      const tasks = DEMO_TASKS[a.business] ?? [task]
      task = tasks[Math.floor(Math.random() * tasks.length)] ?? task
      status = status === 'running' ? 'idle' : 'running'
    }
    return { ...a, status, task, profitToday, profitTotal }
  })
}

async function refresh($: EngineInterface) {
  for (const path of await feedPaths($)) {
    try {
      const agents = parseFeed(await $.fs.read(path))
      if (agents) {
        await update($, feed, () => ({ agents, source: 'live' as const, updatedAt: new Date().toISOString() }))
        return
      }
    } catch {
      // not there yet, or unreadable: try the next path
    }
  }
  await update($, feed, f => ({
    agents: stepDemo(f.source === 'demo' && f.agents.length ? f.agents : DEMO),
    source: 'demo' as const,
    updatedAt: new Date().toISOString(),
  }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agent-sidebar', description: 'Open the AI agents sidebar' })
    void $.ui.open({ id: PANE, title: TITLE })
    await refresh($)
    $.clock.every(REFRESH_MS, () => refresh($))
    return next(e)
  })

  on('command.run', { command: 'agent-sidebar' }, async $ => {
    try {
      await $.ui.open({ id: PANE, title: TITLE })
      return { text: 'Agents sidebar opened.' }
    } catch {
      return { text: 'Could not open the agents sidebar here.' }
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { agents, source, updatedAt } = await read($, feed)
    const open = await read($, selected)

    const today = agents.reduce((s, a) => s + a.profitToday, 0)
    const total = agents.reduce((s, a) => s + a.profitTotal, 0)
    const running = agents.filter(a => a.status === 'running').length
    const time = updatedAt ? new Date(updatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text weight="semibold">{money(today)} today</Text>
          <Text dimColor>{money(total)} all time · {running}/{agents.length} running</Text>
          <Text dimColor size="caption">
            {source === 'demo' ? 'Demo data, not real earnings' : 'Live feed'}{time ? ` · ${time}` : ''}
          </Text>
        </Box>

        {agents.map(a => (
          <Box key={a.id} flexDirection="column" borderStyle="round" borderColor={a.status === 'error' ? 'error' : 'subtle'} paddingX={1}>
            <Button key={`row-${a.id}`} plain onPress={() => update($, selected, cur => (cur === a.id ? '' : a.id))}>
              <Text color={STATUS_COLOR[a.status]}>● </Text>
              <Text weight="semibold">{a.name}</Text>
              <Text dimColor>  {money(a.profitToday)}</Text>
            </Button>
            <Text dimColor size="caption">{a.status} · {a.business}</Text>
            <Text size="footnote">{a.task || 'No current task'}</Text>
            {open === a.id && (
              <Box flexDirection="column" gap={1} marginTop={1}>
                <Text dimColor size="caption">All time {money(a.profitTotal)}</Text>
                <Button
                  key={`brief-${a.id}`}
                  variant="secondary"
                  onPress={() =>
                    $.prompt.submit({
                      text: `Give me a short briefing on my agent "${a.name}" (${a.business}). Its status is ${a.status}, its current task is "${a.task}", and it has earned ${money(a.profitToday)} today and ${money(a.profitTotal)} in total. What should I do next with it?`,
                    })
                  }
                >
                  Brief me
                </Button>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
