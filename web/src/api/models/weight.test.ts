import { describe, expect, it } from 'vitest'
import { capacityUsage, sumWeightsKg } from './weight'

describe('capacityUsage', () => {
  it('computes the fill ratio and remaining weight', () => {
    expect(capacityUsage(1360, 1500)).toEqual({ percent: 91, remainingKg: 140, level: 'high' })
  })

  it.each([
    [0, 'low'],
    [749.99, 'low'],
    [750, 'medium'],
    [1349.99, 'medium'],
    [1350, 'high'],
    [1500, 'full'],
  ] as const)('classifies %s kg out of 1500 kg as %s', (weight, level) => {
    expect(capacityUsage(weight, 1500).level).toBe(level)
  })

  it('handles a vehicle without capacity without dividing by zero', () => {
    expect(capacityUsage(0, 0)).toEqual({ percent: 100, remainingKg: 0, level: 'full' })
  })
})

describe('sumWeightsKg', () => {
  it('sums decimal weights without float drift', () => {
    expect(sumWeightsKg([0.1, 0.2])).toBe(0.3)
    expect(sumWeightsKg([])).toBe(0)
  })
})
