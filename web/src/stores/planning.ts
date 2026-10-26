import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sumWeightsKg } from '@/api/models'
import type { SalesOrderResource } from '@/api/resources'

const DEFAULT_PAGE_SIZE = 10

/**
 * UI state of the "sales orders to plan" screen. Kept in a store so it
 * survives navigation (back from an order detail lands on the same page).
 */
export const usePlanningStore = defineStore('planning', () => {
  const city = ref<string | null>(null)
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  /** Raw resources, kept across pages so orders from several pages can be grouped. */
  const selection = ref<SalesOrderResource[]>([])

  const params = computed(() => ({
    city: city.value ?? undefined,
    page: page.value,
    pageSize: pageSize.value,
  }))
  const selectedNos = computed(() => selection.value.map((order) => order.no))
  const selectedWeightKg = computed(() =>
    sumWeightsKg(selection.value.map((order) => order.totalWeightKg)),
  )

  function setCity(value: string | null): void {
    city.value = value
    page.value = 1
  }

  function setPage(nextPage: number, nextPageSize = pageSize.value): void {
    page.value = nextPageSize === pageSize.value ? nextPage : 1
    pageSize.value = nextPageSize
  }

  /** Back to the last page when rows vanished (planned elsewhere, filters…). */
  function clampPage(total: number): void {
    const lastPage = Math.max(Math.ceil(total / pageSize.value), 1)
    if (page.value > lastPage) page.value = lastPage
  }

  function isSelected(no: string): boolean {
    return selection.value.some((order) => order.no === no)
  }

  function toggle(order: SalesOrderResource, selected: boolean): void {
    selection.value = selected
      ? [...selection.value.filter((item) => item.no !== order.no), order]
      : selection.value.filter((item) => item.no !== order.no)
  }

  function deselect(nos: readonly string[]): void {
    selection.value = selection.value.filter((order) => !nos.includes(order.no))
  }

  function clearSelection(): void {
    selection.value = []
  }

  return {
    city,
    page,
    pageSize,
    selection,
    params,
    selectedNos,
    selectedWeightKg,
    setCity,
    setPage,
    clampPage,
    isSelected,
    toggle,
    deselect,
    clearSelection,
  }
})
