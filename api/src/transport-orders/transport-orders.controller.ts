import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Paginated } from '../common/pagination.js';
import { CurrentUser } from '../users/current-user.js';
import type { User } from '../users/user.js';
import { AddSalesOrdersDto } from './dto/add-sales-orders.dto.js';
import { CreateTransportOrderDto } from './dto/create-transport-order.dto.js';
import { TransportOrdersQueryDto } from './dto/transport-orders-query.dto.js';
import type {
  TransportOrderDetail,
  TransportOrderSummary,
} from './transport-orders.repository.js';
import { TransportOrdersService } from './transport-orders.service.js';

const IF_MATCH_HEADER = {
  name: 'If-Match',
  required: false,
  description:
    'Version of the order the client displayed. If it changed since, the request fails with 409.',
};

/** Accepts `abc`, `"abc"` and `W/"abc"` forms of If-Match. */
function parseIfMatch(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/^W\//, '').replace(/"/g, '') : undefined;
}

@ApiTags('transport-orders')
@ApiSecurity('user')
@Controller('transport-orders')
export class TransportOrdersController {
  constructor(private readonly service: TransportOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated list, filterable by status and date' })
  findPage(
    @Query() query: TransportOrdersQueryDto,
  ): Promise<Paginated<TransportOrderSummary>> {
    return this.service.findPage(query);
  }

  @Get(':no')
  @ApiOperation({ summary: 'Detail with its sales orders and total weight' })
  @ApiNotFoundResponse()
  findOne(@Param('no') no: string): Promise<TransportOrderDetail> {
    return this.service.findOne(no);
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft transport order' })
  @ApiCreatedResponse()
  @ApiConflictResponse({ description: 'Vehicle already booked on that date' })
  @ApiUnprocessableEntityResponse({
    description: 'Unknown or inactive vehicle, date in the past',
  })
  create(
    @Body() dto: CreateTransportOrderDto,
    @CurrentUser() user: User,
  ): Promise<TransportOrderDetail> {
    return this.service.create(dto, user);
  }

  @Post(':no/lines')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add one or more sales orders' })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiOkResponse()
  @ApiConflictResponse({
    description: 'Order not draft, sales order not available, stale version',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Capacity exceeded, unknown sales order',
  })
  addSalesOrders(
    @Param('no') no: string,
    @Body() dto: AddSalesOrdersDto,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetail> {
    return this.service.addSalesOrders(
      no,
      dto.salesOrderNos,
      parseIfMatch(ifMatch),
    );
  }

  @Delete(':no/lines/:salesOrderNo')
  @ApiOperation({ summary: 'Remove a sales order' })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiOkResponse({ description: 'Updated transport order' })
  @ApiConflictResponse({ description: 'Order not draft, stale version' })
  removeSalesOrder(
    @Param('no') no: string,
    @Param('salesOrderNo') salesOrderNo: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetail> {
    return this.service.removeSalesOrder(
      no,
      salesOrderNo,
      parseIfMatch(ifMatch),
    );
  }

  @Post(':no/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate (LOGISTICS_MANAGER only)' })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiForbiddenResponse({ description: 'User is not a logistics manager' })
  @ApiConflictResponse({ description: 'Order not draft, stale version' })
  @ApiUnprocessableEntityResponse({ description: 'Order has no sales order' })
  validate(
    @Param('no') no: string,
    @CurrentUser() user: User,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetail> {
    return this.service.validate(no, user, parseIfMatch(ifMatch));
  }

  @Post(':no/depart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a validated order as departed' })
  @ApiHeader(IF_MATCH_HEADER)
  @ApiConflictResponse({ description: 'Order not validated, stale version' })
  depart(
    @Param('no') no: string,
    @Headers('if-match') ifMatch?: string,
  ): Promise<TransportOrderDetail> {
    return this.service.depart(no, parseIfMatch(ifMatch));
  }
}
