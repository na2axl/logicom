import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import { toOffset, type Paginated } from '../common/pagination.js';
import {
  DatabaseService,
  type SqlExecutor,
} from '../database/database.service.js';
import { toIsoDate, toVersion } from '../database/sql-helpers.js';
import {
  SALES_ORDER_COLUMNS,
  toSalesOrder,
  type SalesOrder,
  type SalesOrderRow,
} from '../sales-orders/sales-orders.repository.js';
import {
  TRANSPORT_ORDER_STATUS_CODES,
  TransportOrderStatus,
  type TransportOrderStatusCode,
} from './domain/transport-order.js';
import { sumWeights } from './domain/transport-order.rules.js';

export interface TransportOrderSummary {
  no: string;
  vehicleCode: string;
  vehiclePlateNo: string;
  vehicleCapacityKg: number;
  deliveryDate: string;
  status: TransportOrderStatusCode;
  createdBy: string;
  validatedBy: string | null;
  salesOrderCount: number;
  totalWeightKg: number;
}

export interface TransportOrderDetail extends TransportOrderSummary {
  /** Hex rowversion, sent back in If-Match for optimistic concurrency. */
  version: string;
  salesOrders: SalesOrder[];
}

/** Header loaded under lock before any modification. */
export interface LockedTransportOrder {
  no: string;
  status: TransportOrderStatus;
  vehicleCapacityKg: number;
  version: string;
}

export interface TransportOrderFilters {
  status?: TransportOrderStatus;
  deliveryDate?: string;
  page: number;
  pageSize: number;
}

interface SummaryRow {
  No_: string;
  'Vehicle Code': string;
  'Plate No_': string;
  'Capacity (kg)': number;
  'Delivery Date': Date;
  Status: TransportOrderStatus;
  'Created By': string;
  'Validated By': string | null;
  timestamp: Buffer;
  SalesOrderCount: number;
  TotalWeight: number;
}

/** Header + vehicle + aggregated load, shared by the list and the detail. */
const SELECT_SUMMARY = `
  SELECT t.[No_], t.[Vehicle Code], v.[Plate No_], v.[Capacity (kg)],
         t.[Delivery Date], t.[Status], t.[Created By], t.[Validated By], t.[timestamp],
         COALESCE(load.SalesOrderCount, 0) AS SalesOrderCount,
         COALESCE(load.TotalWeight, 0) AS TotalWeight
  FROM [Transport Order] t
  JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
  OUTER APPLY (
    SELECT COUNT(*) AS SalesOrderCount, SUM(so.[Total Weight (kg)]) AS TotalWeight
    FROM [Transport Order Line] l
    JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
    WHERE l.[Transport Order No_] = t.[No_]
  ) load`;

function toSummary(row: SummaryRow): TransportOrderSummary {
  return {
    no: row.No_,
    vehicleCode: row['Vehicle Code'],
    vehiclePlateNo: row['Plate No_'],
    vehicleCapacityKg: row['Capacity (kg)'],
    deliveryDate: toIsoDate(row['Delivery Date']),
    status: TRANSPORT_ORDER_STATUS_CODES[row.Status],
    createdBy: row['Created By'],
    validatedBy: row['Validated By'],
    salesOrderCount: row.SalesOrderCount,
    totalWeightKg: row.TotalWeight,
  };
}

