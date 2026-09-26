import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

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
})
