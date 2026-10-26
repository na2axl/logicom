import type { PaginationParams } from './base'

export type SalesOrderStatus = 'TO_PLAN' | 'PLANNED' | 'IN_DELIVERY'

export interface SalesOrderResource {
  no: string
  customerNo: string
  customerName: string
  deliveryCity: string
  totalWeightKg: number
  status: SalesOrderStatus
}

export interface ListSalesOrdersToPlanParams extends PaginationParams {
  city?: string
}
