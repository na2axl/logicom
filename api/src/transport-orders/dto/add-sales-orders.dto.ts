import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

const MAX_SALES_ORDERS_PER_REQUEST = 100;

export class AddSalesOrdersDto {
  @ApiProperty({ type: [String], example: ['SO-1008', 'SO-1011'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_SALES_ORDERS_PER_REQUEST)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(20, { each: true })
  salesOrderNos!: string[];
}
