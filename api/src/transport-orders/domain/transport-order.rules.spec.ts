import { BusinessError } from '../../common/business-error.js';
import { Role, type User } from '../../users/user.js';
import {
  SalesOrderStatus,
  TransportOrderStatus,
  type SalesOrderSnapshot,
  type TransportOrderSnapshot,
  type VehicleSnapshot,
} from './transport-order.js';
import {
  assertCanAddSalesOrders,
  assertCanCreate,
  assertCanDepart,
  assertCanRemoveSalesOrder,
  assertCanValidate,
  assertVersionMatches,
  nextTransportOrderNo,
  sumWeights,
} from './transport-order.rules.js';

const dispatcher: User = { id: 'diane', role: Role.Dispatcher };
const manager: User = { id: 'eric', role: Role.LogisticsManager };

const vehicle = (
  overrides: Partial<VehicleSnapshot> = {},
): VehicleSnapshot => ({
  code: 'VH-01',
  capacityKg: 1500,
  active: true,
  ...overrides,
});

const order = (
  status: TransportOrderStatus = TransportOrderStatus.Draft,
): TransportOrderSnapshot => ({ no: 'TO-0010', status });

const salesOrder = (
  no: string,
  weightKg: number,
  overrides: Partial<SalesOrderSnapshot> = {},
): SalesOrderSnapshot => ({
  no,
  weightKg,
  status: SalesOrderStatus.ToPlan,
  assignedTo: null,
  ...overrides,
});

