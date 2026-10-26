import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** A calendar date as YYYY-MM-DD (no time part), and a real one (no 02-30). */
export function IsIsoDate(): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: ({ property }) => `${property} must be a date (YYYY-MM-DD)`,
    }),
    IsISO8601({ strict: true }),
  );
}
