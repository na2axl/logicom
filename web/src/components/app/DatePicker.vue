<script setup lang="ts">
import { CalendarIcon, XIcon } from '@lucide/vue'
import { parseDate, today, type DateValue } from '@internationalized/date'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ISODate } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/utils/format'

const model = defineModel<ISODate | null>({ required: true })

const props = defineProps<{
  placeholder: string
  /** Disallow days before today (guidance only: the API is the judge). */
  futureOnly?: boolean
  clearable?: boolean
}>()

/** Same zone as the API's APP_TIMEZONE: "today" is the business day. */
const BUSINESS_TIME_ZONE = import.meta.env.VITE_APP_TIMEZONE ?? 'Africa/Douala'

const { t, locale } = useI18n()
const open = ref(false)

const value = computed<DateValue | undefined>(() =>
  model.value ? parseDate(model.value) : undefined,
)
const minValue = computed(() => (props.futureOnly ? today(BUSINESS_TIME_ZONE) : undefined))

function select(date: DateValue | undefined): void {
  // DateValue.toString() is already YYYY-MM-DD.
  model.value = date ? date.toString() : null
  open.value = false
}
</script>

<template>
  <div class="flex items-center gap-1">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          class="w-full min-w-44 justify-start font-normal"
          :class="{ 'text-muted-foreground': !model }"
          data-test="date-picker"
        >
          <CalendarIcon data-icon="inline-start" />
          {{ model ? formatDate(model) : placeholder }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar
          :model-value="value"
          :min-value="minValue"
          :locale="locale"
          initial-focus
          @update:model-value="select"
        />
      </PopoverContent>
    </Popover>
    <Button
      v-if="clearable && model"
      variant="ghost"
      size="icon-sm"
      :aria-label="t('transportOrders.clearDate')"
      @click="model = null"
    >
      <XIcon />
    </Button>
  </div>
</template>
