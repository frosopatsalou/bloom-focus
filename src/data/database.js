import { openDB } from 'idb'

const plain = value => JSON.parse(JSON.stringify(value))

export function createBloomDatabase(name = 'bloom-focus') {
  const database = openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore('meta')
      db.createObjectStore('sessions', { keyPath: 'id' })
      db.createObjectStore('queue', { keyPath: 'id' })
      db.createObjectStore('synced', { keyPath: 'id' })
      db.createObjectStore('tasks', { keyPath: 'id' })
    },
  })
  return {
    async setActiveTimer(timer) { const db = await database; timer ? await db.put('meta', plain(timer), 'activeTimer') : await db.delete('meta', 'activeTimer') },
    async getActiveTimer() { return (await (await database).get('meta', 'activeTimer')) || null },
    async saveSession(session) { await (await database).put('sessions', plain(session)) },
    async listSessions() { return (await (await database).getAll('sessions')).sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt))) },
    async saveSettings(settings) { await (await database).put('meta', plain(settings), 'settings') },
    async getSettings() { return (await (await database).get('meta', 'settings')) || null },
    async setVaultHandle(handle) { handle ? await (await database).put('meta', handle, 'vaultHandle') : await (await database).delete('meta', 'vaultHandle') },
    async getVaultHandle() { return (await (await database).get('meta', 'vaultHandle')) || null },
    async enqueueEvent(event) { await (await database).put('queue', plain(event)) },
    async listPendingEvents() { return (await (await database).getAll('queue')).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) },
    async markEventSynced(id) {
      const db = await database
      const event = await db.get('queue', id)
      if (!event) return
      const transaction = db.transaction(['queue', 'synced'], 'readwrite')
      await transaction.objectStore('synced').put({ ...event, syncedAt: new Date().toISOString() })
      await transaction.objectStore('queue').delete(id)
      await transaction.done
    },
    async listSyncedEvents() { return (await (await database).getAll('synced')).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) },
    async saveTasks(tasks) {
      const db = await database
      const transaction = db.transaction('tasks', 'readwrite')
      await transaction.store.clear()
      for (const task of tasks) await transaction.store.put(task)
      await transaction.done
    },
    async listTasks() { return (await (await database).getAll('tasks')).filter(task => task.status !== 'Deleted' && task.status !== 'Completed') },
  }
}

export const bloomDb = createBloomDatabase()
