import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
} from '@tanstack/vue-table'
import { h } from 'vue'
import type { SalesOrderModel } from '@/api/models'
import { Checkbox } from '@/components/ui/checkbox'
import { formatKg } from '@/utils/format'

export const salesOrderTableFeatures = tableFeatures({ rowSelectionFeature })

const column = createColumnHelper<typeof salesOrderTableFeatures, SalesOrderModel>()

type Translate = (key: string) => string

/** Headers are functions so they follow the locale. */
export function salesOrderColumns(t: Translate) {
  return column.columns([
    column.display({
      id: 'select',
      meta: { class: 'w-10' },
      header: ({ table }) =>
        h(Checkbox, {
          modelValue: table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false,
          'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
            table.toggleAllPageRowsSelected(value === true),
          'aria-label': t('salesOrders.selectPage'),
          'data-test': 'select-page',
        }),
      cell: ({ row }) =>
        h(Checkbox, {
          modelValue: row.getIsSelected(),
          'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
            row.toggleSelected(value === true),
          // The row itself toggles on click: don't toggle twice.
          onClick: (event: Event) => event.stopPropagation(),
          'aria-label': t('salesOrders.selectRow'),
          'data-test': `select-${row.original.no}`,
        }),
    }),
    column.accessor((order) => order.no, {
      id: 'no',
      header: () => t('salesOrders.no'),
      cell: (info) => h('span', { class: 'font-medium' }, info.getValue()),
    }),
    column.display({
      id: 'customer',
      header: () => t('salesOrders.customer'),
      cell: ({ row }) =>
        h('div', { class: 'flex flex-col' }, [
          h('span', row.original.customerName),
          h('span', { class: 'text-xs text-muted-foreground' }, row.original.customerNo),
        ]),
    }),
    column.accessor((order) => order.deliveryCity, {
      id: 'deliveryCity',
      header: () => t('salesOrders.city'),
    }),
    column.accessor((order) => order.weightKg, {
      id: 'weight',
      header: () => t('salesOrders.weight'),
      meta: { align: 'right' },
      cell: (info) => formatKg(info.getValue()),
    }),
  ])
}
