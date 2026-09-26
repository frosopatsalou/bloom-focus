import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { bloomDb } from '../data/database.js'
import { createSessionEvent } from '../domain/events.js'
import { calculateFlower } from '../domain/flower.js'
import { createTimer, finishTimer, pauseTimer, recoverTimer, resumeTimer, snapshotTimer, startTimer } from '../domain/timer.js'
import { browserVault } from '../services/vault.js'
import { completionChime } from '../services/audio.js'

const defaults = {
  focusMinutes: 25, breakMinutes: 5, theme: 'garden', animation: true,
  notifications: false, completionSound: true, ambient: 'rain', ambientVolume: 0.22,
}
const uid = prefix => `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`

export const useFocusStore = defineStore('focus', () => {
  const initialized = ref(false)
  const mode = ref('focus')
  const timer = ref(null)
  const now = ref(Date.now())
  const history = ref([])
  const tasks = ref([])
  const activityText = ref('')
  const selectedTaskId = ref('')
  const settings = ref({ ...defaults })
  const pending = ref([])
  const vaultHandle = ref(null)
  const vaultStatus = ref('Not connected')
  const vaultError = ref('')
  const completionPrompt = ref(false)
  const notice = ref('Ready for one meaningful thing.')
  let ticker

  const timerView = computed(() => timer.value ? snapshotTimer(timer.value, now.value) : null)
  const state = computed(() => timer.value?.state || 'ready')
  const durationMinutes = computed(() => mode.value === 'focus' ? settings.value.focusMinutes : settings.value.breakMinutes)
  const selectedActivity = computed(() => {
    const task = tasks.value.find(item => item.id === selectedTaskId.value)
    return task ? { type: 'task', id: task.id, title: task.title } : { type: 'text', title: activityText.value.trim() || (mode.value === 'break' ? 'Rest and reset' : 'Open focus session') }
  })
  const flower = computed(() => calculateFlower(history.value, new Date(now.value)))

  async function initialize() {
    settings.value = { ...defaults, ...(await bloomDb.getSettings()) }
    history.value = await bloomDb.listSessions()
    pending.value = await bloomDb.listPendingEvents()
    tasks.value = await bloomDb.listTasks()
    vaultHandle.value = await bloomDb.getVaultHandle()
    if (vaultHandle.value) {
      try {
        vaultStatus.value = await browserVault.canWrite(vaultHandle.value) ? 'Connected' : 'Reconnect required'
        if (vaultStatus.value === 'Connected') await refreshTasks()
      } catch { vaultStatus.value = 'Reconnect required' }
    }
    const saved = await bloomDb.getActiveTimer()
    if (saved) {
      timer.value = saved
      mode.value = saved.mode
      const recovered = recoverTimer(saved, Date.now())
      if (recovered.needsCompletion) {
        completionPrompt.value = true
        notice.value = 'This timer elapsed while Bloom Focus was closed.'
      }
    }
    initialized.value = true
    ticker = window.setInterval(tick, 250)
  }

  async function saveSettings() { await bloomDb.saveSettings({ ...settings.value }) }
  async function updateSettings(patch) { settings.value = { ...settings.value, ...patch }; await saveSettings() }
  function setMode(next) {
    if (['running', 'paused'].includes(state.value)) return
    mode.value = next
    timer.value = null
    completionPrompt.value = false
    notice.value = next === 'focus' ? 'Ready for one meaningful thing.' : 'A break is part of the work.'
    bloomDb.setActiveTimer(null)
  }
  async function usePreset(focus, rest) {
    await updateSettings({ focusMinutes: focus, breakMinutes: rest })
    if (!['running', 'paused'].includes(state.value)) timer.value = null
  }
  async function queueAction(session, action, occurredAt = new Date()) {
    const event = createSessionEvent({ session, action, eventId: uid('evt'), occurredAt })
    await bloomDb.enqueueEvent(event)
    pending.value = await bloomDb.listPendingEvents()
    if (vaultStatus.value === 'Connected') await retryPending()
  }
  async function begin() {
    const plannedSeconds = Math.max(1, Math.round(durationMinutes.value * 60))
    let next = createTimer({ id: uid('session'), mode: mode.value, plannedSeconds, activity: selectedActivity.value, now: Date.now() })
    next = startTimer(next, Date.now())
    timer.value = next
    await bloomDb.setActiveTimer(next)
    await queueAction(next, 'started', new Date(next.startedAt))
    notice.value = mode.value === 'focus' ? 'Focus is growing. Paused time will not count.' : 'Break running. Breathe and reset.'
  }
  async function pause() {
    timer.value = pauseTimer(timer.value, Date.now())
    notice.value = 'Paused. Paused time is excluded from your active duration.'
    await bloomDb.setActiveTimer(timer.value)
  }
  async function resume() {
    timer.value = resumeTimer(timer.value, Date.now())
    notice.value = 'Resumed.'
    await bloomDb.setActiveTimer(timer.value)
  }
  async function finalize(status, completionTime = Date.now()) {
    if (!timer.value || ['completed', 'cancelled'].includes(timer.value.state)) return
    const session = finishTimer(timer.value, status, completionTime)
    timer.value = session
    history.value = [session, ...history.value.filter(item => item.id !== session.id)]
    await bloomDb.saveSession(session)
    await bloomDb.setActiveTimer(null)
    await queueAction(session, status, new Date(session.endedAt))
    completionPrompt.value = false
    notice.value = status === 'completed' ? `${mode.value === 'focus' ? 'Focus session' : 'Break'} completed${session.completionKind === 'early' ? ' early' : ''}.` : `${mode.value === 'focus' ? 'Focus session' : 'Break'} cancelled.`
    if (status === 'completed') await celebrate()
  }
  async function celebrate() {
    if (settings.value.completionSound) completionChime().catch(() => {})
    if (settings.value.notifications && Notification.permission === 'granted') {
      new Notification(mode.value === 'focus' ? 'Focus complete' : 'Break complete', { body: selectedActivity.value.title, icon: '/icon.svg' })
    }
  }
  async function requestNotifications() {
    if (!('Notification' in window)) return updateSettings({ notifications: false })
    const result = await Notification.requestPermission()
    await updateSettings({ notifications: result === 'granted' })
  }
  async function tick() {
    now.value = Date.now()
    if (timer.value?.state === 'running' && timerView.value.remainingMs === 0 && !completionPrompt.value) await finalize('completed', Date.now())
  }
  async function acceptRecoveredCompletion() { await finalize('completed', Date.now()) }
  async function cancelRecoveredCompletion() { await finalize('cancelled', Date.now()) }
  async function restart() { timer.value = null; completionPrompt.value = false; await bloomDb.setActiveTimer(null); notice.value = 'Ready to begin again.' }

  async function connectVault() {
    if (!browserVault.supported) { vaultStatus.value = 'Error'; vaultError.value = 'Folder access needs desktop Chrome or Edge.'; return }
    try {
      vaultHandle.value = await browserVault.choose()
      await bloomDb.setVaultHandle(vaultHandle.value)
      vaultStatus.value = 'Connected'
      vaultError.value = ''
      await refreshTasks()
      await retryPending()
    } catch (error) {
      if (error.name !== 'AbortError') { vaultStatus.value = 'Error'; vaultError.value = error.message }
    }
  }
  async function refreshTasks() {
    if (!vaultHandle.value) return
    try {
      tasks.value = await browserVault.readTasks(vaultHandle.value)
      await bloomDb.saveTasks(tasks.value)
    } catch (error) { vaultStatus.value = 'Reconnect required'; vaultError.value = error.message }
  }
  async function retryPending() {
    if (!vaultHandle.value) { vaultStatus.value = 'Reconnect required'; return }
    vaultStatus.value = 'Syncing'
    vaultError.value = ''
    for (const event of await bloomDb.listPendingEvents()) {
      try {
        await browserVault.writeEvent(vaultHandle.value, event)
        await bloomDb.markEventSynced(event.id)
      } catch (error) {
        vaultStatus.value = 'Error'
        vaultError.value = error.message
        break
      }
    }
    pending.value = await bloomDb.listPendingEvents()
    if (!pending.value.length && vaultStatus.value !== 'Error') vaultStatus.value = 'Connected'
  }
  function dispose() { clearInterval(ticker) }

  return {
    initialized, mode, timer, timerView, state, history, tasks, activityText, selectedTaskId,
    settings, pending, vaultStatus, vaultError, completionPrompt, notice, durationMinutes,
    selectedActivity, flower, initialize, updateSettings, setMode, usePreset, begin, pause,
    resume, finalize, restart, acceptRecoveredCompletion, cancelRecoveredCompletion,
    connectVault, retryPending, refreshTasks, requestNotifications, dispose,
  }
})
