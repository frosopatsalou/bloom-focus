const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createTimer({ id, mode, plannedSeconds, activity, now = Date.now() }) {
  const plannedMs = Math.max(1, Number(plannedSeconds)) * 1000
  return {
    id, mode, activity, state: 'ready', status: 'ready', plannedMs,
    remainingMs: plannedMs, accumulatedActiveMs: 0, createdAt: new Date(now).toISOString(),
    startedAt: null, runStartedAt: null, pausedAt: null, endedAt: null,
  }
}

export function startTimer(timer, now = Date.now()) {
  if (timer.state !== 'ready') return timer
  return { ...timer, state: 'running', status: 'running', startedAt: new Date(now).toISOString(), runStartedAt: now }
}

export function snapshotTimer(timer, now = Date.now()) {
  if (timer.state !== 'running') {
    return { ...timer, actualActiveMs: timer.accumulatedActiveMs }
  }
  const elapsed = clamp(now - timer.runStartedAt, 0, timer.remainingMs)
  return {
    ...timer,
    remainingMs: timer.remainingMs - elapsed,
    actualActiveMs: timer.accumulatedActiveMs + elapsed,
  }
}

export function pauseTimer(timer, now = Date.now()) {
  if (timer.state !== 'running') return timer
  const view = snapshotTimer(timer, now)
  return {
    ...timer, state: 'paused', status: 'paused', remainingMs: view.remainingMs,
    accumulatedActiveMs: view.actualActiveMs, runStartedAt: null, pausedAt: new Date(now).toISOString(),
  }
}

export function resumeTimer(timer, now = Date.now()) {
  if (timer.state !== 'paused') return timer
  return { ...timer, state: 'running', status: 'running', runStartedAt: now, pausedAt: null }
}

export function finishTimer(timer, status, now = Date.now()) {
  if (!['completed', 'cancelled'].includes(status)) throw new Error(`Unsupported final status: ${status}`)
  const view = snapshotTimer(timer, now)
  return {
    ...timer,
    state: status,
    status,
    remainingMs: view.remainingMs,
    accumulatedActiveMs: view.actualActiveMs,
    actualActiveMs: view.actualActiveMs,
    runStartedAt: null,
    endedAt: new Date(now).toISOString(),
    completionKind: status === 'completed' ? (view.remainingMs === 0 ? 'normal' : 'early') : null,
  }
}

export function recoverTimer(timer, now = Date.now()) {
  const snapshot = snapshotTimer(timer, now)
  return { snapshot, needsCompletion: timer.state === 'running' && snapshot.remainingMs === 0 }
}

export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60).toString().padStart(2, '0')
  const seconds = (total % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}
