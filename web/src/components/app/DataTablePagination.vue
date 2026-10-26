<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Server-side pagination controls (1-based page). */
const props = defineProps<{
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{ change: [page: number, pageSize: number] }>()

const PAGE_SIZES = [10, 20, 50]

const { t } = useI18n()
const pageCount = computed(() => Math.max(Math.ceil(props.total / props.pageSize), 1))

function changePageSize(value: unknown): void {
  const size = Number(value)
  if (PAGE_SIZES.includes(size)) emit('change', 1, size)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
    <span data-test="total">{{ t('pagination.total', { count: total }, total) }}</span>
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <span>{{ t('pagination.pageSize') }}</span>
        <Select :model-value="String(pageSize)" @update:model-value="changePageSize">
          <SelectTrigger size="sm" class="w-18" :aria-label="t('pagination.pageSize')">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <span data-test="page-indicator">
        {{ t('pagination.page', { page, count: pageCount }) }}
      </span>
      <div class="flex gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          :aria-label="t('pagination.previous')"
          :disabled="page <= 1"
          @click="emit('change', page - 1, pageSize)"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          :aria-label="t('pagination.next')"
          :disabled="page >= pageCount"
          data-test="next-page"
          @click="emit('change', page + 1, pageSize)"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  </div>
</template>
