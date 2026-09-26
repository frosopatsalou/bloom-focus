import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { useFocusStore } from './stores/focus.js'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
})

describe('Bloom Focus application', () => {
  it('renders the ready timer and can start then pause a focus session', async () => {
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Bloom Focus')
    expect(wrapper.text()).toContain('25:00')

    await wrapper.get('#timer-controls button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Pause')
    await wrapper.get('#timer-controls .primary').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Resume')
      expect(wrapper.text()).toContain('Paused time is excluded')
    })
    wrapper.unmount()
  })

  it('offers first-use onboarding with a continue-locally path', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    await vi.waitFor(() => expect(store.initialized).toBe(true))
    store.settings = { ...store.settings, onboardingComplete: false }
    await wrapper.vm.$nextTick()

    const onboarding = wrapper.get('[data-test="onboarding"]')
    expect(onboarding.text()).toContain('local')
    expect(onboarding.text()).toContain('notifications')
    expect(onboarding.text()).toContain('audio')
    expect(onboarding.text()).toContain('vault')

    await wrapper.get('[data-test="continue-local"]').trigger('click')
    await flushPromises()
    expect(store.settings.onboardingComplete).toBe(true)
    expect(wrapper.find('[data-test="onboarding"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('defaults history to completed focus sessions and exposes other records behind a filter', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    store.history = [
      { id: 'focus-done', mode: 'focus', status: 'completed', endedAt: '2026-09-26T12:00:00.000Z', plannedMs: 60_000, actualActiveMs: 60_000, activity: { type: 'text', title: 'Completed focus' } },
      { id: 'focus-cancelled', mode: 'focus', status: 'cancelled', endedAt: '2026-09-26T11:00:00.000Z', plannedMs: 60_000, actualActiveMs: 20_000, activity: { type: 'text', title: 'Cancelled focus' } },
      { id: 'break-done', mode: 'break', status: 'completed', endedAt: '2026-09-26T10:00:00.000Z', plannedMs: 60_000, actualActiveMs: 60_000, activity: { type: 'text', title: 'Completed break' } },
    ]

    await wrapper.get('[aria-label="Open history"]').trigger('click')
    expect(wrapper.get('.history-list').text()).toContain('Completed focus')
    expect(wrapper.get('.history-list').text()).not.toContain('Cancelled focus')
    expect(wrapper.get('.history-list').text()).not.toContain('Completed break')

    await wrapper.get('[data-test="history-all"]').trigger('click')
    expect(wrapper.get('.history-list').text()).toContain('Cancelled focus')
    expect(wrapper.get('.history-list').text()).toContain('Completed break')
    wrapper.unmount()
  })

  it('shows linked task title and ID in session history', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    store.history = [{
      id: 'session-1', mode: 'focus', status: 'completed', endedAt: '2026-09-26T12:00:00.000Z',
      plannedMs: 1_500_000, actualActiveMs: 1_200_000,
      activity: { type: 'task', id: 'task-42', title: 'Review notes' },
    }]

    await wrapper.get('[aria-label="Open history"]').trigger('click')
    expect(wrapper.get('.history-list').text()).toContain('Review notes')
    expect(wrapper.get('.history-list').text()).toContain('task-42')
    wrapper.unmount()
  })

  it('asks for confirmation before Stop cancels an active session', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    await wrapper.get('#timer-controls button').trigger('click')
    await flushPromises()

    await wrapper.get('#timer-controls .danger').trigger('click')
    expect(store.state).toBe('running')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Cancel this focus session?')

    await wrapper.get('[data-test="confirm-stop"]').trigger('click')
    await flushPromises()
    expect(store.state).toBe('cancelled')
    wrapper.unmount()
  })

  it('moves focus into a recovered-session alert dialog', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    await vi.waitFor(() => expect(store.initialized).toBe(true))
    store.settings = { ...store.settings, onboardingComplete: true }
    store.completionPrompt = true
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(wrapper.get('[aria-labelledby="recovery-title"] button').element)
    })
    wrapper.unmount()
  })

  it('moves focus into dialogs, closes on Escape, and restores the opener', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia] } })
    await flushPromises()
    const store = useFocusStore(pinia)
    await vi.waitFor(() => expect(store.initialized).toBe(true))
    store.settings = { ...store.settings, onboardingComplete: true }
    await wrapper.vm.$nextTick()
    const opener = wrapper.get('[aria-label="Open settings"]')
    expect(wrapper.get('.topbar').attributes()).not.toHaveProperty('inert')
    opener.element.focus()

    await opener.trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('.modal .close').element)
    expect(wrapper.get('.topbar').attributes()).toHaveProperty('inert')

    await wrapper.get('.modal').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('.modal').exists()).toBe(false)
    expect(document.activeElement).toBe(opener.element)
    wrapper.unmount()
  })
})
