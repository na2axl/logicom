import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { VehiclesRepository, type Vehicle } from './vehicles.repository.js';

@ApiTags('vehicles')
@ApiSecurity('user')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesRepository) {}

  @Get()
  @ApiOperation({ summary: 'Active vehicles' })
  list(): Promise<Vehicle[]> {
    return this.vehicles.findActive();
  }
}
