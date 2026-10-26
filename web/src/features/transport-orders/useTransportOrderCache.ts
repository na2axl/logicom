import { useQueryClient } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ApiRequestError, queryKeys } from '@/api'
import type { TransportOrderResource } from '@/api/resources'
import { errorMessage } from '@/i18n'

/** 409 (state changed) and 422 (e.g. capacity filled meanwhile): show fresh data. */
const STALE_STATUSES = new Set([409, 422])

/**
 * Shared mutation side effects: every transport order mutation returns the
 * updated order, which becomes the cached detail; lists and sales orders to
 * plan are refetched since statuses and loads changed.
 */
export function useTransportOrderCache() {
  const queryClient = useQueryClient()
  const { t } = useI18n()

  function applyUpdate(order: TransportOrderResource): void {
    queryClient.setQueryData(queryKeys.transportOrders.detail(order.no), order)
    void queryClient.invalidateQueries({ queryKey: queryKeys.transportOrders.lists })
    void queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all })
  }

  /** Toasts the translated error; when the data moved under the user, reloads it. */
  function reportFailure(error: unknown, no?: string): void {
    toast.error(t('errors.title'), { description: errorMessage(error) })
    if (!(error instanceof ApiRequestError) || !STALE_STATUSES.has(error.status)) return
    if (no) void queryClient.invalidateQueries({ queryKey: queryKeys.transportOrders.detail(no) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.transportOrders.lists })
    void queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all })
  }

  return { applyUpdate, reportFailure }
}
