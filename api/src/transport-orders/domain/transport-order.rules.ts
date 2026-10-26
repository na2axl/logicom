import { BusinessError } from '../../common/business-error.js';
import { Role, type User } from '../../users/user.js';
import {
  SalesOrderStatus,
  TransportOrderStatus,
  type SalesOrderSnapshot,
  type TransportOrderSnapshot,
  type VehicleSnapshot,
} from './transport-order.js';

/**
 * Business rules of the transport planning, as pure functions.
 * They receive already-loaded data and throw a BusinessError when a rule is
 * violated; the service is responsible for loading data under the right locks.
 */

const TRANSPORT_ORDER_PREFIX = 'TO-';
const TRANSPORT_ORDER_DIGITS = 4;

/** Weights are decimal(10,2): compare them as integer hundredths of a kg. */
function toHundredths(weightKg: number): number {
  return Math.round(weightKg * 100);
}

export function sumWeights(weightsKg: readonly number[]): number {
  return (
    weightsKg.reduce((total, weight) => total + toHundredths(weight), 0) / 100
  );
}

function assertDraft(order: TransportOrderSnapshot): void {
  if (order.status !== TransportOrderStatus.Draft) {
    throw new BusinessError(
      'conflict',
      'TRANSPORT_ORDER_NOT_DRAFT',
      `Transport order ${order.no} is no longer a draft: its sales orders cannot be changed.`,
      { transportOrderNo: order.no },
    );
  }
}

function invalidTransition(
  order: TransportOrderSnapshot,
  target: TransportOrderStatus,
): BusinessError {
  return new BusinessError(
    'conflict',
    'INVALID_STATUS_TRANSITION',
    `Transport order ${order.no} cannot go from status ${TransportOrderStatus[order.status]} to ${TransportOrderStatus[target]}.`,
    {
      transportOrderNo: order.no,
      from: TransportOrderStatus[order.status],
      to: TransportOrderStatus[target],
    },
  );
}

/**
 * Optimistic concurrency: when the client sends the version it displayed
 * (If-Match), refuse to act on an order that changed since.
 */
export function assertVersionMatches(
  order: { no: string; version: string },
  expectedVersion: string | undefined,
): void {
  if (expectedVersion !== undefined && expectedVersion !== order.version) {
    throw new BusinessError(
      'conflict',
      'STALE_TRANSPORT_ORDER',
      `Transport order ${order.no} was modified by someone else. Reload it and try again.`,
      { transportOrderNo: order.no },
    );
  }
}

export function assertCanCreate(input: {
  vehicleCode: string;
  vehicle: VehicleSnapshot | undefined;
  deliveryDate: string;
  today: string;
  existingOrderNo: string | null;
}): void {
  const { vehicle, deliveryDate, today, existingOrderNo } = input;

  if (!vehicle) {
    throw new BusinessError(
      'unprocessable',
      'VEHICLE_NOT_FOUND',
      `Vehicle ${input.vehicleCode} does not exist.`,
      { vehicleCode: input.vehicleCode },
    );
  }
  if (!vehicle.active) {
    throw new BusinessError(
      'unprocessable',
      'VEHICLE_INACTIVE',
      `Vehicle ${vehicle.code} is out of service.`,
      { vehicleCode: vehicle.code },
    );
  }
  // Both dates are ISO YYYY-MM-DD strings: lexical order is chronological order.
  if (deliveryDate < today) {
    throw new BusinessError(
      'unprocessable',
      'DELIVERY_DATE_IN_PAST',
      `Delivery date ${deliveryDate} is in the past.`,
      { deliveryDate, today },
    );
  }
  if (existingOrderNo) {
    throw new BusinessError(
      'conflict',
      'VEHICLE_ALREADY_BOOKED',
      `Vehicle ${vehicle.code} already has transport order ${existingOrderNo} on ${deliveryDate}.`,
      {
        vehicleCode: vehicle.code,
        deliveryDate,
        transportOrderNo: existingOrderNo,
      },
    );
  }
}

/**
 * Returns the order weight after the addition.
 * `salesOrders` are the requested sales orders found in the database.
 */
