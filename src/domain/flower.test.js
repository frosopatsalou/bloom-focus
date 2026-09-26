import { describe, expect, it } from 'vitest'
import { calculateFlower, localWeekKey } from './flower.js'

function session(id, endedAt, overrides = {}) {
  return { id, mode: 'focus', status: 'completed', endedAt, ...overrides }
}

describe('weekly focus flower', () => {
  it('counts unique completed focus sessions in the local Monday week', () => {
    const now = new Date(2026, 8, 26, 12)
    const sessions = [
      session('a', new Date(2026, 8, 21, 9).toISOString()),
      session('a', new Date(2026, 8, 21, 10).toISOString()),
      session('b', new Date(2026, 8, 24, 10).toISOString()),
      session('break', new Date(2026, 8, 24, 10).toISOString(), { mode: 'break' }),
      session('cancel', new Date(2026, 8, 24, 10).toISOString(), { status: 'cancelled' }),
      session('old', new Date(2026, 8, 20, 10).toISOString()),
    ]
    expect(calculateFlower(sessions, now)).toMatchObject({ count: 2, stage: 2, weekKey: '2026-09-21' })
  })

  it('resets at Monday local midnight and caps the visible stage at five', () => {
    expect(localWeekKey(new Date(2026, 8, 28, 0, 0, 0))).toBe('2026-09-28')
    const now = new Date(2026, 8, 28, 12)
    const sessions = Array.from({ length: 7 }, (_, i) => session(String(i), new Date(2026, 8, 28, 8, i).toISOString()))
    expect(calculateFlower(sessions, now).stage).toBe(5)
  })
})
