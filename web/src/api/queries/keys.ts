import type { ListSalesOrdersToPlanParams, ListTransportOrdersParams } from '@/api/resources'

export const queryKeys = {
  users: {
    all: ['users'] as const,
  },
  vehicles: {
    active: ['vehicles', 'active'] as const,
  },
  salesOrders: {
    all: ['sales-orders'] as const,
    toPlan: (params: ListSalesOrdersToPlanParams) => ['sales-orders', 'to-plan', params] as const,
    cities: ['sales-orders', 'cities'] as const,
  },
  transportOrders: {
    lists: ['transport-orders', 'list'] as const,
    list: (params: ListTransportOrdersParams) => ['transport-orders', 'list', params] as const,
    detail: (no: string) => ['transport-orders', 'detail', no] as const,
  },
} as const
