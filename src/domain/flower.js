function dateKey(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localWeekStart(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  return start
}

export function localWeekKey(now = new Date()) { return dateKey(localWeekStart(now)) }

export function calculateFlower(sessions, now = new Date()) {
  const start = localWeekStart(now)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const ids = new Set(
    sessions
      .filter(session => session.mode === 'focus' && session.status === 'completed' && session.endedAt)
      .filter(session => {
        const ended = new Date(session.endedAt)
        return ended >= start && ended < end
      })
      .map(session => session.id),
  )
  return { weekKey: dateKey(start), count: ids.size, stage: Math.min(5, ids.size) }
}
