/** Stored as tinyint in [Sales Order].[Status]. */
export enum SalesOrderStatus {
  ToPlan = 0,
  Planned = 1,
  InDelivery = 2,
}

/** Stored as tinyint in [Transport Order].[Status]. */
export enum TransportOrderStatus {
  Draft = 0,
  Validated = 1,
  Departed = 2,
}

/** Status labels exposed by the API (more explicit than raw tinyints). */
export const SALES_ORDER_STATUS_CODES = {
  [SalesOrderStatus.ToPlan]: 'TO_PLAN',
  [SalesOrderStatus.Planned]: 'PLANNED',
  [SalesOrderStatus.InDelivery]: 'IN_DELIVERY',
} as const;

export const TRANSPORT_ORDER_STATUS_CODES = {
  [TransportOrderStatus.Draft]: 'DRAFT',
  [TransportOrderStatus.Validated]: 'VALIDATED',
  [TransportOrderStatus.Departed]: 'DEPARTED',
} as const;

export type SalesOrderStatusCode =
  (typeof SALES_ORDER_STATUS_CODES)[SalesOrderStatus];
export type TransportOrderStatusCode =
  (typeof TRANSPORT_ORDER_STATUS_CODES)[TransportOrderStatus];

const TRANSPORT_ORDER_STATUS_BY_CODE: Record<
  TransportOrderStatusCode,
  TransportOrderStatus
> = {
  DRAFT: TransportOrderStatus.Draft,
  VALIDATED: TransportOrderStatus.Validated,
  DEPARTED: TransportOrderStatus.Departed,
};

export function transportOrderStatusFromCode(
  code: TransportOrderStatusCode,
): TransportOrderStatus {
  return TRANSPORT_ORDER_STATUS_BY_CODE[code];
}

/** Minimal views of the data the rules need: no persistence concern here. */
export interface VehicleSnapshot {
  code: string;
  capacityKg: number;
  active: boolean;
}

export interface SalesOrderSnapshot {
  no: string;
  weightKg: number;
  status: SalesOrderStatus;
  /** Transport order currently holding this sales order, if any. */
  assignedTo: string | null;
}

export interface TransportOrderSnapshot {
  no: string;
  status: TransportOrderStatus;
}
