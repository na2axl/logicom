import { Module } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { TransportOrdersController } from './transport-orders.controller.js';
import { TransportOrdersRepository } from './transport-orders.repository.js';
import { TransportOrdersService } from './transport-orders.service.js';

@Module({
  imports: [SalesOrdersModule, VehiclesModule],
  controllers: [TransportOrdersController],
  providers: [TransportOrdersService, TransportOrdersRepository, Clock],
})
export class TransportOrdersModule {}
