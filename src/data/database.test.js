import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createBloomDatabase } from './database.js'

let db
beforeEach(async () => {
  db = createBloomDatabase(`bloom-test-${crypto.randomUUID()}`)
})

describe('IndexedDB persistence and pending queue', () => {
  it('persists and clears an active timer', async () => {
    const timer = { id: 'session-1', state: 'running' }
    await db.setActiveTimer(timer)
    expect(await db.getActiveTimer()).toEqual(timer)
    await db.setActiveTimer(null)
    expect(await db.getActiveTimer()).toBeNull()
  })

  it('enqueues events idempotently and returns them in event-time order', async () => {
    await db.enqueueEvent({ id: 'evt-2', occurredAt: '2026-09-26T12:02:00.000Z' })
    await db.enqueueEvent({ id: 'evt-1', occurredAt: '2026-09-26T12:01:00.000Z' })
    await db.enqueueEvent({ id: 'evt-1', occurredAt: '2026-09-26T12:01:00.000Z' })
    const pending = await db.listPendingEvents()
    expect(pending.map(item => item.id)).toEqual(['evt-1', 'evt-2'])
  })

  it('only removes a queue event after explicit verified sync', async () => {
    await db.enqueueEvent({ id: 'evt-1', occurredAt: '2026-09-26T12:01:00.000Z' })
    await db.markEventSynced('evt-1')
    expect(await db.listPendingEvents()).toEqual([])
    expect((await db.listSyncedEvents()).map(item => item.id)).toEqual(['evt-1'])
  })

  it('persists completed history and settings', async () => {
    await db.saveSession({ id: 'session-1', status: 'completed', endedAt: '2026-09-26T12:01:00.000Z' })
    await db.saveSettings({ theme: 'twilight' })
    expect((await db.listSessions())[0].id).toBe('session-1')
    expect(await db.getSettings()).toMatchObject({ theme: 'twilight' })
  })
})
