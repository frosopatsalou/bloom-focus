import { dailyLogPath, formatEventMarkdown } from '../domain/events.js'

async function permission(handle, write = false) {
  if (!handle) return false
  const options = { mode: write ? 'readwrite' : 'read' }
  if ((await handle.queryPermission?.(options)) === 'granted') return true
  return (await handle.requestPermission?.(options)) === 'granted'
}

async function directory(root, names) {
  let current = root
  for (const name of names) current = await current.getDirectoryHandle(name, { create: true })
  return current
}

export const browserVault = {
  supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  async choose() { return window.showDirectoryPicker({ mode: 'readwrite', id: 'bloom-productivity-vault' }) },
  async canRead(handle) { return permission(handle, false) },
  async canWrite(handle) { return permission(handle, true) },
  async writeEvent(handle, event) {
    if (!(await permission(handle, true))) throw new Error('Vault permission is required')
    const path = dailyLogPath(event)
    const folder = await directory(handle, path.slice(0, -1))
    const fileHandle = await folder.getFileHandle(path.at(-1), { create: true })
    const file = await fileHandle.getFile()
    const previous = await file.text()
    const marker = `<!-- bloom-event:${event.id}:start -->`
    if (!previous.includes(marker)) {
      const writable = await fileHandle.createWritable({ keepExistingData: true })
      await writable.seek(file.size)
      await writable.write(`${file.size ? '\n' : ''}${formatEventMarkdown(event)}`)
      await writable.close()
    }
    const verified = await (await fileHandle.getFile()).text()
    if (!verified.includes(marker)) throw new Error('The event could not be verified after writing')
  },
  async readTasks(handle) {
    if (!(await permission(handle, false))) throw new Error('Vault permission is required')
    let root = handle
    try {
      root = await root.getDirectoryHandle('Bloom Productivity')
      root = await root.getDirectoryHandle('Bloom Tasks')
    } catch (error) {
      if (error?.name === 'NotFoundError') return []
      throw error
    }
    const files = []
    async function walk(dir) {
      for await (const entry of dir.values()) {
        if (entry.kind === 'directory') await walk(entry)
        else if (entry.name.endsWith('.md')) files.push(await (await entry.getFile()).text())
      }
    }
    await walk(root)
    return reconstructTasks(files.join('\n'))
  },
}

export function reconstructTasks(markdown) {
  const pattern = /<!-- bloom-event:([^\s:>]+)(?::start)? -->[\s\S]*?<!-- (?:\/bloom-event:\1|bloom-event:\1:end) -->/g
  const events = [...markdown.matchAll(pattern)].map((match) => {
    const block = match[0]
    const field = label => block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(?:\\\`)?([^\\n\\\`]+)`))?.[1]?.trim()
    const date = field('Date')
    const time = field('Time')
    const timestamp = field('Timestamp') || field('Occurred at') || field('Created at') || (date && time ? `${date}T${time}` : date)
    const parsedTime = timestamp ? Date.parse(timestamp) : Number.NaN
    return {
      eventId: field('Event ID') || match[1],
      type: field('Event type'),
      taskId: field('Task ID'),
      title: field('Task'),
      timestamp: Number.isNaN(parsedTime) ? Number.NEGATIVE_INFINITY : parsedTime,
    }
  }).filter(event => event.taskId && event.type?.startsWith('task.'))

  events.sort((a, b) => a.timestamp - b.timestamp || a.eventId.localeCompare(b.eventId))

  const tasks = new Map()
  for (const event of events) {
    const prior = tasks.get(event.taskId) || { id: event.taskId }
    const title = event.title || prior.title || 'Untitled task'
    const status = event.type === 'task.deleted' ? 'Deleted' : event.type === 'task.completed' ? 'Completed' : 'Active'
    tasks.set(event.taskId, { ...prior, id: event.taskId, title, status })
  }
  return [...tasks.values()].filter(task => task.status === 'Active').sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}
