import type { ConfigType } from '@nestjs/config';
import { config as appConfig } from './app.config.js';
import { config as dbConfig } from './db.config.js';

export interface Config {
  app: ConfigType<typeof appConfig>;
  db: ConfigType<typeof dbConfig>;
}

export { appConfig, dbConfig };
