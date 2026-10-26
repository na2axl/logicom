/**
 * Kind of business rule violation. Mapped to an HTTP status by
 * BusinessErrorFilter, so the domain layer never depends on HTTP.
 */
export type BusinessErrorKind =
  | 'unauthorized' // 401 : unknown user
  | 'forbidden' // 403 : role not allowed
  | 'not_found' // 404 : resource of the URL does not exist
  | 'conflict' // 409 : incompatible with the current state
  | 'unprocessable'; // 422 : request content violates a business rule

/**
 * Error raised when a business rule is violated.
 * `code` is a stable identifier the front translates; `message` is for humans and logs.
 */
export class BusinessError extends Error {
  constructor(
    readonly kind: BusinessErrorKind,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
