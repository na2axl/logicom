<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { capacityUsage, type CapacityLevel } from '@/api/models'
import { formatKg } from '@/utils/format'

const props = defineProps<{
  weightKg: number
  capacityKg: number
  /** Compact variant for table cells: bar + percent only. */
  compact?: boolean
}>()

const BAR_CLASSES: Record<CapacityLevel, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-sky-500',
  high: 'bg-amber-500',
  full: 'bg-red-500',
}

const { t } = useI18n()
const usage = computed(() => capacityUsage(props.weightKg, props.capacityKg))
const width = computed(() => `${Math.min(usage.value.percent, 100)}%`)
</script>

<template>
  <div class="flex flex-col gap-1.5" :class="{ 'min-w-28': compact }">
    <div
      class="w-full overflow-hidden rounded-full bg-muted"
      :class="compact ? 'h-2' : 'h-2.5'"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="usage.percent"
      :aria-label="t('detail.load')"
      :data-level="usage.level"
    >
      <div class="h-full rounded-full transition-all" :class="BAR_CLASSES[usage.level]" :style="{ width }" />
    </div>
    <span v-if="compact" class="text-xs text-muted-foreground tabular-nums">{{ usage.percent }} %</span>
    <div v-else class="flex flex-wrap justify-between gap-2 text-sm">
      <span data-test="gauge-label">
        {{
          t('detail.gauge', {
            weight: formatKg(weightKg),
            capacity: formatKg(capacityKg),
            percent: usage.percent,
          })
        }}
      </span>
      <span class="text-muted-foreground">
        {{ t('detail.remaining', { remaining: formatKg(usage.remainingKg) }) }}
      </span>
    </div>
  </div>
</template>
