import { describe, expect, it } from 'vitest'
import { createSessionEvent, dailyLogPath, formatEventMarkdown } from './events.js'

const session = {
  id: 'session-1', mode: 'focus', plannedMs: 1_500_000, actualActiveMs: 900_000,
  startedAt: '2026-09-26T12:30:00.000Z', endedAt: '2026-09-26T12:45:00.000Z',
  activity: { type: 'task', id: 'task-7', title: 'Interaction report' }, status: 'completed'
}

describe('focus event formatting', () => {
  it('creates complete append-only metadata and predictable daily paths', () => {
    const event = createSessionEvent({ session, action: 'completed', eventId: 'evt-1', occurredAt: new Date('2026-09-26T14:45:00+02:00'), timeZone: 'Europe/Brussels' })
    const markdown = formatEventMarkdown(event)

    expect(event.type).toBe('focus.completed')
    expect(event.offset).toBe('UTC+02:00')
    expect(dailyLogPath(event)).toEqual(['Bloom Productivity', 'Bloom Focus', '2026', '09', '2026-09-26.md'])
    expect(markdown).toContain('<!-- bloom-event:evt-1:start -->')
    expect(markdown).toContain('**Actual active duration:** 15 minutes')
    expect(markdown).toContain('**Task ID:** `task-7`')
    expect(markdown).toContain('<!-- bloom-event:evt-1:end -->')
  })

  it('formats break and typed-activity events', () => {
    const event = createSessionEvent({ session: { ...session, mode: 'break', activity: { type: 'text', title: 'Stretch' } }, action: 'cancelled', eventId: 'evt-2', occurredAt: new Date('2026-09-26T14:45:00+02:00'), timeZone: 'Europe/Brussels' })
    const markdown = formatEventMarkdown(event)
    expect(event.type).toBe('break.cancelled')
    expect(markdown).toContain('**Activity:** Stretch')
  })
})
