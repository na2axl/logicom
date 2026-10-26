import { registerAs } from '@nestjs/config';

export const config = registerAs('db', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '', 10) || 1433,
  user: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  name: process.env.DB_NAME ?? 'TransportPlanning',
}));
