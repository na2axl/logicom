<script setup lang="ts">
import { PackagePlusIcon, XIcon } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { useTable, type RowSelectionState, type Updater } from '@tanstack/vue-table'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { queries } from '@/api'
import { errorMessage } from '@/i18n'
import type { SalesOrderModel } from '@/api/models'
import type { TransportOrderResource } from '@/api/resources'
import DataTable from '@/components/app/DataTable.vue'
import DataTablePagination from '@/components/app/DataTablePagination.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AddToTransportDialog from '@/features/sales-orders/AddToTransportDialog.vue'
import {
  salesOrderColumns,
  salesOrderTableFeatures,
} from '@/features/sales-orders/sales-order-columns'
import { usePlanningStore } from '@/stores/planning'
import { formatKg } from '@/utils/format'

/** Select needs a non-empty value for "all cities". */
const ALL = 'ALL'

const { t } = useI18n()
const router = useRouter()
const planning = usePlanningStore()
const dialogOpen = ref(false)

const ordersQuery = useQuery(() => queries.salesOrders.toPlan(planning.params))
const citiesQuery = useQuery(queries.salesOrders.cities())

const orders = computed(() => ordersQuery.data.value?.items ?? [])
const total = computed(() => ordersQuery.data.value?.total ?? 0)

watch(total, (count) => {
  if (ordersQuery.isSuccess.value) planning.clampPage(count)
})

// The selection lives in the store (it spans pages); the table only mirrors it.
const rowSelection = computed<RowSelectionState>(() =>
  Object.fromEntries(planning.selectedNos.map((no) => [no, true])),
)

function changeSelection(updater: Updater<RowSelectionState>): void {
  const next = typeof updater === 'function' ? updater(rowSelection.value) : updater
  for (const order of orders.value) {
    const selected = Boolean(next[order.no])
    if (selected !== planning.isSelected(order.no)) planning.toggle(order.$raw, selected)
  }
}

const table = useTable({
  features: salesOrderTableFeatures,
  columns: salesOrderColumns(t),
  data: orders,
  getRowId: (order: SalesOrderModel) => order.no,
  enableRowSelection: true,
  state: computed(() => ({ rowSelection: rowSelection.value })),
  onRowSelectionChange: changeSelection,
})

const emptyText = computed(() =>
  planning.city ? t('salesOrders.emptyForCity', { city: planning.city }) : t('salesOrders.empty'),
)

function changeCity(value: unknown): void {
  planning.setCity(typeof value === 'string' && value !== ALL ? value : null)
}

function toggleRow(order: SalesOrderModel): void {
  planning.toggle(order.$raw, !planning.isSelected(order.no))
}

function onAdded(order: TransportOrderResource): void {
  planning.clearSelection()
  void router.push({ name: 'transport-order', params: { no: order.no } })
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">{{ t('salesOrders.title') }}</h1>

    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="grid gap-2">
        <Label for="city-filter">{{ t('salesOrders.city') }}</Label>
        <Select
          :model-value="planning.city ?? ALL"
          :disabled="citiesQuery.isError.value"
          @update:model-value="changeCity"
        >
          <SelectTrigger id="city-filter" class="w-52" data-test="city-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL">{{ t('salesOrders.allCities') }}</SelectItem>
            <SelectItem v-for="city in citiesQuery.data.value" :key="city" :value="city">
              {{ city }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p v-if="citiesQuery.isError.value" class="flex items-center gap-2 text-xs text-destructive">
          {{ errorMessage(citiesQuery.error.value) }}
          <Button variant="link" size="xs" class="h-auto p-0" @click="citiesQuery.refetch()">
            {{ t('common.retry') }}
          </Button>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted-foreground" data-test="selection-summary">
          {{
            t(
              'salesOrders.selection',
              { count: planning.selection.length, weight: formatKg(planning.selectedWeightKg) },
              planning.selection.length,
            )
          }}
        </span>
        <Button
          v-if="planning.selection.length > 0"
          variant="ghost"
          size="icon-sm"
          :aria-label="t('salesOrders.clearSelection')"
          @click="planning.clearSelection()"
        >
          <XIcon />
        </Button>
        <Button
          :disabled="planning.selection.length === 0"
          data-test="add-to-transport"
          @click="dialogOpen = true"
        >
          <PackagePlusIcon data-icon="inline-start" />
          {{ t('salesOrders.addToTransport') }}
        </Button>
      </div>
    </div>

    <ErrorState
      v-if="ordersQuery.isError.value && !ordersQuery.data.value"
      :error="ordersQuery.error.value"
      @retry="ordersQuery.refetch()"
    />
    <template v-else>
      <DataTable
        :table="table"
        :loading="ordersQuery.isFetching.value"
        :empty-text="emptyText"
        :is-selected="(order) => planning.isSelected(order.no)"
        clickable
        @row-click="toggleRow"
      />
      <DataTablePagination
        :page="planning.page"
        :page-size="planning.pageSize"
        :total="total"
        @change="planning.setPage"
      />
    </template>

    <AddToTransportDialog
      v-model:open="dialogOpen"
      :sales-order-nos="planning.selectedNos"
      :weight-kg="planning.selectedWeightKg"
      @added="onAdded"
      @unavailable="planning.deselect"
    />
  </section>
</template>
