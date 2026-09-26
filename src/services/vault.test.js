import { describe, expect, it } from 'vitest'
import { browserVault, reconstructTasks } from './vault.js'

function memoryDirectory() {
  const directories = new Map()
  const files = new Map()
  return {
    kind: 'directory',
    async queryPermission() { return 'granted' },
    async getDirectoryHandle(name, options = {}) {
      if (!directories.has(name) && options.create) directories.set(name, memoryDirectory())
      if (!directories.has(name)) throw new Error('Missing directory')
      return directories.get(name)
    },
    async getFileHandle(name, options = {}) {
      if (!files.has(name) && options.create) {
        let content = ''
        files.set(name, {
          async getFile() { return { size: content.length, async text() { return content } } },
          async createWritable() { return { async seek() {}, async write(value) { content += value }, async close() {} } },
        })
      }
      return files.get(name)
    },
    directories,
    files,
  }
}

const event = {
  id: 'evt-1', source: 'Bloom Focus', date: '2026-09-26', time: '14:32:08',
  timeZone: 'Europe/Brussels', offset: 'UTC+02:00', occurredAt: '2026-09-26T12:32:08.000Z',
  type: 'focus.completed', status: 'Completed', sessionId: 'session-1', mode: 'focus',
  plannedMs: 1_500_000, actualActiveMs: 1_500_000, activity: { type: 'text', title: 'Review notes' },
}

describe('vault adapter', () => {
  it('writes an event once and verifies its stable marker', async () => {
    const root = memoryDirectory()
    await browserVault.writeEvent(root, event)
    await browserVault.writeEvent(root, event)
    const bloom = root.directories.get('Bloom Productivity').directories.get('Bloom Focus')
    const file = bloom.directories.get('2026').directories.get('09').files.get('2026-09-26.md')
    const content = await (await file.getFile()).text()
    expect(content.match(/bloom-event:evt-1:start/g)).toHaveLength(1)
  })

  it('reconstructs the latest active Bloom Tasks records', () => {
    const markdown = `<!-- bloom-event:evt-a:start -->\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-a:end -->\n<!-- bloom-event:evt-b:start -->\n- **Event type:** \`task.completed\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-b:end -->\n<!-- bloom-event:evt-c:start -->\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-2\`\n- **Task:** Write report\n<!-- bloom-event:evt-c:end -->`
    expect(reconstructTasks(markdown)).toEqual([{ id: 'task-2', title: 'Write report', status: 'Active' }])
  })
})
