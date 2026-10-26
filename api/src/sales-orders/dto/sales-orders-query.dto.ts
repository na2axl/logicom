import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class SalesOrdersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Douala',
    description: 'Exact delivery city',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;
}
