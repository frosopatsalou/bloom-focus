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

  it('propagates vault read failures that are not missing directories', async () => {
    const failure = Object.assign(new Error('Disk read failed'), { name: 'NotReadableError' })
    const root = {
      async queryPermission() { return 'granted' },
      async getDirectoryHandle() { throw failure },
    }

    await expect(browserVault.readTasks(root)).rejects.toBe(failure)
  })

  it('treats a missing Bloom Tasks directory as an empty task list', async () => {
    const root = {
      async queryPermission() { return 'granted' },
      async getDirectoryHandle() { throw new DOMException('Missing directory', 'NotFoundError') },
    }

    await expect(browserVault.readTasks(root)).resolves.toEqual([])
  })

  it('reconstructs the latest active Bloom Tasks records', () => {
    const markdown = `<!-- bloom-event:evt-a:start -->\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-a:end -->\n<!-- bloom-event:evt-b:start -->\n- **Event type:** \`task.completed\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-b:end -->\n<!-- bloom-event:evt-c:start -->\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-2\`\n- **Task:** Write report\n<!-- bloom-event:evt-c:end -->`
    expect(reconstructTasks(markdown)).toEqual([{ id: 'task-2', title: 'Write report', status: 'Active' }])
  })

  it('sorts Bloom Tasks events chronologically before rebuilding task state', () => {
    const deleted = `<!-- bloom-event:evt-z -->\n### 10:30:00 — Task deleted\n\n- **Event ID:** \`evt-z\`\n- **Date:** 2026-09-26\n- **Time:** 10:30:00\n- **Event type:** \`task.deleted\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n\n<!-- /bloom-event:evt-z -->`
    const created = `<!-- bloom-event:evt-a -->\n### 09:00:00 — Task created\n\n- **Event ID:** \`evt-a\`\n- **Date:** 2026-09-26\n- **Time:** 09:00:00\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n\n<!-- /bloom-event:evt-a -->`
    const active = `<!-- bloom-event:evt-b -->\n### 11:00:00 — Task created\n\n- **Event ID:** \`evt-b\`\n- **Date:** 2026-09-26\n- **Time:** 11:00:00\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-2\`\n- **Task:** Write report\n\n<!-- /bloom-event:evt-b -->`

    expect(reconstructTasks(`${deleted}\n${created}\n${active}`)).toEqual([
      { id: 'task-2', title: 'Write report', status: 'Active' },
    ])
  })

  it('uses append order when task events share second-precision timestamps', () => {
    const event = (id, type, taskId, title) => `<!-- bloom-event:${id}:start -->\n- **Event ID:** \`${id}\`\n- **Timestamp:** 2026-09-26T10:30:00\n- **Event type:** \`${type}\`\n- **Task ID:** \`${taskId}\`\n- **Task:** ${title}\n<!-- bloom-event:${id}:end -->`
    const markdown = [
      event('evt-z-created', 'task.created', 'task-completed', 'Finish notes'),
      event('evt-a-completed', 'task.completed', 'task-completed', 'Finish notes'),
      event('evt-z-created-2', 'task.created', 'task-deleted', 'Remove draft'),
      event('evt-a-deleted', 'task.deleted', 'task-deleted', 'Remove draft'),
    ].join('\n')

    expect(reconstructTasks(markdown)).toEqual([])
  })

  it('uses stable file chronology before line order for same-second events', () => {
    const created = `<!-- bloom-event:evt-z-created:start -->\n- **Timestamp:** 2026-09-26T10:30:00\n- **Event type:** \`task.created\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-z-created:end -->`
    const deleted = `<!-- bloom-event:evt-a-deleted:start -->\n- **Timestamp:** 2026-09-26T10:30:00\n- **Event type:** \`task.deleted\`\n- **Task ID:** \`task-1\`\n- **Task:** Read chapter\n<!-- bloom-event:evt-a-deleted:end -->`

    expect(reconstructTasks([
      { path: '2026/09/27.md', markdown: deleted },
      { path: '2026/09/26.md', markdown: created },
    ])).toEqual([])
  })
})
