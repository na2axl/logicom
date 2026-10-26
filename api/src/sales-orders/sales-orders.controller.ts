import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '../common/pagination.js';
import { SalesOrdersQueryDto } from './dto/sales-orders-query.dto.js';
import {
  SalesOrdersRepository,
  type SalesOrder,
} from './sales-orders.repository.js';

@ApiTags('sales-orders')
@ApiSecurity('user')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersRepository) {}

  @Get('to-plan')
  @ApiOperation({
    summary: 'Sales orders to plan, filterable by city, paginated',
  })
  findToPlan(
    @Query() query: SalesOrdersQueryDto,
  ): Promise<Paginated<SalesOrder>> {
    return this.salesOrders.findToPlan(query);
  }

  @Get('to-plan/cities')
  @ApiOperation({
    summary: 'Delivery cities having sales orders to plan (filter values)',
  })
  findCities(): Promise<string[]> {
    return this.salesOrders.findCitiesToPlan();
  }
}
