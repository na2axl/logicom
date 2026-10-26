import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Config } from './config/index.js';
import { USER_HEADER } from './users/current-user.js';

/** Shared by main.ts and the e2e tests, so both run the same pipeline. */
export function setupApp(app: INestApplication): void {
  const { corsOrigin } = app
    .get<ConfigService<Config, true>>(ConfigService)
    .get('app', { infer: true });

  app.enableCors({ origin: corsOrigin });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Transport planning API')
    .setDescription(
      'Send the current user in the X-User-Id header (diane or eric).',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: USER_HEADER }, 'user')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
}
