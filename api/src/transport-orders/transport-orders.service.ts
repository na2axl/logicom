import { Injectable } from '@nestjs/common';
import type sql from 'mssql';
import { BusinessError } from '../common/business-error.js';
import { Clock } from '../common/clock.js';
import type { Paginated } from '../common/pagination.js';
import { DatabaseService } from '../database/database.service.js';
import { SalesOrdersRepository } from '../sales-orders/sales-orders.repository.js';
import type { User } from '../users/user.js';
import { VehiclesRepository } from '../vehicles/vehicles.repository.js';
import {
  SalesOrderStatus,
  TransportOrderStatus,
  transportOrderStatusFromCode,
} from './domain/transport-order.js';
import {
  assertCanAddSalesOrders,
  assertCanCreate,
  assertCanDepart,
  assertCanRemoveSalesOrder,
  assertCanValidate,
  assertVersionMatches,
  nextTransportOrderNo,
} from './domain/transport-order.rules.js';
import type { CreateTransportOrderDto } from './dto/create-transport-order.dto.js';
import type { TransportOrdersQueryDto } from './dto/transport-orders-query.dto.js';
import {
  TransportOrdersRepository,
  type LockedTransportOrder,
  type TransportOrderDetail,
  type TransportOrderSummary,
} from './transport-orders.repository.js';

/**
 * Use cases of the transport planning. Each mutation runs in one transaction:
 * lock what the rule depends on, check the rule, write, return the new state.
 */
@Injectable()
export class TransportOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clock: Clock,
    private readonly transportOrders: TransportOrdersRepository,
    private readonly salesOrders: SalesOrdersRepository,
    private readonly vehicles: VehiclesRepository,
  ) {}

  findPage(
    query: TransportOrdersQueryDto,
  ): Promise<Paginated<TransportOrderSummary>> {
    return this.transportOrders.findPage({
      status: query.status
        ? transportOrderStatusFromCode(query.status)
        : undefined,
      deliveryDate: query.deliveryDate,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async findOne(no: string): Promise<TransportOrderDetail> {
    const order = await this.transportOrders.findDetail(no);
    if (!order) {
      throw notFound(no);
    }
    return order;
  }

  create(
    dto: CreateTransportOrderDto,
    user: User,
  ): Promise<TransportOrderDetail> {
    return this.db.transaction(async (tx) => {
      const vehicle = await this.vehicles.findByCode(dto.vehicleCode, tx);
      const existingOrderNo =
        await this.transportOrders.findNoForVehicleAndDate(
          dto.vehicleCode,
          dto.deliveryDate,
          tx,
        );
      assertCanCreate({
        vehicleCode: dto.vehicleCode,
        vehicle,
        deliveryDate: dto.deliveryDate,
        today: this.clock.today(),
        existingOrderNo,
      });

      const no = nextTransportOrderNo(
        await this.transportOrders.findLastNo(tx),
      );
      await this.transportOrders.insert(
        {
          no,
          vehicleCode: dto.vehicleCode,
          deliveryDate: dto.deliveryDate,
          createdBy: user.id,
        },
        tx,
      );
      return this.reload(no, tx);
    });
  }

  addSalesOrders(
    no: string,
    salesOrderNos: readonly string[],
    expectedVersion?: string,
  ): Promise<TransportOrderDetail> {
    // Sorted and deduplicated: stable lock order across transactions.
    const requestedNos = [...new Set(salesOrderNos)].sort();

    return this.db.transaction(async (tx) => {
      const order = await this.lockOrder(no, expectedVersion, tx);
      const salesOrders = await this.salesOrders.lockForPlanning(
        requestedNos,
        tx,
      );
      const load = await this.transportOrders.findLoad(no, tx);
      assertCanAddSalesOrders({
        order,
        requestedNos,
        salesOrders,
        currentWeightKg: load.totalWeightKg,
        capacityKg: order.vehicleCapacityKg,
      });

      await this.transportOrders.insertLines(no, requestedNos, tx);
      await this.salesOrders.updateStatus(
        requestedNos,
        SalesOrderStatus.Planned,
        tx,
      );
      await this.transportOrders.touch(no, tx);
      return this.reload(no, tx);
    });
  }

  removeSalesOrder(
    no: string,
    salesOrderNo: string,
    expectedVersion?: string,
  ): Promise<TransportOrderDetail> {
    return this.db.transaction(async (tx) => {
      const order = await this.lockOrder(no, expectedVersion, tx);
      const load = await this.transportOrders.findLoad(no, tx);
      assertCanRemoveSalesOrder({
        order,
        salesOrderNo,
        lineExists: load.salesOrderNos.includes(salesOrderNo),
      });

      // Same lock order as addSalesOrders (order, sales order, then lines),
      // so a concurrent removal and re-addition cannot deadlock.
      await this.salesOrders.lockForPlanning([salesOrderNo], tx);
      await this.transportOrders.deleteLine(no, salesOrderNo, tx);
      await this.salesOrders.updateStatus(
        [salesOrderNo],
        SalesOrderStatus.ToPlan,
        tx,
      );
      await this.transportOrders.touch(no, tx);
      return this.reload(no, tx);
    });
  }

  validate(
    no: string,
    user: User,
    expectedVersion?: string,
  ): Promise<TransportOrderDetail> {
    return this.db.transaction(async (tx) => {
      const order = await this.lockOrder(no, expectedVersion, tx);
      const load = await this.transportOrders.findLoad(no, tx);
      assertCanValidate({
        order,
        user,
        lineCount: load.salesOrderNos.length,
      });

      await this.transportOrders.updateStatus(
        no,
        TransportOrderStatus.Validated,
        tx,
        user.id,
      );
      return this.reload(no, tx);
    });
  }

  depart(no: string, expectedVersion?: string): Promise<TransportOrderDetail> {
    return this.db.transaction(async (tx) => {
      const order = await this.lockOrder(no, expectedVersion, tx);
      assertCanDepart({ order });

      const load = await this.transportOrders.findLoad(no, tx);
      await this.transportOrders.updateStatus(
        no,
        TransportOrderStatus.Departed,
        tx,
      );
      await this.salesOrders.updateStatus(
        load.salesOrderNos,
        SalesOrderStatus.InDelivery,
        tx,
      );
      return this.reload(no, tx);
    });
  }

  private async lockOrder(
    no: string,
    expectedVersion: string | undefined,
    tx: sql.Transaction,
  ): Promise<LockedTransportOrder> {
    const order = await this.transportOrders.lock(no, tx);
    if (!order) {
      throw notFound(no);
    }
    assertVersionMatches(order, expectedVersion);
    return order;
  }

  private async reload(
    no: string,
    tx: sql.Transaction,
  ): Promise<TransportOrderDetail> {
    const order = await this.transportOrders.findDetail(no, tx);
    if (!order) {
      throw notFound(no);
    }
    return order;
  }
}

function notFound(no: string): BusinessError {
  return new BusinessError(
    'not_found',
    'TRANSPORT_ORDER_NOT_FOUND',
    `Transport order ${no} does not exist.`,
    { transportOrderNo: no },
  );
}
