import { createColumnHelper, tableFeatures } from '@tanstack/vue-table'
import { h } from 'vue'
import type { TransportOrderSummaryModel } from '@/api/models'
import { formatDate, formatKg } from '@/utils/format'
import CapacityGauge from './CapacityGauge.vue'
import StatusBadge from './StatusBadge.vue'

export const transportOrderTableFeatures = tableFeatures({})

const column = createColumnHelper<typeof transportOrderTableFeatures, TransportOrderSummaryModel>()

type Translate = (key: string) => string

/** Headers are functions so they follow the locale. */
export function transportOrderColumns(t: Translate) {
  return column.columns([
    column.accessor((order) => order.no, {
      id: 'no',
      header: () => t('transportOrders.no'),
      cell: (info) => h('span', { class: 'font-medium' }, info.getValue()),
    }),
    column.accessor((order) => order.status, {
      id: 'status',
      header: () => t('transportOrders.status'),
      cell: (info) => h(StatusBadge, { status: info.getValue() }),
    }),
    column.accessor((order) => order.deliveryDate, {
      id: 'deliveryDate',
      header: () => t('transportOrders.deliveryDate'),
      cell: (info) => formatDate(info.getValue()),
    }),
    column.display({
      id: 'vehicle',
      header: () => t('transportOrders.vehicle'),
      cell: ({ row }) =>
        h('div', { class: 'flex flex-col' }, [
          h('span', row.original.vehicleCode),
          h('span', { class: 'text-xs text-muted-foreground' }, row.original.vehiclePlateNo),
        ]),
    }),
    column.accessor((order) => order.salesOrderCount, {
      id: 'salesOrderCount',
      header: () => t('transportOrders.salesOrders'),
      meta: { align: 'right' },
    }),
    column.display({
      id: 'load',
      header: () => t('transportOrders.load'),
      meta: { class: 'w-48' },
      cell: ({ row }) =>
        h('div', { class: 'flex flex-col gap-1' }, [
          h('span', { class: 'text-xs tabular-nums' }, `${formatKg(row.original.weightKg)} / ${formatKg(row.original.capacityKg)}`),
          h(CapacityGauge, {
            weightKg: row.original.weightKg,
            capacityKg: row.original.capacityKg,
            compact: true,
          }),
        ]),
    }),
  ])
}
