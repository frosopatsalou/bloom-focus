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
    } catch { return [] }
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
  const blocks = markdown.match(/<!-- bloom-event:[\s\S]*?<!-- bloom-event:[^\n]+:end -->/g) || []
  const tasks = new Map()
  for (const block of blocks) {
    const field = label => block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(?:\\\`)?([^\\n\\\`]+)`))?.[1]?.trim()
    const type = field('Event type')
    const id = field('Task ID')
    if (!id || !type?.startsWith('task.')) continue
    const prior = tasks.get(id) || { id }
    const title = field('Task') || prior.title || 'Untitled task'
    const status = type === 'task.deleted' ? 'Deleted' : type === 'task.completed' ? 'Completed' : 'Active'
    tasks.set(id, { ...prior, id, title, status })
  }
  return [...tasks.values()].filter(task => task.status === 'Active').sort((a, b) => a.title.localeCompare(b.title))
}
