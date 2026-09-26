function pad(value) { return String(value).padStart(2, '0') }
function localParts(date) {
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` }
}
function utcOffset(date) {
  const minutes = -date.getTimezoneOffset()
  const sign = minutes >= 0 ? '+' : '-'
  return `UTC${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`
}
function duration(ms) {
  const seconds = Math.round((ms || 0) / 1000)
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? '' : 's'}`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
function escapeText(value = '') { return String(value).replace(/\r?\n/g, ' ').trim() }

export function createSessionEvent({ session, action, eventId = crypto.randomUUID(), occurredAt = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time' }) {
  const parts = localParts(occurredAt)
  return {
    id: eventId,
    source: 'Bloom Focus',
    date: parts.date,
    time: parts.time,
    timeZone,
    offset: utcOffset(occurredAt),
    occurredAt: occurredAt.toISOString(),
    type: `${session.mode}.${action}`,
    status: action === 'started' ? 'Running' : action[0].toUpperCase() + action.slice(1),
    sessionId: session.id,
    mode: session.mode,
    plannedMs: session.plannedMs,
    actualActiveMs: session.actualActiveMs ?? session.accumulatedActiveMs ?? 0,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    activity: session.activity,
  }
}

export function dailyLogPath(event) {
  const [year, month] = event.date.split('-')
  return ['Bloom Productivity', 'Bloom Focus', year, month, `${event.date}.md`]
}

export function formatEventMarkdown(event) {
  const title = event.type.replace('.', ' ').replace(/\b\w/g, char => char.toUpperCase())
  const activity = event.activity || { type: 'text', title: event.mode === 'break' ? 'Break' : 'Untitled focus' }
  const lines = [
    `<!-- bloom-event:${event.id}:start -->`,
    `### ${event.time} — ${title}`,
    '',
    `- **Event ID:** \`${event.id}\``,
    `- **Source:** ${event.source}`,
    `- **Date:** ${event.date}`,
    `- **Time:** ${event.time}`,
    `- **Timezone:** ${event.timeZone} (${event.offset})`,
    `- **Event type:** \`${event.type}\``,
    `- **Status:** ${event.status}`,
    `- **Session ID:** \`${event.sessionId}\``,
    `- **Mode:** ${event.mode === 'focus' ? 'Focus' : 'Break'}`,
    `- **Planned duration:** ${duration(event.plannedMs)}`,
    `- **Actual active duration:** ${duration(event.actualActiveMs)}`,
  ]
  if (activity.type === 'task') {
    lines.push(`- **Task ID:** \`${activity.id}\``, `- **Task:** ${escapeText(activity.title)}`)
  } else {
    lines.push(`- **Activity:** ${escapeText(activity.title)}`)
  }
  if (event.startedAt) lines.push(`- **Started:** ${event.startedAt}`)
  if (event.endedAt) lines.push(`- **Ended:** ${event.endedAt}`)
  lines.push('', `<!-- bloom-event:${event.id}:end -->`, '')
  return lines.join('\n')
}
