import { keepPreviousData, queryOptions } from '@tanstack/vue-query'
import { SalesOrderModel } from '@/api/models'
import type {
  ListSalesOrdersToPlanParams,
  PaginatedEnvelope,
  SalesOrderResource,
} from '@/api/resources'
import type { ApiClient } from '@/api/transport'
import { queryKeys } from './keys'

const toPage = (response: PaginatedEnvelope<SalesOrderResource>) => ({
  items: SalesOrderModel.collection(response.items),
  total: response.total,
})

export function salesOrderQueries(client: ApiClient) {
  return {
    toPlan: (params: ListSalesOrdersToPlanParams) =>
      queryOptions({
        queryKey: queryKeys.salesOrders.toPlan(params),
        queryFn: ({ signal }) =>
          client.get<PaginatedEnvelope<SalesOrderResource>>('/sales-orders/to-plan', {
            query: { ...params },
            signal,
          }),
        select: toPage,
        // Keep the current page on screen while the next one loads.
        placeholderData: keepPreviousData,
        staleTime: 15_000,
      }),

    cities: () =>
      queryOptions({
        queryKey: queryKeys.salesOrders.cities,
        queryFn: ({ signal }) => client.get<string[]>('/sales-orders/to-plan/cities', { signal }),
        staleTime: 60_000,
      }),
  }
}
