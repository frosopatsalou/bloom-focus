<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFocusStore } from './stores/focus.js'
import { formatClock } from './domain/timer.js'
import { playAmbient, stopAmbient } from './services/audio.js'

const store = useFocusStore()
const { mode, timerView, state, history, tasks, activityText, selectedTaskId, settings, pending, vaultStatus, vaultError, completionPrompt, notice, durationMinutes, selectedActivity, flower } = storeToRefs(store)
const panel = ref(null)
const ambientPlaying = ref(false)
const presets = [{ focus: 25, rest: 5, label: '25 / 5' }, { focus: 25, rest: 5, label: '25 / 5' }, { focus: 30, rest: 10, label: '30 / 10' }]

const time = computed(() => formatClock(timerView.value?.remainingMs ?? durationMinutes.value * 60_000))
const locked = computed(() => ['running', 'paused'].includes(state.value))
const statusClass = computed(() => vaultStatus.value.toLowerCase().replaceAll(' ', '-'))
const historyLabel = session => session.activity?.title || (session.mode === 'break' ? 'Break' : 'Open focus')
const minutes = ms => {
  const total = Math.round((ms || 0) / 1000)
  return total % 60 ? `${Math.floor(total / 60)}m ${total % 60}s` : `${total / 60}m`
}
const dateLabel = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

async function toggleAmbient() {
  if (ambientPlaying.value) { stopAmbient(); ambientPlaying.value = false }
  else { await playAmbient(settings.value.ambient, settings.value.ambientVolume); ambientPlaying.value = true }
}
async function changeSetting(key, value) {
  await store.updateSettings({ [key]: value })
  if (ambientPlaying.value && ['ambient', 'ambientVolume'].includes(key)) await playAmbient(settings.value.ambient, settings.value.ambientVolume)
}
function openPanel(name) { panel.value = name }
function closePanel() { panel.value = null }

watch(() => settings.value.animation, value => document.documentElement.classList.toggle('motion-off', !value), { immediate: true })
onMounted(() => store.initialize())
onBeforeUnmount(() => { store.dispose(); stopAmbient() })
</script>

