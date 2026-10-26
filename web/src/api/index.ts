import {
  salesOrderQueries,
  transportOrderMutations,
  transportOrderQueries,
  userQueries,
  vehicleQueries,
} from '@/api/queries'
import { createApiClient } from '@/api/transport'
import { useSessionStore } from '@/stores/session'

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  // Read lazily, at request time: Pinia is installed by then.
  getUserId: () => useSessionStore().userId,
})

export const queries = {
  users: userQueries(apiClient),
  vehicles: vehicleQueries(apiClient),
  salesOrders: salesOrderQueries(apiClient),
  transportOrders: transportOrderQueries(apiClient),
}

export const mutations = {
  transportOrders: transportOrderMutations(apiClient),
}

export { queryKeys } from './queries/keys'
export { ApiNetworkError, ApiRequestError } from './transport'
