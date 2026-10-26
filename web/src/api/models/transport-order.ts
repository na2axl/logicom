import type {
  ISODate,
  Role,
  TransportOrderResource,
  TransportOrderStatus,
  TransportOrderSummaryResource,
} from '@/api/resources'
import { Model } from './model'
import { SalesOrderModel } from './sales-order'
import { capacityUsage, toHundredths, type CapacityUsage } from './weight'

export interface TransportOrderActions {
  editLines: boolean
  validate: boolean
  depart: boolean
}

const NO_ACTIONS: TransportOrderActions = { editLines: false, validate: false, depart: false }

/** A transport order as listed: header, vehicle and aggregated load. */
export class TransportOrderSummaryModel<
  TResource extends TransportOrderSummaryResource = TransportOrderSummaryResource,
> extends Model<TResource> {
  get no(): string {
    return this._data.no
  }

  get vehicleCode(): string {
    return this._data.vehicleCode
  }

  get vehiclePlateNo(): string {
    return this._data.vehiclePlateNo
  }

  get capacityKg(): number {
    return this._data.vehicleCapacityKg
  }

  get deliveryDate(): ISODate {
    return this._data.deliveryDate
  }

  get status(): TransportOrderStatus {
    return this._data.status
  }

  get createdBy(): string {
    return this._data.createdBy
  }

  get validatedBy(): string | null {
    return this._data.validatedBy
  }

  get salesOrderCount(): number {
    return this._data.salesOrderCount
  }

  get weightKg(): number {
    return this._data.totalWeightKg
  }

  get isDraft(): boolean {
    return this._data.status === 'DRAFT'
  }

  get capacity(): CapacityUsage {
    return capacityUsage(this.weightKg, this.capacityKg)
  }

  /** Comfort pre-check for the UI; the API re-checks capacity under lock. */
  canFit(addedWeightKg: number): boolean {
    return (
      toHundredths(this.weightKg) + toHundredths(addedWeightKg) <= toHundredths(this.capacityKg)
    )
  }

  /**
   * Which actions to offer for a role. This only shapes the UI: the API
   * enforces the same rules and stays the source of truth.
   */
  actionsFor(role: Role | undefined): TransportOrderActions {
    if (!role) return NO_ACTIONS
    return {
      editLines: this.isDraft,
      validate: this.isDraft && role === 'LOGISTICS_MANAGER' && this.salesOrderCount > 0,
      depart: this.status === 'VALIDATED',
    }
  }
}

export class TransportOrderModel extends TransportOrderSummaryModel<TransportOrderResource> {
  get version(): string {
    return this._data.version
  }

  get salesOrders(): SalesOrderModel[] {
    return SalesOrderModel.collection(this._data.salesOrders)
  }
}
