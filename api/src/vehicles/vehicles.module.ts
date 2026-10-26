import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesRepository } from './vehicles.repository.js';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesRepository],
  exports: [VehiclesRepository],
})
export class VehiclesModule {}
