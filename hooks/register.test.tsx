import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-sidebar',
  component: 'Pane',
  requestId: 'agent-sidebar',
  props: { title: 'Agents', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('lists the demo agents with a demo label, on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-sidebar' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => { throw new Error('ENOENT') })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Clipper YT/ }))?.text).toBe('Clipper YT')
    expect(await ui.find({ type: 'Text', text: /Demo data/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('reads the live feed file when it exists', async ($, on) => {
  on('command.register', () => ({ value: { command: 'agent-sidebar' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('fs.read', () => ({ value: JSON.stringify({ agents: [{ id: 'a', name: 'Real Agent', business: 'Biz', status: 'running', task: 'Selling', profitToday: 10, profitTotal: 99 }] }) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Real Agent/ }))?.text).toBe('Real Agent')
  expect(await ui.find({ type: 'Text', text: /Live feed/ })).toBeTruthy()
  await ui.unmount()
})
