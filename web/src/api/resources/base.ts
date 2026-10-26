/** Calendar date as sent by the API: YYYY-MM-DD. */
export type ISODate = string

export interface PaginatedEnvelope<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PaginationParams {
  page: number
  pageSize: number
}
