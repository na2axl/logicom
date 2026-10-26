export type CapacityLevel = 'low' | 'medium' | 'high' | 'full'

export interface CapacityUsage {
  percent: number
  remainingKg: number
  level: CapacityLevel
}

const MEDIUM_THRESHOLD = 0.5
const HIGH_THRESHOLD = 0.9

/** Weights are decimal(10,2): work in hundredths of a kg to avoid float drift. */
export const toHundredths = (kg: number): number => Math.round(kg * 100)

export function sumWeightsKg(weightsKg: readonly number[]): number {
  return weightsKg.reduce((total, kg) => total + toHundredths(kg), 0) / 100
}

function levelOf(ratio: number): CapacityLevel {
  if (ratio >= 1) return 'full'
  if (ratio >= HIGH_THRESHOLD) return 'high'
  if (ratio >= MEDIUM_THRESHOLD) return 'medium'
  return 'low'
}

export function capacityUsage(weightKg: number, capacityKg: number): CapacityUsage {
  const weight = toHundredths(weightKg)
  const capacity = toHundredths(capacityKg)
  const ratio = capacity > 0 ? weight / capacity : 1
  return {
    percent: Math.round(ratio * 100),
    remainingKg: Math.max(capacity - weight, 0) / 100,
    level: levelOf(ratio),
  }
}
