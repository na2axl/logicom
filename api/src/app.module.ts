import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { BusinessErrorFilter } from './common/business-error.filter.js';
import { appConfig, dbConfig } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { SalesOrdersModule } from './sales-orders/sales-orders.module.js';
import { TransportOrdersModule } from './transport-orders/transport-orders.module.js';
import { CurrentUserGuard } from './users/current-user.js';
import { UsersController } from './users/users.controller.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, dbConfig],
    }),
    DatabaseModule,
    VehiclesModule,
    SalesOrdersModule,
    TransportOrdersModule,
  ],
  controllers: [UsersController],
  providers: [
    { provide: APP_GUARD, useClass: CurrentUserGuard },
    { provide: APP_FILTER, useClass: BusinessErrorFilter },
  ],
})
export class AppModule {}
