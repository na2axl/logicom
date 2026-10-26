import { ApiNetworkError, toApiRequestError } from './errors'

export interface ApiClientConfig {
  baseUrl: string
  /** Current user, sent as X-User-Id. */
  getUserId: () => string | null
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined | null>
  signal?: AbortSignal
  /** Version the user is looking at, for optimistic concurrency. */
  ifMatch?: string
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
    }
    const queryString = search.size > 0 ? `?${search}` : ''

    const headers: Record<string, string> = { Accept: 'application/json' }
    const userId = config.getUserId()
    if (userId) headers['X-User-Id'] = userId
    if (options.ifMatch) headers['If-Match'] = options.ifMatch
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}${queryString}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiNetworkError(error)
    }

    if (!response.ok) {
      const raw: unknown = await response.json().catch(() => null)
      throw toApiRequestError(raw, response.status)
    }

    return (response.status === 204 ? undefined : await response.json()) as T
  }

  return {
    get: (path, options) => request('GET', path, undefined, options),
    post: (path, body, options) => request('POST', path, body, options),
    delete: (path, options) => request('DELETE', path, undefined, options),
  }
}
