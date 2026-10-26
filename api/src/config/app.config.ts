import { registerAs } from '@nestjs/config';

export const config = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Business time zone: decides what "today" is for delivery dates. */
  timezone: process.env.APP_TIMEZONE ?? 'Africa/Douala',
}));
