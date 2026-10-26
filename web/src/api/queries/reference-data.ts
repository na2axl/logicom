import { queryOptions } from '@tanstack/vue-query'
import { VehicleModel } from '@/api/models'
import type { UserResource, VehicleResource } from '@/api/resources'
import type { ApiClient } from '@/api/transport'
import { queryKeys } from './keys'

/** Data that barely changes during a session. */
const REFERENCE_STALE_TIME = 5 * 60_000

export function userQueries(client: ApiClient) {
  return {
    all: () =>
      queryOptions({
        queryKey: queryKeys.users.all,
        queryFn: ({ signal }) => client.get<UserResource[]>('/users', { signal }),
        staleTime: Infinity,
      }),
  }
}

export function vehicleQueries(client: ApiClient) {
  return {
    active: () =>
      queryOptions({
        queryKey: queryKeys.vehicles.active,
        queryFn: ({ signal }) => client.get<VehicleResource[]>('/vehicles', { signal }),
        select: (vehicles) => VehicleModel.collection(vehicles),
        staleTime: REFERENCE_STALE_TIME,
      }),
  }
}