export function assertCanAddSalesOrders(input: {
  order: TransportOrderSnapshot;
  requestedNos: readonly string[];
  salesOrders: readonly SalesOrderSnapshot[];
  currentWeightKg: number;
  capacityKg: number;
}): { newWeightKg: number } {
  const { order, requestedNos, salesOrders, currentWeightKg, capacityKg } =
    input;

  assertDraft(order);

  const foundNos = new Set(salesOrders.map((salesOrder) => salesOrder.no));
  const missingNos = requestedNos.filter((no) => !foundNos.has(no));
  if (missingNos.length > 0) {
    throw new BusinessError(
      'unprocessable',
      'SALES_ORDER_NOT_FOUND',
      `Unknown sales orders: ${missingNos.join(', ')}.`,
      { salesOrderNos: missingNos },
    );
  }

  const unavailableNos = salesOrders
    .filter(
      (salesOrder) =>
        salesOrder.status !== SalesOrderStatus.ToPlan ||
        salesOrder.assignedTo !== null,
    )
    .map((salesOrder) => salesOrder.no);
  if (unavailableNos.length > 0) {
    throw new BusinessError(
      'conflict',
      'SALES_ORDER_NOT_AVAILABLE',
      `Sales orders not available for planning: ${unavailableNos.join(', ')}.`,
      { salesOrderNos: unavailableNos },
    );
  }

  const addedWeightKg = sumWeights(
    salesOrders.map((salesOrder) => salesOrder.weightKg),
  );
  const newWeightKg = sumWeights([currentWeightKg, addedWeightKg]);
  if (toHundredths(newWeightKg) > toHundredths(capacityKg)) {
    throw new BusinessError(
      'unprocessable',
      'CAPACITY_EXCEEDED',
      `Adding ${addedWeightKg} kg to ${currentWeightKg} kg exceeds the vehicle capacity of ${capacityKg} kg.`,
      { capacityKg, currentWeightKg, addedWeightKg },
    );
  }

  return { newWeightKg };
}

export function assertCanRemoveSalesOrder(input: {
  order: TransportOrderSnapshot;
  salesOrderNo: string;
  lineExists: boolean;
}): void {
  assertDraft(input.order);
  if (!input.lineExists) {
    throw new BusinessError(
      'not_found',
      'LINE_NOT_FOUND',
      `Sales order ${input.salesOrderNo} is not on transport order ${input.order.no}.`,
      { transportOrderNo: input.order.no, salesOrderNo: input.salesOrderNo },
    );
  }
}

export function assertCanValidate(input: {
  order: TransportOrderSnapshot;
  user: User;
  lineCount: number;
}): void {
  const { order, user, lineCount } = input;

  if (user.role !== Role.LogisticsManager) {
    throw new BusinessError(
      'forbidden',
      'ROLE_NOT_ALLOWED',
      'Only a logistics manager can validate a transport order.',
      { requiredRole: Role.LogisticsManager, role: user.role },
    );
  }
  if (order.status !== TransportOrderStatus.Draft) {
    throw invalidTransition(order, TransportOrderStatus.Validated);
  }
  if (lineCount === 0) {
    throw new BusinessError(
      'unprocessable',
      'TRANSPORT_ORDER_EMPTY',
      `Transport order ${order.no} has no sales order and cannot be validated.`,
      { transportOrderNo: order.no },
    );
  }
}

/** Both roles may mark an order as departed: only the status matters. */
export function assertCanDepart(input: {
  order: TransportOrderSnapshot;
}): void {
  if (input.order.status !== TransportOrderStatus.Validated) {
    throw invalidTransition(input.order, TransportOrderStatus.Departed);
  }
}

/** TO-0004 -> TO-0005. Numbering keeps growing past 4 digits if needed. */
export function nextTransportOrderNo(lastNo: string | null): string {
  const lastNumber = lastNo
    ? Number.parseInt(lastNo.slice(TRANSPORT_ORDER_PREFIX.length), 10)
    : 0;
  const next = (Number.isNaN(lastNumber) ? 0 : lastNumber) + 1;
  return `${TRANSPORT_ORDER_PREFIX}${String(next).padStart(TRANSPORT_ORDER_DIGITS, '0')}`;
}
