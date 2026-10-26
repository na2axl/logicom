import { Module } from '@nestjs/common';
import { SalesOrdersController } from './sales-orders.controller.js';
import { SalesOrdersRepository } from './sales-orders.repository.js';

@Module({
  controllers: [SalesOrdersController],
  providers: [SalesOrdersRepository],
  exports: [SalesOrdersRepository],
})
export class SalesOrdersModule {}
