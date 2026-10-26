<script setup lang="ts">
import { PlusIcon } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import { useTable } from '@tanstack/vue-table'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { queries } from '@/api'
import type { TransportOrderSummaryModel } from '@/api/models'
import { TRANSPORT_ORDER_STATUSES, type TransportOrderStatus } from '@/api/resources'
import DataTable from '@/components/app/DataTable.vue'
import DataTablePagination from '@/components/app/DataTablePagination.vue'
import DatePicker from '@/components/app/DatePicker.vue'
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
import CreateTransportOrderDialog from '@/features/transport-orders/CreateTransportOrderDialog.vue'
import {
  transportOrderColumns,
  transportOrderTableFeatures,
} from '@/features/transport-orders/transport-order-columns'
import { useTransportOrderFiltersStore } from '@/stores/transport-order-filters'

/** Select needs a non-empty value for "all statuses". */
const ALL = 'ALL'

const { t } = useI18n()
const router = useRouter()
const filters = useTransportOrderFiltersStore()
const createOpen = ref(false)

const ordersQuery = useQuery(() => queries.transportOrders.list(filters.params))
const orders = computed(() => ordersQuery.data.value?.items ?? [])
const total = computed(() => ordersQuery.data.value?.total ?? 0)

watch(total, (count) => {
  if (ordersQuery.isSuccess.value) filters.clampPage(count)
})

const table = useTable({
  features: transportOrderTableFeatures,
  columns: transportOrderColumns(t),
  data: orders,
  getRowId: (order: TransportOrderSummaryModel) => order.no,
})

function changeStatus(value: unknown): void {
  const status = TRANSPORT_ORDER_STATUSES.find((candidate) => candidate === value)
  filters.setStatus(status ?? null)
}

function open(order: { no: string }): void {
  void router.push({ name: 'transport-order', params: { no: order.no } })
}

const statusValue = computed<TransportOrderStatus | typeof ALL>(() => filters.status ?? ALL)
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('transportOrders.title') }}</h1>
      <Button data-test="new-order" @click="createOpen = true">
        <PlusIcon data-icon="inline-start" />
        {{ t('transportOrders.new') }}
      </Button>
    </div>

    <div class="flex flex-wrap items-end gap-4">
      <div class="grid gap-2">
        <Label for="status-filter">{{ t('transportOrders.status') }}</Label>
        <Select :model-value="statusValue" @update:model-value="changeStatus">
          <SelectTrigger id="status-filter" class="w-44" data-test="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL">{{ t('common.all') }}</SelectItem>
            <SelectItem v-for="status in TRANSPORT_ORDER_STATUSES" :key="status" :value="status">
              {{ t(`transportOrderStatus.${status}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="grid gap-2">
        <Label>{{ t('transportOrders.deliveryDate') }}</Label>
        <DatePicker
          :model-value="filters.deliveryDate"
          :placeholder="t('transportOrders.deliveryDate')"
          clearable
          @update:model-value="filters.setDeliveryDate"
        />
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
        :empty-text="t('transportOrders.empty')"
        clickable
        @row-click="open"
      />
      <DataTablePagination
        :page="filters.page"
        :page-size="filters.pageSize"
        :total="total"
        @change="filters.setPage"
      />
    </template>

    <CreateTransportOrderDialog v-model:open="createOpen" @created="open" />
  </section>
</template>
