import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/vue-query'
import { TransportOrderModel, TransportOrderSummaryModel } from '@/api/models'
import type {
  AddSalesOrdersRequest,
  CreateTransportOrderRequest,
  ListTransportOrdersParams,
  PaginatedEnvelope,
  TransportOrderResource,
  TransportOrderSummaryResource,
} from '@/api/resources'
import type { ApiClient } from '@/api/transport'
import { queryKeys } from './keys'

const toPage = (response: PaginatedEnvelope<TransportOrderSummaryResource>) => ({
  items: TransportOrderSummaryModel.collection(response.items),
  total: response.total,
})

const toModel = (resource: TransportOrderResource) => new TransportOrderModel(resource)

const path = (no: string) => `/transport-orders/${encodeURIComponent(no)}`

/** Upper bound accepted by the API for one page. */
const MAX_PAGE_SIZE = 100

export function transportOrderQueries(client: ApiClient) {
  return {
    list: (params: ListTransportOrdersParams) =>
      queryOptions({
        queryKey: queryKeys.transportOrders.list(params),
        queryFn: ({ signal }) =>
          client.get<PaginatedEnvelope<TransportOrderSummaryResource>>('/transport-orders', {
            query: { ...params },
            signal,
          }),
        select: toPage,
        placeholderData: keepPreviousData,
        staleTime: 15_000,
      }),

    /** Draft orders, candidates to receive sales orders. */
    drafts: () =>
      queryOptions({
        queryKey: queryKeys.transportOrders.list({
          status: 'DRAFT',
          page: 1,
          pageSize: MAX_PAGE_SIZE,
        }),
        queryFn: ({ signal }) =>
          client.get<PaginatedEnvelope<TransportOrderSummaryResource>>('/transport-orders', {
            query: { status: 'DRAFT', page: 1, pageSize: MAX_PAGE_SIZE },
            signal,
          }),
        select: (response) => TransportOrderSummaryModel.collection(response.items),
      }),

    detail: (no: string) =>
      queryOptions({
        queryKey: queryKeys.transportOrders.detail(no),
        queryFn: ({ signal }) => client.get<TransportOrderResource>(path(no), { signal }),
        select: toModel,
      }),
  }
}

/**
 * Every mutation returns the updated order. `version` is the rowversion the
 * user is looking at: the API answers 409 if the order changed since.
 */
export function transportOrderMutations(client: ApiClient) {
  return {
    create: () =>
      mutationOptions({
        mutationFn: (request: CreateTransportOrderRequest) =>
          client.post<TransportOrderResource>('/transport-orders', request),
      }),

    addSalesOrders: () =>
      mutationOptions({
        mutationFn: ({ no, version, ...request }: AddSalesOrdersRequest & { no: string; version?: string }) =>
          client.post<TransportOrderResource>(`${path(no)}/lines`, request, { ifMatch: version }),
      }),

    removeSalesOrder: (no: string) =>
      mutationOptions({
        mutationFn: ({ salesOrderNo, version }: { salesOrderNo: string; version: string }) =>
          client.delete<TransportOrderResource>(
            `${path(no)}/lines/${encodeURIComponent(salesOrderNo)}`,
            { ifMatch: version },
          ),
      }),

    validate: (no: string) =>
      mutationOptions({
        mutationFn: ({ version }: { version: string }) =>
          client.post<TransportOrderResource>(`${path(no)}/validate`, undefined, {
            ifMatch: version,
          }),
      }),

    depart: (no: string) =>
      mutationOptions({
        mutationFn: ({ version }: { version: string }) =>
          client.post<TransportOrderResource>(`${path(no)}/depart`, undefined, {
            ifMatch: version,
          }),
      }),
  }
}
