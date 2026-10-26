import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/i18n'
import CapacityGauge from '../CapacityGauge.vue'

const mountGauge = (weightKg: number, capacityKg: number) =>
  mount(CapacityGauge, { props: { weightKg, capacityKg }, global: { plugins: [i18n] } })

describe('CapacityGauge', () => {
  it('shows the load, the percentage and what is left', () => {
    i18n.global.locale.value = 'en'
    const wrapper = mountGauge(1500, 2000)

    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('75')
    expect(bar.attributes('data-level')).toBe('medium')
    expect(wrapper.get('[data-test="gauge-label"]').text()).toBe('1,500 kg of 2,000 kg (75%)')
    expect(wrapper.text()).toContain('500 kg left')
  })

  it('flags a full vehicle and never draws past 100 %', () => {
    const wrapper = mountGauge(2000, 2000)

    const bar = wrapper.get('[role="progressbar"]')
    expect(bar.attributes('data-level')).toBe('full')
    expect(bar.get('div').attributes('style')).toContain('width: 100%')
  })
})