@Injectable()
export class TransportOrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findPage(
    filters: TransportOrderFilters,
  ): Promise<Paginated<TransportOrderSummary>> {
    const conditions = [
      filters.status !== undefined ? 't.[Status] = @status' : null,
      filters.deliveryDate ? 't.[Delivery Date] = @deliveryDate' : null,
    ].filter((condition): condition is string => condition !== null);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const filtered = () => {
      const request = this.db.request();
      if (filters.status !== undefined) {
        request.input('status', sql.TinyInt, filters.status);
      }
      if (filters.deliveryDate) {
        request.input('deliveryDate', sql.Date, filters.deliveryDate);
      }
      return request;
    };

    const [page, total] = await Promise.all([
      filtered()
        .input('offset', sql.Int, toOffset(filters))
        .input('pageSize', sql.Int, filters.pageSize).query<SummaryRow>(`
          ${SELECT_SUMMARY}
          ${where}
          ORDER BY t.[Delivery Date] DESC, t.[No_] DESC
          OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`),
      filtered().query<{ total: number }>(`
          SELECT COUNT(*) AS total FROM [Transport Order] t ${where}`),
    ]);

    return {
      items: page.recordset.map(toSummary),
      total: total.recordset[0].total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async findDetail(
    no: string,
    executor?: SqlExecutor,
  ): Promise<TransportOrderDetail | undefined> {
    const header = await this.db
      .request(executor)
      .input('no', sql.NVarChar(20), no)
      .query<SummaryRow>(`${SELECT_SUMMARY} WHERE t.[No_] = @no`);
    const row = header.recordset[0];
    if (!row) {
      return undefined;
    }

    const lines = await this.db
      .request(executor)
      .input('no', sql.NVarChar(20), no).query<SalesOrderRow>(`
        SELECT ${SALES_ORDER_COLUMNS}
        FROM [Transport Order Line] l
        JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
        WHERE l.[Transport Order No_] = @no
        ORDER BY so.[No_]`);

    return {
      ...toSummary(row),
      version: toVersion(row.timestamp),
      salesOrders: lines.recordset.map(toSalesOrder),
    };
  }

  /**
   * Loads the order header with an update lock: concurrent modifications of
   * the same order are serialized until the transaction ends.
   */
  async lock(
    no: string,
    tx: sql.Transaction,
  ): Promise<LockedTransportOrder | undefined> {
    const result = await this.db.request(tx).input('no', sql.NVarChar(20), no)
      .query<{
      No_: string;
      Status: TransportOrderStatus;
      'Capacity (kg)': number;
      timestamp: Buffer;
    }>(`
        SELECT t.[No_], t.[Status], v.[Capacity (kg)], t.[timestamp]
        FROM [Transport Order] t WITH (UPDLOCK, ROWLOCK)
        JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
        WHERE t.[No_] = @no`);
    const row = result.recordset[0];
    return row
      ? {
          no: row.No_,
          status: row.Status,
          vehicleCapacityKg: row['Capacity (kg)'],
          version: toVersion(row.timestamp),
        }
      : undefined;
  }

  /**
   * Existing order for this vehicle and date. HOLDLOCK keeps the range locked
   * until commit, so a concurrent creation for the same slot has to wait.
   */
  async findNoForVehicleAndDate(
    vehicleCode: string,
    deliveryDate: string,
    tx: sql.Transaction,
  ): Promise<string | null> {
    const result = await this.db
      .request(tx)
      .input('vehicleCode', sql.NVarChar(20), vehicleCode)
      .input('deliveryDate', sql.Date, deliveryDate).query<{ No_: string }>(`
        SELECT TOP 1 [No_]
        FROM [Transport Order] WITH (UPDLOCK, HOLDLOCK)
        WHERE [Vehicle Code] = @vehicleCode AND [Delivery Date] = @deliveryDate`);
    return result.recordset[0]?.No_ ?? null;
  }

  /** Highest number in use, locked so two creations cannot pick the same one. */
  async findLastNo(tx: sql.Transaction): Promise<string | null> {
    const result = await this.db.request(tx).query<{ No_: string }>(`
      SELECT TOP 1 [No_]
      FROM [Transport Order] WITH (UPDLOCK, HOLDLOCK)
      WHERE [No_] LIKE 'TO-%'
      ORDER BY LEN([No_]) DESC, [No_] DESC`);
    return result.recordset[0]?.No_ ?? null;
  }

  async insert(
    order: {
      no: string;
      vehicleCode: string;
      deliveryDate: string;
      createdBy: string;
    },
    tx: sql.Transaction,
  ): Promise<void> {
    await this.db
      .request(tx)
      .input('no', sql.NVarChar(20), order.no)
      .input('vehicleCode', sql.NVarChar(20), order.vehicleCode)
      .input('deliveryDate', sql.Date, order.deliveryDate)
      .input('status', sql.TinyInt, TransportOrderStatus.Draft)
      .input('createdBy', sql.NVarChar(50), order.createdBy).query(`
        INSERT INTO [Transport Order]
          ([No_], [Vehicle Code], [Delivery Date], [Status], [Created By])
        VALUES (@no, @vehicleCode, @deliveryDate, @status, @createdBy)`);
  }

  async findLoad(
    no: string,
    tx: sql.Transaction,
  ): Promise<{ salesOrderNos: string[]; totalWeightKg: number }> {
    const result = await this.db.request(tx).input('no', sql.NVarChar(20), no)
      .query<{ No_: string; 'Total Weight (kg)': number }>(`
        SELECT so.[No_], so.[Total Weight (kg)]
        FROM [Transport Order Line] l
        JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
        WHERE l.[Transport Order No_] = @no`);
    return {
      salesOrderNos: result.recordset.map((row) => row.No_),
      totalWeightKg: sumWeights(
        result.recordset.map((row) => row['Total Weight (kg)']),
      ),
    };
  }

  async insertLines(
    no: string,
    salesOrderNos: readonly string[],
    tx: sql.Transaction,
  ): Promise<void> {
    // One parameterized INSERT per line: a handful of lines per order at most.
    for (const salesOrderNo of salesOrderNos) {
      await this.db
        .request(tx)
        .input('no', sql.NVarChar(20), no)
        .input('salesOrderNo', sql.NVarChar(20), salesOrderNo).query(`
          INSERT INTO [Transport Order Line] ([Transport Order No_], [Sales Order No_])
          VALUES (@no, @salesOrderNo)`);
    }
  }

  async deleteLine(
    no: string,
    salesOrderNo: string,
    tx: sql.Transaction,
  ): Promise<void> {
    await this.db
      .request(tx)
      .input('no', sql.NVarChar(20), no)
      .input('salesOrderNo', sql.NVarChar(20), salesOrderNo).query(`
        DELETE FROM [Transport Order Line]
        WHERE [Transport Order No_] = @no AND [Sales Order No_] = @salesOrderNo`);
  }

  async updateStatus(
    no: string,
    status: TransportOrderStatus,
    tx: sql.Transaction,
    validatedBy?: string,
  ): Promise<void> {
    const request = this.db
      .request(tx)
      .input('no', sql.NVarChar(20), no)
      .input('status', sql.TinyInt, status);
    if (validatedBy) {
      request.input('validatedBy', sql.NVarChar(50), validatedBy);
    }
    await request.query(`
      UPDATE [Transport Order]
      SET [Status] = @status${validatedBy ? ', [Validated By] = @validatedBy' : ''}
      WHERE [No_] = @no`);
  }

  /**
   * Lines live in their own table and do not change the header rowversion.
   * Touching the header after a line change bumps it, so clients holding the
   * previous version get a conflict instead of silently overwriting.
   */
  async touch(no: string, tx: sql.Transaction): Promise<void> {
    await this.db.request(tx).input('no', sql.NVarChar(20), no).query(`
      UPDATE [Transport Order] SET [Status] = [Status] WHERE [No_] = @no`);
  }
}
