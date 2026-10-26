import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { BusinessError, BusinessErrorKind } from './business-error.js';

const STATUS_BY_KIND: Record<BusinessErrorKind, HttpStatus> = {
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  unprocessable: HttpStatus.UNPROCESSABLE_ENTITY,
};

/** SQL Server errors meaning "lost a race", not "broken": deadlock victim, lock timeout. */
const LOCK_CONFLICT_ERRORS = new Set([1205, 1222]);

function isLockConflict(error: unknown): error is Error & { number: number } {
  return (
    error instanceof Error &&
    'number' in error &&
    LOCK_CONFLICT_ERRORS.has(error.number as number)
  );
}

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Single place that turns any error into the API error envelope
 * `{ statusCode, code, message, details? }`.
 */
@Catch()
export class BusinessErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof BusinessError) {
      return {
        statusCode: STATUS_BY_KIND[exception.kind],
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isLockConflict(exception)) {
      this.logger.warn(`SQL lock conflict: ${exception.message}`);
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'CONCURRENT_MODIFICATION',
        message:
          'The data was being modified by another user at the same time. Please retry.',
      };
    }

    this.logger.error(
      'Unexpected error',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const statusCode: HttpStatus = exception.getStatus();
    const response = exception.getResponse();
    // ValidationPipe returns { message: string[] } : keep every violation.
    const messages =
      typeof response === 'object' && response !== null && 'message' in response
        ? (response as { message: string | string[] }).message
        : exception.message;

    return {
      statusCode,
      code:
        statusCode === HttpStatus.BAD_REQUEST
          ? 'VALIDATION_ERROR'
          : (HttpStatus[statusCode] ?? 'HTTP_ERROR'),
      message: Array.isArray(messages) ? messages.join('; ') : messages,
      details: Array.isArray(messages) ? { violations: messages } : undefined,
    };
  }
}
