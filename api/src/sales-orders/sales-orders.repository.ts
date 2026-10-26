import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { toOffset, type Paginated } from '../common/pagination.js';
import {
  DatabaseService,
  type SqlExecutor,
} from '../database/database.service.js';
import { bindList } from '../database/sql-helpers.js';
import {
  SALES_ORDER_STATUS_CODES,
  SalesOrderStatus,
  type SalesOrderSnapshot,
  type SalesOrderStatusCode,
} from '../transport-orders/domain/transport-order.js';
import { SalesOrdersQueryDto } from './dto/sales-orders-query.dto.js';

export interface SalesOrder {
  no: string;
  customerNo: string;
  customerName: string;
  deliveryCity: string;
  totalWeightKg: number;
  status: SalesOrderStatusCode;
}

export interface SalesOrderRow {
  No_: string;
  'Customer No_': string;
  'Customer Name': string;
  'Delivery City': string;
  'Total Weight (kg)': number;
  Status: SalesOrderStatus;
}

export const SALES_ORDER_COLUMNS = `
  so.[No_], so.[Customer No_], so.[Customer Name], so.[Delivery City],
  so.[Total Weight (kg)], so.[Status]`;

export function toSalesOrder(row: SalesOrderRow): SalesOrder {
  return {
    no: row.No_,
    customerNo: row['Customer No_'],
    customerName: row['Customer Name'],
    deliveryCity: row['Delivery City'],
    totalWeightKg: row['Total Weight (kg)'],
    status: SALES_ORDER_STATUS_CODES[row.Status],
  };
}

const TO_PLAN_WHERE = (city: string | undefined): string =>
  city
    ? 'so.[Status] = @status AND so.[Delivery City] = @city'
    : 'so.[Status] = @status';

@Injectable()
export class SalesOrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findToPlan(query: SalesOrdersQueryDto): Promise<Paginated<SalesOrder>> {
    const [page, total] = await Promise.all([
      this.toPlanRequest(query.city)
        .input('offset', sql.Int, toOffset(query))
        .input('pageSize', sql.Int, query.pageSize).query<SalesOrderRow>(`
          SELECT ${SALES_ORDER_COLUMNS}
          FROM [Sales Order] so
          WHERE ${TO_PLAN_WHERE(query.city)}
          ORDER BY so.[Delivery City], so.[No_]
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`),
      this.toPlanRequest(query.city).query<{ total: number }>(`
          SELECT COUNT(*) AS total
          FROM [Sales Order] so
          WHERE ${TO_PLAN_WHERE(query.city)}`),
    ]);

    return {
      items: page.recordset.map(toSalesOrder),
      total: total.recordset[0].total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findCitiesToPlan(): Promise<string[]> {
    const result = await this.db
      .request()
      .input('status', sql.TinyInt, SalesOrderStatus.ToPlan).query<{
      city: string;
    }>(`
        SELECT DISTINCT [Delivery City] AS city
        FROM [Sales Order]
        WHERE [Status] = @status
        ORDER BY city`);
    return result.recordset.map((row) => row.city);
  }

  /**
   * Loads the given sales orders with an update lock, so that two concurrent
   * transactions cannot both see them as "to plan" and assign them twice.
   * Rows are locked in key order to limit deadlocks.
   */
  async lockForPlanning(
    nos: readonly string[],
    executor: SqlExecutor,
  ): Promise<SalesOrderSnapshot[]> {
    const request = this.db.request(executor);
    const placeholders = bindList(request, 'so', nos);
    const result = await request.query<{
      No_: string;
      'Total Weight (kg)': number;
      Status: SalesOrderStatus;
      AssignedTo: string | null;
    }>(`
      SELECT so.[No_], so.[Total Weight (kg)], so.[Status],
             (SELECT TOP 1 l.[Transport Order No_]
              FROM [Transport Order Line] l WITH (UPDLOCK, HOLDLOCK)
              WHERE l.[Sales Order No_] = so.[No_]) AS AssignedTo
      FROM [Sales Order] so WITH (UPDLOCK, ROWLOCK)
      WHERE so.[No_] IN (${placeholders})
      ORDER BY so.[No_]`);

    return result.recordset.map((row) => ({
      no: row.No_,
      weightKg: row['Total Weight (kg)'],
      status: row.Status,
      assignedTo: row.AssignedTo,
    }));
  }

  async updateStatus(
    nos: readonly string[],
    status: SalesOrderStatus,
    executor: SqlExecutor,
  ): Promise<number> {
    if (nos.length === 0) {
      return 0;
    }
    const request = this.db
      .request(executor)
      .input('status', sql.TinyInt, status);
    const placeholders = bindList(request, 'so', nos);
    const result = await request.query(`
      UPDATE [Sales Order] SET [Status] = @status
      WHERE [No_] IN (${placeholders})`);
    return result.rowsAffected[0] ?? 0;
  }

  private toPlanRequest(city: string | undefined): sql.Request {
    const request = this.db
      .request()
      .input('status', sql.TinyInt, SalesOrderStatus.ToPlan);
    return city ? request.input('city', sql.NVarChar(50), city) : request;
  }
}
