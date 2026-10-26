import { describe, expect, it } from 'vitest'
import type { TransportOrderResource, TransportOrderSummaryResource } from '@/api/resources'
import { TransportOrderModel, TransportOrderSummaryModel } from './transport-order'

const summary: TransportOrderSummaryResource = {
  no: 'TO-0003',
  vehicleCode: 'VH-01',
  vehiclePlateNo: 'LT-482-AB',
  vehicleCapacityKg: 1500,
  deliveryDate: '2026-10-27',
  status: 'DRAFT',
  createdBy: 'diane',
  validatedBy: null,
  salesOrderCount: 2,
  totalWeightKg: 1360,
}

const detail: TransportOrderResource = {
  ...summary,
  version: '00000000000007d3',
  salesOrders: [
    {
      no: 'SO-1006',
      customerNo: 'C0006',
      customerName: 'Agro Distribution Ouest',
      deliveryCity: 'Bafoussam',
      totalWeightKg: 640,
      status: 'PLANNED',
    },
  ],
}

const withStatus = (status: TransportOrderSummaryResource['status'], salesOrderCount = 2) =>
  new TransportOrderSummaryModel({ ...summary, status, salesOrderCount })

describe('TransportOrderSummaryModel', () => {
  it('exposes the load against the vehicle capacity', () => {
    const order = new TransportOrderSummaryModel(summary)
    expect(order.capacity).toEqual({ percent: 91, remainingKg: 140, level: 'high' })
    expect(order.isDraft).toBe(true)
  })

  it('tells whether an extra load fits, without float drift', () => {
    const order = new TransportOrderSummaryModel(summary)
    expect(order.canFit(140)).toBe(true)
    expect(order.canFit(140.01)).toBe(false)
    expect(
      new TransportOrderSummaryModel({ ...summary, totalWeightKg: 0.1, vehicleCapacityKg: 0.3 }).canFit(
        0.2,
      ),
    ).toBe(true)
  })

  describe('actionsFor', () => {
    it('lets anyone edit a draft, only a manager validate a non-empty one', () => {
      expect(withStatus('DRAFT').actionsFor('DISPATCHER')).toEqual({
        editLines: true,
        validate: false,
        depart: false,
      })
      expect(withStatus('DRAFT').actionsFor('LOGISTICS_MANAGER')).toEqual({
        editLines: true,
        validate: true,
        depart: false,
      })
    })

    it('does not offer validation of an empty draft', () => {
      expect(withStatus('DRAFT', 0).actionsFor('LOGISTICS_MANAGER').validate).toBe(false)
    })

    it.each(['DISPATCHER', 'LOGISTICS_MANAGER'] as const)(
      'offers only departure on a validated order to %s',
      (role) => {
        expect(withStatus('VALIDATED').actionsFor(role)).toEqual({
          editLines: false,
          validate: false,
          depart: true,
        })
      },
    )

    it('offers nothing on a departed order or without a user', () => {
      const none = { editLines: false, validate: false, depart: false }
      expect(withStatus('DEPARTED').actionsFor('LOGISTICS_MANAGER')).toEqual(none)
      expect(withStatus('DRAFT').actionsFor(undefined)).toEqual(none)
    })
  })
})

describe('TransportOrderModel', () => {
  it('wraps its sales orders in models and keeps the version', () => {
    const order = new TransportOrderModel(detail)
    expect(order.version).toBe('00000000000007d3')
    expect(order.salesOrders[0]?.customerName).toBe('Agro Distribution Ouest')
    expect(order.salesOrders[0]?.weightKg).toBe(640)
  })
})