<template>
  <main class="app-shell" :class="[`theme-${settings.theme}`, { paused: state === 'paused' }]">
    <a class="skip-link" href="#timer-controls">Skip to timer controls</a>
    <div class="scene" aria-hidden="true">
      <span v-for="n in 9" :key="n" class="petal" :style="{ '--i': n }"></span>
      <span class="sun"></span><span class="hill hill-one"></span><span class="hill hill-two"></span>
      <div class="flower-patch"><span></span><span></span><span></span></div>
    </div>

    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">✿</span><span><strong>Bloom Focus</strong><small>Make space for one thing.</small></span></div>
      <nav class="header-actions" aria-label="Application controls">
        <button class="glass-button" type="button" @click="changeSetting('animation', !settings.animation)">Animation {{ settings.animation ? 'on' : 'off' }}</button>
        <button class="glass-button vault-button" type="button" @click="openPanel('vault')"><i :class="statusClass"></i>{{ vaultStatus }}<b v-if="pending.length">{{ pending.length }}</b></button>
        <button class="icon-button" type="button" aria-label="Open history" @click="openPanel('history')">↺</button>
        <button class="icon-button" type="button" aria-label="Open settings" @click="openPanel('settings')">⚙</button>
      </nav>
    </header>

    <section class="timer-zone" aria-labelledby="activity-heading">
      <div class="mode-switch" aria-label="Timer mode">
        <button type="button" :class="{ active: mode === 'focus' }" :disabled="locked" @click="store.setMode('focus')">Focus</button>
        <button type="button" :class="{ active: mode === 'break' }" :disabled="locked" @click="store.setMode('break')">Break</button>
      </div>
      <p id="activity-heading" class="activity-label">{{ mode === 'focus' ? 'You are focusing on' : 'Time to' }}</p>
      <button class="activity-chip" type="button" :disabled="locked" @click="openPanel('activity')">{{ selectedActivity.title }} <span aria-hidden="true">⌄</span></button>
      <output class="timer" aria-live="polite" :aria-label="`${time} remaining`">{{ time }}</output>
      <div id="timer-controls" class="controls">
        <template v-if="state === 'ready'">
          <button class="control primary" type="button" @click="store.begin">Start {{ mode }}</button>
        </template>
        <template v-else-if="state === 'running'">
          <button class="control danger" type="button" @click="store.finalize('cancelled')">Stop</button>
          <button class="control primary" type="button" @click="store.pause">Pause</button>
          <button class="control secondary" type="button" @click="store.finalize('completed')">Complete early</button>
        </template>
        <template v-else-if="state === 'paused'">
          <button class="control danger" type="button" @click="store.finalize('cancelled')">Stop</button>
          <button class="control primary" type="button" @click="store.resume">Resume</button>
          <button class="control secondary" type="button" @click="store.finalize('completed')">Complete early</button>
        </template>
        <template v-else>
          <button class="control primary" type="button" @click="store.restart">Start another</button>
        </template>
      </div>
      <p class="session-note" role="status">{{ notice }}</p>
      <div v-if="state === 'ready'" class="preset-row" aria-label="Suggested focus and break presets">
        <span>Suggested sequence</span>
        <button v-for="(preset, index) in presets" :key="index" type="button" @click="store.usePreset(preset.focus, preset.rest)">{{ index + 1 }} · {{ preset.label }}</button>
      </div>
    </section>

    <footer class="dock">
      <button class="mini-card flower-card" type="button" @click="openPanel('history')">
        <span class="mini-title"><b>This week’s bloom</b><b>{{ flower.count }} / 5</b></span>
        <span class="flower-visual" :class="`stage-${flower.stage}`" aria-hidden="true"><i class="soil"></i><i class="stem"></i><i class="leaf"></i><i class="bud"></i></span>
        <span>{{ flower.stage === 5 ? 'Full bloom reached.' : `${5 - flower.stage} more focus session${5 - flower.stage === 1 ? '' : 's'} to full bloom.` }}</span>
        <span class="progress"><i :style="{ width: `${flower.stage * 20}%` }"></i></span>
      </button>
      <div class="theme-picker" aria-label="Illustrated theme">
        <button v-for="theme in ['garden', 'twilight', 'cloud']" :key="theme" type="button" :class="['theme-dot', theme, { active: settings.theme === theme }]" :aria-label="`${theme} theme`" @click="changeSetting('theme', theme)"></button>
      </div>
      <button class="mini-card ambient-card" type="button" @click="toggleAmbient">
        <span class="mini-title"><b>Ambient sound</b><b>{{ ambientPlaying ? '■' : '♪' }}</b></span>
        <span>{{ ambientPlaying ? `${settings.ambient} playing` : 'Play bundled offline atmosphere' }}</span>
      </button>
    </footer>

    <div v-if="completionPrompt" class="modal-backdrop" role="presentation">
      <section class="modal prompt" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title">
        <span class="modal-mark">✿</span><h2 id="recovery-title">Your timer reached zero</h2>
        <p>Bloom Focus recovered this session after reopening. Confirm how it ended; it has not been silently discarded.</p>
        <div class="modal-actions"><button class="control danger" @click="store.cancelRecoveredCompletion">Mark cancelled</button><button class="control primary" @click="store.acceptRecoveredCompletion">Complete session</button></div>
      </section>
    </div>

    <div v-if="panel" class="modal-backdrop" role="presentation" @click.self="closePanel">
      <section class="modal drawer" role="dialog" aria-modal="true" :aria-label="`${panel} panel`">
        <button class="close" type="button" aria-label="Close panel" @click="closePanel">×</button>

        <template v-if="panel === 'activity'">
          <p class="eyebrow">Activity</p><h2>Choose one thing</h2>
          <label v-if="tasks.length" class="field">Bloom Tasks task<select v-model="selectedTaskId"><option value="">Use typed activity</option><option v-for="task in tasks" :key="task.id" :value="task.id">{{ task.title }}</option></select></label>
          <label class="field">Typed activity<input v-model="activityText" maxlength="100" placeholder="e.g. Review Vue notes" @input="selectedTaskId = ''"></label>
          <p class="help">Tasks are reconstructed from append-only Bloom Tasks records when your vault is readable.</p>
          <button class="control primary full" type="button" @click="closePanel">Use activity</button>
        </template>

        <template v-else-if="panel === 'settings'">
          <p class="eyebrow">Settings</p><h2>Shape your focus space</h2>
          <div class="two-fields"><label class="field">Focus minutes<input type="number" min="1" max="180" :value="settings.focusMinutes" @change="changeSetting('focusMinutes', Math.max(1, Number($event.target.value)))"></label><label class="field">Break minutes<input type="number" min="1" max="60" :value="settings.breakMinutes" @change="changeSetting('breakMinutes', Math.max(1, Number($event.target.value)))"></label></div>
          <label class="toggle"><input type="checkbox" :checked="settings.animation" @change="changeSetting('animation', $event.target.checked)"><span>Animated scenery</span></label>
          <label class="toggle"><input type="checkbox" :checked="settings.completionSound" @change="changeSetting('completionSound', $event.target.checked)"><span>Completion chime</span></label>
          <label class="toggle"><input type="checkbox" :checked="settings.notifications" @change="$event.target.checked ? store.requestNotifications() : changeSetting('notifications', false)"><span>Browser notifications</span></label>
          <label class="field">Ambient sound<select :value="settings.ambient" @change="changeSetting('ambient', $event.target.value)"><option value="rain">Soft rain</option><option value="forest">Forest hush</option><option value="brown">Brown noise</option></select></label>
          <label class="field">Ambient volume<input type="range" min="0" max="0.6" step="0.01" :value="settings.ambientVolume" @input="changeSetting('ambientVolume', Number($event.target.value))"></label>
          <a class="spotify" href="https://open.spotify.com/search/focus" target="_blank" rel="noreferrer">Open focus music on Spotify ↗</a>
        </template>

        <template v-else-if="panel === 'vault'">
          <p class="eyebrow">Obsidian vault</p><h2>{{ vaultStatus }}</h2>
          <p>Events always save locally first. Connected events append to <code>Bloom Productivity/Bloom Focus/YYYY/MM/YYYY-MM-DD.md</code>.</p>
          <div class="queue-summary"><b>{{ pending.length }} pending event{{ pending.length === 1 ? '' : 's' }}</b><span>{{ pending.length ? 'Saved locally and waiting to sync.' : 'All local events are synchronized.' }}</span></div>
          <p v-if="vaultError" class="error-message">{{ vaultError }}</p>
          <div class="modal-actions"><button class="control secondary" @click="store.connectVault">{{ vaultStatus === 'Not connected' ? 'Choose vault' : 'Reconnect' }}</button><button class="control primary" :disabled="!pending.length" @click="store.retryPending">Retry pending</button></div>
          <p class="help">Folder access is supported in desktop Chrome and Edge. Permission may need to be granted again after reopening.</p>
        </template>

        <template v-else-if="panel === 'history'">
          <p class="eyebrow">Session history</p><h2>What you made time for</h2>
          <div v-if="!history.length" class="empty">Completed and cancelled sessions will appear here.</div>
          <ol v-else class="history-list">
            <li v-for="session in history" :key="session.id"><span :class="['history-icon', session.status]">{{ session.mode === 'focus' ? '✿' : '☁' }}</span><div><b>{{ historyLabel(session) }}</b><small>{{ dateLabel(session.endedAt) }} · {{ session.mode }}</small><span>Planned {{ minutes(session.plannedMs) }} · Active {{ minutes(session.actualActiveMs) }}</span></div><em :class="session.status">{{ session.status }}</em></li>
          </ol>
        </template>
      </section>
    </div>
  </main>
</template>
