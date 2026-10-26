import type { ISODate, PaginationParams } from './base'
import type { SalesOrderResource } from './sales-orders'

export type TransportOrderStatus = 'DRAFT' | 'VALIDATED' | 'DEPARTED'

export const TRANSPORT_ORDER_STATUSES: readonly TransportOrderStatus[] = [
  'DRAFT',
  'VALIDATED',
  'DEPARTED',
]

export interface TransportOrderSummaryResource {
  no: string
  vehicleCode: string
  vehiclePlateNo: string
  vehicleCapacityKg: number
  deliveryDate: ISODate
  status: TransportOrderStatus
  createdBy: string
  validatedBy: string | null
  salesOrderCount: number
  totalWeightKg: number
}

export interface TransportOrderResource extends TransportOrderSummaryResource {
  /** Hex rowversion, sent back in If-Match. */
  version: string
  salesOrders: SalesOrderResource[]
}

export interface ListTransportOrdersParams extends PaginationParams {
  status?: TransportOrderStatus
  deliveryDate?: ISODate
}

export interface CreateTransportOrderRequest {
  vehicleCode: string
  deliveryDate: ISODate
}

export interface AddSalesOrdersRequest {
  salesOrderNos: string[]
}
