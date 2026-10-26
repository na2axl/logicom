import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsIsoDate } from '../../common/is-iso-date.js';

export class CreateTransportOrderDto {
  @ApiProperty({ example: 'VH-05' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehicleCode!: string;

  @ApiProperty({ example: '2026-10-28', description: 'YYYY-MM-DD' })
  @IsIsoDate()
  deliveryDate!: string;
}
