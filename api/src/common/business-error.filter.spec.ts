import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { BusinessError } from './business-error.js';
import {
  BusinessErrorFilter,
  type ErrorBody,
} from './business-error.filter.js';

/** Runs the filter on `exception` and returns the status and JSON body sent. */
function render(exception: unknown): { status: number; body: ErrorBody } {
  const sent: { status: number; body: ErrorBody } = {
    status: 0,
    body: {} as ErrorBody,
  };
  const response = {
    status: (code: number) => {
      sent.status = code;
      return response;
    },
    json: (body: ErrorBody) => {
      sent.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  new BusinessErrorFilter().catch(exception, host);
  return sent;
}

describe('BusinessErrorFilter', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it.each([
    ['unauthorized', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['conflict', 409],
    ['unprocessable', 422],
  ] as const)('maps a %s business error to %i', (kind, status) => {
    const result = render(
      new BusinessError(kind, 'SOME_CODE', 'Some message', { a: 1 }),
    );
    expect(result).toEqual({
      status,
      body: {
        statusCode: status,
        code: 'SOME_CODE',
        message: 'Some message',
        details: { a: 1 },
      },
    });
  });

  it('keeps every validation violation', () => {
    const result = render(
      new BadRequestException(['page must be an integer', 'city too long']),
    );
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { violations: ['page must be an integer', 'city too long'] },
    });
  });

  it('turns a SQL Server deadlock into a 409 the user can retry', () => {
    const deadlock = Object.assign(new Error('deadlock victim'), {
      number: 1205,
    });
    expect(render(deadlock)).toMatchObject({
      status: 409,
      body: { code: 'CONCURRENT_MODIFICATION' },
    });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const result = render(new Error('connection string with secrets'));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  });
});
