import type { SalesOrderResource, SalesOrderStatus } from '@/api/resources'
import { Model } from './model'

export class SalesOrderModel extends Model<SalesOrderResource> {
  get no(): string {
    return this._data.no
  }

  get customerNo(): string {
    return this._data.customerNo
  }

  get customerName(): string {
    return this._data.customerName
  }

  get deliveryCity(): string {
    return this._data.deliveryCity
  }

  get weightKg(): number {
    return this._data.totalWeightKg
  }

  get status(): SalesOrderStatus {
    return this._data.status
  }
}
