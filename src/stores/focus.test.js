import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, vault } = vi.hoisted(() => ({
  db: {
    getSettings: vi.fn(), listSessions: vi.fn(), listPendingEvents: vi.fn(), listTasks: vi.fn(),
    getVaultHandle: vi.fn(), getActiveTimer: vi.fn(), saveTasks: vi.fn(), saveSettings: vi.fn(),
    setActiveTimer: vi.fn(), enqueueEvent: vi.fn(), saveSession: vi.fn(), markEventSynced: vi.fn(),
    setVaultHandle: vi.fn(), listSyncedEvents: vi.fn(),
  },
  vault: {
    supported: true, canWrite: vi.fn(), readTasks: vi.fn(), writeEvent: vi.fn(), choose: vi.fn(),
  },
}))

vi.mock('../data/database.js', () => ({ bloomDb: db }))
vi.mock('../services/vault.js', () => ({ browserVault: vault }))
vi.mock('../services/audio.js', () => ({ completionChime: vi.fn() }))

import { useFocusStore } from './focus.js'

function defaults() {
  db.getSettings.mockResolvedValue(null)
  db.listSessions.mockResolvedValue([])
  db.listPendingEvents.mockResolvedValue([])
  db.listTasks.mockResolvedValue([])
  db.getVaultHandle.mockResolvedValue(null)
  db.getActiveTimer.mockResolvedValue(null)
  db.saveTasks.mockResolvedValue()
  vault.canWrite.mockResolvedValue(true)
  vault.readTasks.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  defaults()
  setActivePinia(createPinia())
})

describe('focus store lifecycle and vault reads', () => {
  it('does not start the timer interval when disposed during async initialization', async () => {
    let resolveSettings
    db.getSettings.mockReturnValue(new Promise(resolve => { resolveSettings = resolve }))
    const interval = vi.spyOn(window, 'setInterval')
    const store = useFocusStore()

    const initializing = store.initialize()
    store.dispose()
    resolveSettings(null)
    await initializing

    expect(interval).not.toHaveBeenCalled()
    interval.mockRestore()
  })

  it('preserves cached tasks and exposes an I/O error when vault task reading fails', async () => {
    const cached = [{ id: 'task-1', title: 'Cached task', status: 'Active' }]
    const failure = Object.assign(new Error('The vault could not be read'), { name: 'NotReadableError' })
    db.listTasks.mockResolvedValue(cached)
    db.getVaultHandle.mockResolvedValue({ name: 'Vault' })
    vault.readTasks.mockRejectedValue(failure)
    const store = useFocusStore()

    await store.initialize()

    expect(store.tasks).toEqual(cached)
    expect(db.saveTasks).not.toHaveBeenCalled()
    expect(store.vaultStatus).toBe('Error')
    expect(store.vaultError).toBe('The vault could not be read')
    store.dispose()
  })
})
