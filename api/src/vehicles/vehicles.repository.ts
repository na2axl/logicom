import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import {
  DatabaseService,
  type SqlExecutor,
} from '../database/database.service.js';

export interface Vehicle {
  code: string;
  plateNo: string;
  capacityKg: number;
  active: boolean;
}

interface VehicleRow {
  Code: string;
  'Plate No_': string;
  'Capacity (kg)': number;
  Active: boolean;
}

const SELECT_VEHICLE = `
  SELECT [Code], [Plate No_], [Capacity (kg)], [Active]
  FROM [Vehicle]`;

function toVehicle(row: VehicleRow): Vehicle {
  return {
    code: row.Code,
    plateNo: row['Plate No_'],
    capacityKg: row['Capacity (kg)'],
    active: row.Active,
  };
}

@Injectable()
export class VehiclesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findActive(): Promise<Vehicle[]> {
    const result = await this.db
      .request()
      .query<VehicleRow>(
        `${SELECT_VEHICLE} WHERE [Active] = 1 ORDER BY [Code]`,
      );
    return result.recordset.map(toVehicle);
  }

  async findByCode(
    code: string,
    executor?: SqlExecutor,
  ): Promise<Vehicle | undefined> {
    const result = await this.db
      .request(executor)
      .input('code', sql.NVarChar(20), code)
      .query<VehicleRow>(`${SELECT_VEHICLE} WHERE [Code] = @code`);
    const row = result.recordset[0];
    return row ? toVehicle(row) : undefined;
  }
}
