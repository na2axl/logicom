import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Config } from '../config/index.js';

/** Formats a date as YYYY-MM-DD in the given IANA time zone. */
export function toIsoDateInZone(date: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Source of "today". Injected so business rules stay deterministic in tests,
 * and computed in the business time zone rather than the server's.
 */
@Injectable()
export class Clock {
  constructor(private readonly config: ConfigService<Config, true>) {}

  today(): string {
    return toIsoDateInZone(
      new Date(),
      this.config.get('app.timezone', { infer: true }),
    );
  }
}
