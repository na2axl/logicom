import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Config } from './config/index.js';
import { setupApp } from './setup-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const { port } = app
    .get<ConfigService<Config, true>>(ConfigService)
    .get('app', { infer: true });
  await app.listen(port);
  Logger.log(`API on http://localhost:${port} (docs: /docs)`, 'Bootstrap');
}

void bootstrap();
