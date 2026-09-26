import { describe, expect, it } from 'vitest'
import { createTimer, finishTimer, pauseTimer, recoverTimer, resumeTimer, snapshotTimer, startTimer } from './timer.js'

const base = Date.parse('2026-09-26T10:00:00.000Z')

function ready(overrides = {}) {
  return createTimer({ id: 'session-1', mode: 'focus', plannedSeconds: 1500, activity: { type: 'text', title: 'Write report' }, now: base, ...overrides })
}

describe('timer state and active duration', () => {
  it('starts, pauses and excludes paused wall-clock time after resume', () => {
    const running = startTimer(ready(), base)
    const paused = pauseTimer(running, base + 5 * 60_000)
    const resumed = resumeTimer(paused, base + 15 * 60_000)
    const view = snapshotTimer(resumed, base + 20 * 60_000)

    expect(view.state).toBe('running')
    expect(view.remainingMs).toBe(15 * 60_000)
    expect(view.actualActiveMs).toBe(10 * 60_000)
  })

  it('records cancellation and early completion with actual active duration', () => {
    const running = startTimer(ready(), base)
    const cancelled = finishTimer(running, 'cancelled', base + 90_000)
    const completed = finishTimer(startTimer(ready({ id: 'session-2' }), base), 'completed', base + 120_000)

    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.actualActiveMs).toBe(90_000)
    expect(completed.status).toBe('completed')
    expect(completed.completionKind).toBe('early')
  })

  it('detects elapsed recovered timers without silently completing them', () => {
    const running = startTimer(ready({ plannedSeconds: 60 }), base)
    const recovered = recoverTimer(running, base + 75_000)

    expect(recovered.needsCompletion).toBe(true)
    expect(recovered.snapshot.remainingMs).toBe(0)
    expect(recovered.snapshot.actualActiveMs).toBe(60_000)
  })

  it('marks a zero-duration finish as normal completion', () => {
    const running = startTimer(ready({ plannedSeconds: 60 }), base)
    const completed = finishTimer(running, 'completed', base + 60_000)
    expect(completed.completionKind).toBe('normal')
    expect(completed.actualActiveMs).toBe(60_000)
  })
})
