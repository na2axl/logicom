<script setup lang="ts">
import { ArrowLeftIcon, CheckIcon, PlusIcon, TrashIcon, TruckIcon } from '@lucide/vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ApiRequestError, mutations, queries } from '@/api'
import ErrorState from '@/components/app/ErrorState.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCurrentUser } from '@/composables/useCurrentUser'
import CapacityGauge from '@/features/transport-orders/CapacityGauge.vue'
import ConfirmAction from '@/features/transport-orders/ConfirmAction.vue'
import StatusBadge from '@/features/transport-orders/StatusBadge.vue'
import { useTransportOrderCache } from '@/features/transport-orders/useTransportOrderCache'
import { formatDate, formatKg } from '@/utils/format'

const props = defineProps<{ no: string }>()

const { t } = useI18n()
const { role } = useCurrentUser()
const { applyUpdate, reportFailure } = useTransportOrderCache()

const orderQuery = useQuery(() => queries.transportOrders.detail(props.no))
const order = computed(() => orderQuery.data.value)
const actions = computed(() => order.value?.actionsFor(role.value))
const notFound = computed(
  () => orderQuery.error.value instanceof ApiRequestError && orderQuery.error.value.isNotFound,
)

const callbacks = (successKey: string, extra: Record<string, string> = {}) => ({
  onSuccess: (updated: Parameters<typeof applyUpdate>[0]) => {
    applyUpdate(updated)
    toast.success(t(successKey, { no: updated.no, ...extra }))
  },
  onError: (error: Error) => reportFailure(error, props.no),
})

const removeLine = useMutation(() => ({
  ...mutations.transportOrders.removeSalesOrder(props.no),
  onSuccess: (updated, { salesOrderNo }) => {
    applyUpdate(updated)
    toast.success(t('detail.removed', { salesOrderNo }))
  },
  onError: (error: Error) => reportFailure(error, props.no),
}))
const validate = useMutation(() => ({
  ...mutations.transportOrders.validate(props.no),
  ...callbacks('detail.validated'),
}))
const depart = useMutation(() => ({
  ...mutations.transportOrders.depart(props.no),
  ...callbacks('detail.departed'),
}))

// Also busy while reloading: the version is about to change.
const busy = computed(
  () =>
    orderQuery.isFetching.value ||
    removeLine.isPending.value ||
    validate.isPending.value ||
    depart.isPending.value,
)

function version(): string {
  return order.value?.version ?? ''
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div>
      <Button variant="ghost" size="sm" as-child>
        <RouterLink to="/transport-orders">
          <ArrowLeftIcon data-icon="inline-start" />
          {{ t('common.back') }}
        </RouterLink>
      </Button>
    </div>

    <div v-if="orderQuery.isPending.value" class="grid gap-4" data-test="detail-loading">
      <Skeleton class="h-8 w-72" />
      <Skeleton class="h-32 w-full" />
      <Skeleton class="h-48 w-full" />
    </div>

    <Alert v-else-if="notFound" data-test="not-found">
      <AlertDescription>{{ t('detail.notFound') }}</AlertDescription>
    </Alert>

    <ErrorState
      v-else-if="orderQuery.isError.value && !order"
      :error="orderQuery.error.value"
      @retry="orderQuery.refetch()"
    />

    <template v-else-if="order && actions">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ t('detail.title', { no: order.no }) }}
          </h1>
          <StatusBadge :status="order.status" />
        </div>

        <div class="flex flex-wrap gap-2">
          <Button v-if="actions.editLines" variant="outline" as-child>
            <RouterLink to="/sales-orders">
              <PlusIcon data-icon="inline-start" />
              {{ t('detail.addSalesOrders') }}
            </RouterLink>
          </Button>
          <ConfirmAction
            v-if="actions.validate"
            :title="t('detail.validate')"
            :description="t('detail.validateConfirm', { no: order.no })"
            :confirm-label="t('detail.validate')"
            @confirm="validate.mutate({ version: version() })"
          >
            <Button :disabled="busy" data-test="validate">
              <Spinner v-if="validate.isPending.value" data-icon="inline-start" />
              <CheckIcon v-else data-icon="inline-start" />
              {{ t('detail.validate') }}
            </Button>
          </ConfirmAction>
          <ConfirmAction
            v-if="actions.depart"
            :title="t('detail.depart')"
            :description="t('detail.departConfirm', { no: order.no })"
            :confirm-label="t('detail.depart')"
            @confirm="depart.mutate({ version: version() })"
          >
            <Button :disabled="busy" data-test="depart">
              <Spinner v-if="depart.isPending.value" data-icon="inline-start" />
              <TruckIcon v-else data-icon="inline-start" />
              {{ t('detail.depart') }}
            </Button>
          </ConfirmAction>
        </div>
      </div>

      <Card>
        <CardContent class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div class="grid gap-1">
            <span class="text-xs text-muted-foreground">{{ t('detail.vehicle') }}</span>
            <span class="font-medium">{{ order.vehicleCode }} · {{ order.vehiclePlateNo }}</span>
          </div>
          <div class="grid gap-1">
            <span class="text-xs text-muted-foreground">{{ t('detail.deliveryDate') }}</span>
            <span class="font-medium">{{ formatDate(order.deliveryDate) }}</span>
          </div>
          <div class="grid gap-1">
            <span class="text-xs text-muted-foreground">{{ t('detail.createdBy') }}</span>
            <span class="font-medium">{{ order.createdBy }}</span>
          </div>
          <div class="grid gap-1">
            <span class="text-xs text-muted-foreground">{{ t('detail.validatedBy') }}</span>
            <span class="font-medium">{{ order.validatedBy ?? '—' }}</span>
          </div>
          <div class="grid gap-2 sm:col-span-2 lg:col-span-4">
            <span class="text-xs text-muted-foreground">{{ t('detail.load') }}</span>
            <CapacityGauge :weight-kg="order.weightKg" :capacity-kg="order.capacityKg" />
          </div>
        </CardContent>
      </Card>

      <Alert v-if="!order.isDraft">
        <AlertDescription>{{ t('detail.readOnly') }}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{{ t('detail.salesOrders') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('salesOrders.no') }}</TableHead>
                <TableHead>{{ t('salesOrders.customer') }}</TableHead>
                <TableHead>{{ t('salesOrders.city') }}</TableHead>
                <TableHead class="text-right">{{ t('salesOrders.weight') }}</TableHead>
                <TableHead v-if="actions.editLines" class="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="line in order.salesOrders" :key="line.no">
                <TableCell class="font-medium">{{ line.no }}</TableCell>
                <TableCell>{{ line.customerName }}</TableCell>
                <TableCell>{{ line.deliveryCity }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ formatKg(line.weightKg) }}</TableCell>
                <TableCell v-if="actions.editLines" class="text-right">
                  <ConfirmAction
                    :title="t('detail.remove')"
                    :description="t('detail.removeConfirm', { salesOrderNo: line.no, no: order.no })"
                    :confirm-label="t('detail.remove')"
                    @confirm="removeLine.mutate({ salesOrderNo: line.no, version: version() })"
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      :disabled="busy"
                      :aria-label="t('detail.remove')"
                      :data-test="`remove-${line.no}`"
                    >
                      <TrashIcon />
                    </Button>
                  </ConfirmAction>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="order.salesOrders.length === 0" :colspan="actions.editLines ? 5 : 4">
                <span class="text-muted-foreground">{{ t('detail.noSalesOrders') }}</span>
              </TableEmpty>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
