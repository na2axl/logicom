import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ISODate, TransportOrderStatus } from '@/api/resources'

export const useTransportOrderFiltersStore = defineStore('transportOrderFilters', () => {
  const status = ref<TransportOrderStatus | null>(null)
  const deliveryDate = ref<ISODate | null>(null)
  const page = ref(1)
  const pageSize = ref(10)

  const params = computed(() => ({
    status: status.value ?? undefined,
    deliveryDate: deliveryDate.value ?? undefined,
    page: page.value,
    pageSize: pageSize.value,
  }))

  function setStatus(value: TransportOrderStatus | null): void {
    status.value = value
    page.value = 1
  }

  function setDeliveryDate(value: ISODate | null): void {
    deliveryDate.value = value
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

  return {
    status,
    deliveryDate,
    page,
    pageSize,
    params,
    setStatus,
    setDeliveryDate,
    setPage,
    clampPage,
  }
})
