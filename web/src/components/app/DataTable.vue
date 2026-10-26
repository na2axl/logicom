<script setup lang="ts" generic="TFeatures extends TableFeatures, TData extends RowData">
import { FlexRender, type RowData, type TableFeatures, type VueTable } from '@tanstack/vue-table'
import { computed } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Renders a TanStack table with the shadcn-vue table primitives.
 * Columns declare `meta.align` / `meta.class`; the table stays headless.
 */
const props = defineProps<{
  table: VueTable<TFeatures, TData>
  loading: boolean
  emptyText: string
  /** Rows shown as skeletons on the very first load. */
  skeletonRows?: number
  /** Rows emit `rowClick` and show a pointer. */
  clickable?: boolean
  isSelected?: (row: TData) => boolean
}>()

const emit = defineEmits<{ rowClick: [row: TData] }>()

/** Presentation hints a column may declare in `meta`. */
interface ColumnPresentation {
  align?: 'right'
  class?: string
}

const metaOf = (column: { columnDef: { meta?: unknown } }): ColumnPresentation =>
  (column.columnDef.meta ?? {}) as ColumnPresentation

const columnCount = computed(() => props.table.getAllLeafColumns().length)
const rows = computed(() => props.table.getRowModel().rows)
const firstLoad = computed(() => props.loading && rows.value.length === 0)
</script>

<template>
  <div class="overflow-hidden rounded-lg border bg-card" :aria-busy="loading">
    <Table>
      <TableHeader class="bg-muted/50">
        <TableRow v-for="group in table.getHeaderGroups()" :key="group.id">
          <TableHead
            v-for="header in group.headers"
            :key="header.id"
            :class="[
              metaOf(header.column).class,
              { 'text-right': metaOf(header.column).align === 'right' },
            ]"
          >
            <FlexRender v-if="!header.isPlaceholder" :header="header" />
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody :class="{ 'opacity-60 transition-opacity': loading && !firstLoad }">
        <template v-if="firstLoad">
          <TableRow v-for="index in skeletonRows ?? 5" :key="index">
            <TableCell v-for="column in columnCount" :key="column">
              <Skeleton class="h-5 w-full" />
            </TableCell>
          </TableRow>
        </template>

        <template v-else-if="rows.length > 0">
          <TableRow
            v-for="row in rows"
            :key="row.id"
            :data-state="isSelected?.(row.original) ? 'selected' : undefined"
            :class="{ 'cursor-pointer': clickable }"
            @click="clickable && emit('rowClick', row.original)"
          >
            <TableCell
              v-for="cell in row.getAllCells()"
              :key="cell.id"
              :class="[
                metaOf(cell.column).class,
                { 'text-right tabular-nums': metaOf(cell.column).align === 'right' },
              ]"
            >
              <FlexRender :cell="cell" />
            </TableCell>
          </TableRow>
        </template>

        <TableEmpty v-else :colspan="columnCount">
          <span class="text-muted-foreground">{{ emptyText }}</span>
        </TableEmpty>
      </TableBody>
    </Table>
  </div>
</template>