/** Runs `action` and returns the BusinessError it throws (fails otherwise). */
function catchBusinessError(action: () => unknown): BusinessError {
  try {
    action();
  } catch (error) {
    if (error instanceof BusinessError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a BusinessError to be thrown');
}

describe('transport order rules', () => {
  describe('creation', () => {
    const today = '2026-10-26';

    it('accepts an active vehicle, a date from today on and a free slot', () => {
      expect(() =>
        assertCanCreate({
          vehicleCode: 'VH-01',
          vehicle: vehicle(),
          deliveryDate: today,
          today,
          existingOrderNo: null,
        }),
      ).not.toThrow();
    });

    it('rejects an unknown vehicle', () => {
      const error = catchBusinessError(() =>
        assertCanCreate({
          vehicleCode: 'VH-99',
          vehicle: undefined,
          deliveryDate: today,
          today,
          existingOrderNo: null,
        }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'VEHICLE_NOT_FOUND',
      });
    });

    it('rejects an inactive vehicle', () => {
      const error = catchBusinessError(() =>
        assertCanCreate({
          vehicleCode: 'VH-01',
          vehicle: vehicle({ active: false }),
          deliveryDate: today,
          today,
          existingOrderNo: null,
        }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'VEHICLE_INACTIVE',
      });
    });

    it('rejects a delivery date in the past', () => {
      const error = catchBusinessError(() =>
        assertCanCreate({
          vehicleCode: 'VH-01',
          vehicle: vehicle(),
          deliveryDate: '2026-10-25',
          today,
          existingOrderNo: null,
        }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'DELIVERY_DATE_IN_PAST',
      });
    });

    it('rejects a second order for the same vehicle and date', () => {
      const error = catchBusinessError(() =>
        assertCanCreate({
          vehicleCode: 'VH-01',
          vehicle: vehicle(),
          deliveryDate: today,
          today,
          existingOrderNo: 'TO-0003',
        }),
      );
      expect(error).toMatchObject({
        kind: 'conflict',
        code: 'VEHICLE_ALREADY_BOOKED',
        details: { transportOrderNo: 'TO-0003' },
      });
    });
  });

  describe('adding sales orders', () => {
    const base = {
      order: order(),
      requestedNos: ['SO-1', 'SO-2'],
      salesOrders: [salesOrder('SO-1', 500), salesOrder('SO-2', 400)],
      currentWeightKg: 600,
      capacityKg: 1500,
    };

    it('accepts available sales orders that fit exactly in the vehicle', () => {
      expect(() => assertCanAddSalesOrders(base)).not.toThrow();
      expect(assertCanAddSalesOrders(base)).toEqual({ newWeightKg: 1500 });
    });

    it('compares weights without floating point drift', () => {
      // 0.1 + 0.2 !== 0.3 in IEEE 754: the rule must still accept this load.
      expect(() =>
        assertCanAddSalesOrders({
          ...base,
          requestedNos: ['SO-1', 'SO-2'],
          salesOrders: [salesOrder('SO-1', 0.1), salesOrder('SO-2', 0.2)],
          currentWeightKg: 0,
          capacityKg: 0.3,
        }),
      ).not.toThrow();
    });

    it('rejects a load exceeding the vehicle capacity by a single unit', () => {
      const error = catchBusinessError(() =>
        assertCanAddSalesOrders({ ...base, currentWeightKg: 600.01 }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'CAPACITY_EXCEEDED',
        details: {
          capacityKg: 1500,
          currentWeightKg: 600.01,
          addedWeightKg: 900,
        },
      });
    });

    it.each([TransportOrderStatus.Validated, TransportOrderStatus.Departed])(
      'rejects changes on an order that is not a draft (status %s)',
      (status) => {
        const error = catchBusinessError(() =>
          assertCanAddSalesOrders({ ...base, order: order(status) }),
        );
        expect(error).toMatchObject({
          kind: 'conflict',
          code: 'TRANSPORT_ORDER_NOT_DRAFT',
        });
      },
    );

    it('rejects unknown sales orders and lists them', () => {
      const error = catchBusinessError(() =>
        assertCanAddSalesOrders({
          ...base,
          requestedNos: ['SO-1', 'SO-2', 'SO-404'],
        }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'SALES_ORDER_NOT_FOUND',
        details: { salesOrderNos: ['SO-404'] },
      });
    });

    it.each([SalesOrderStatus.Planned, SalesOrderStatus.InDelivery])(
      'rejects sales orders that are not "to plan" (status %s)',
      (status) => {
        const error = catchBusinessError(() =>
          assertCanAddSalesOrders({
            ...base,
            salesOrders: [
              salesOrder('SO-1', 500),
              salesOrder('SO-2', 400, { status }),
            ],
          }),
        );
        expect(error).toMatchObject({
          kind: 'conflict',
          code: 'SALES_ORDER_NOT_AVAILABLE',
          details: { salesOrderNos: ['SO-2'] },
        });
      },
    );

    it('rejects a sales order already held by another transport order', () => {
      const error = catchBusinessError(() =>
        assertCanAddSalesOrders({
          ...base,
          salesOrders: [
            salesOrder('SO-1', 500, { assignedTo: 'TO-0003' }),
            salesOrder('SO-2', 400),
          ],
        }),
      );
      expect(error).toMatchObject({
        kind: 'conflict',
        code: 'SALES_ORDER_NOT_AVAILABLE',
        details: { salesOrderNos: ['SO-1'] },
      });
    });
  });

  describe('removing a sales order', () => {
    it('accepts removing a line from a draft order', () => {
      expect(() =>
        assertCanRemoveSalesOrder({
          order: order(),
          salesOrderNo: 'SO-1',
          lineExists: true,
        }),
      ).not.toThrow();
    });

    it('rejects removal from a validated order', () => {
      const error = catchBusinessError(() =>
        assertCanRemoveSalesOrder({
          order: order(TransportOrderStatus.Validated),
          salesOrderNo: 'SO-1',
          lineExists: true,
        }),
      );
      expect(error.code).toBe('TRANSPORT_ORDER_NOT_DRAFT');
    });

    it('rejects removal of a sales order that is not on the order', () => {
      const error = catchBusinessError(() =>
        assertCanRemoveSalesOrder({
          order: order(),
          salesOrderNo: 'SO-1',
          lineExists: false,
        }),
      );
      expect(error).toMatchObject({
        kind: 'not_found',
        code: 'LINE_NOT_FOUND',
      });
    });
  });

  describe('validation', () => {
    it('lets a logistics manager validate a non-empty draft', () => {
      expect(() =>
        assertCanValidate({ order: order(), user: manager, lineCount: 1 }),
      ).not.toThrow();
    });

    it('forbids a dispatcher from validating', () => {
      const error = catchBusinessError(() =>
        assertCanValidate({ order: order(), user: dispatcher, lineCount: 1 }),
      );
      expect(error).toMatchObject({
        kind: 'forbidden',
        code: 'ROLE_NOT_ALLOWED',
      });
    });

    it('rejects validating an empty order', () => {
      const error = catchBusinessError(() =>
        assertCanValidate({ order: order(), user: manager, lineCount: 0 }),
      );
      expect(error).toMatchObject({
        kind: 'unprocessable',
        code: 'TRANSPORT_ORDER_EMPTY',
      });
    });

    it.each([TransportOrderStatus.Validated, TransportOrderStatus.Departed])(
      'rejects validating an order with status %s',
      (status) => {
        const error = catchBusinessError(() =>
          assertCanValidate({
            order: order(status),
            user: manager,
            lineCount: 2,
          }),
        );
        expect(error).toMatchObject({
          kind: 'conflict',
          code: 'INVALID_STATUS_TRANSITION',
        });
      },
    );
  });

  describe('departure', () => {
    it('accepts marking a validated order as departed', () => {
      expect(() =>
        assertCanDepart({ order: order(TransportOrderStatus.Validated) }),
      ).not.toThrow();
    });

    it.each([TransportOrderStatus.Draft, TransportOrderStatus.Departed])(
      'rejects departure of an order with status %s',
      (status) => {
        const error = catchBusinessError(() =>
          assertCanDepart({ order: order(status) }),
        );
        expect(error).toMatchObject({
          kind: 'conflict',
          code: 'INVALID_STATUS_TRANSITION',
        });
      },
    );
  });

  describe('numbering', () => {
    it.each([
      [null, 'TO-0001'],
      ['TO-0004', 'TO-0005'],
      ['TO-0099', 'TO-0100'],
      ['TO-9999', 'TO-10000'],
    ])('after %s comes %s', (last, expected) => {
      expect(nextTransportOrderNo(last)).toBe(expected);
    });
  });

  describe('optimistic concurrency', () => {
    const current = { no: 'TO-0010', version: '00000000000007d1' };

    it('accepts a matching version or no version at all', () => {
      expect(() =>
        assertVersionMatches(current, '00000000000007d1'),
      ).not.toThrow();
      expect(() => assertVersionMatches(current, undefined)).not.toThrow();
    });

    it('rejects a stale version', () => {
      const error = catchBusinessError(() =>
        assertVersionMatches(current, '00000000000007d0'),
      );
      expect(error).toMatchObject({
        kind: 'conflict',
        code: 'STALE_TRANSPORT_ORDER',
      });
    });
  });

  describe('weights', () => {
    it('sums decimal weights exactly', () => {
      expect(sumWeights([0.1, 0.2])).toBe(0.3);
      expect(sumWeights([1340, 560, 2250.5])).toBe(4150.5);
      expect(sumWeights([])).toBe(0);
    });
  });
});
