import type { VehicleResource } from '@/api/resources'
import { Model } from './model'

export class VehicleModel extends Model<VehicleResource> {
  get code(): string {
    return this._data.code
  }

  get plateNo(): string {
    return this._data.plateNo
  }

  get capacityKg(): number {
    return this._data.capacityKg
  }
}
