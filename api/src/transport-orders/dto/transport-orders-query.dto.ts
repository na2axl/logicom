import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IsIsoDate } from '../../common/is-iso-date.js';
import { PaginationQueryDto } from '../../common/pagination.js';
import {
  TRANSPORT_ORDER_STATUS_CODES,
  type TransportOrderStatusCode,
} from '../domain/transport-order.js';

const STATUS_CODES = Object.values(TRANSPORT_ORDER_STATUS_CODES);

export class TransportOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_CODES })
  @IsOptional()
  @IsIn(STATUS_CODES)
  status?: TransportOrderStatusCode;

  @ApiPropertyOptional({ example: '2026-10-27', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsIsoDate()
  deliveryDate?: string;
}
