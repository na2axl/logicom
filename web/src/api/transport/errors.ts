/** Error body sent by the API: `{ statusCode, code, message, details? }`. */
interface ErrorBody {
  statusCode?: number
  code?: string
  message?: string
  details?: Record<string, unknown>
}

/** The API answered with an error. `code` is stable and translatable. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toApiRequestError(raw: unknown, status: number): ApiRequestError {
  const fallbackCode = status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR'
  const fallback = `Request failed with status ${status}`
  if (!isRecord(raw)) return new ApiRequestError(status, fallbackCode, fallback)

  const body = raw as ErrorBody
  return new ApiRequestError(
    status,
    body.code ?? fallbackCode,
    body.message ?? fallback,
    body.details ?? {},
  )
}

/** The API could not be reached at all. */
export class ApiNetworkError extends Error {
  readonly code = 'NETWORK_ERROR'

  constructor(cause: unknown) {
    super('Unable to reach the API.', { cause })
    this.name = 'ApiNetworkError'
  }
}
