<script setup lang="ts">
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { ApiRequestError, mutations, queries } from '@/api'
import type { ISODate, TransportOrderResource } from '@/api/resources'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useTransportOrderCache } from '@/features/transport-orders/useTransportOrderCache'
import VehicleDateFields from '@/features/transport-orders/VehicleDateFields.vue'
import { errorMessage } from '@/i18n'
import { formatDate, formatKg } from '@/utils/format'

type Mode = 'existing' | 'new'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ salesOrderNos: string[]; weightKg: number }>()
const emit = defineEmits<{
  added: [order: TransportOrderResource]
  /** Sales orders the API refused (planned meanwhile or unknown). */
  unavailable: [salesOrderNos: string[]]
}>()

const UNAVAILABLE_CODES = new Set(['SALES_ORDER_NOT_AVAILABLE', 'SALES_ORDER_NOT_FOUND'])

const { t } = useI18n()
const { applyUpdate, reportFailure } = useTransportOrderCache()

const mode = ref<Mode>('existing')
const targetNo = ref<string | null>(null)
const vehicleCode = ref<string | null>(null)
const deliveryDate = ref<ISODate | null>(null)

const draftsQuery = useQuery(() => ({ ...queries.transportOrders.drafts(), enabled: open.value }))
const drafts = computed(() => draftsQuery.data.value ?? [])
const target = computed(() => drafts.value.find((order) => order.no === targetNo.value))

const create = useMutation(mutations.transportOrders.create())
const addLines = useMutation(mutations.transportOrders.addSalesOrders())
const pending = computed(() => create.isPending.value || addLines.isPending.value)

const canSubmit = computed(() =>
  mode.value === 'existing'
    ? Boolean(target.value?.canFit(props.weightKg))
    : Boolean(vehicleCode.value && deliveryDate.value),
)

// No draft to pick from: go straight to "new order".
const preferredMode = (): Mode =>
  draftsQuery.isSuccess.value && drafts.value.length === 0 ? 'new' : 'existing'

watch(open, (isOpen) => {
  if (!isOpen) return
  mode.value = preferredMode()
  targetNo.value = null
  vehicleCode.value = null
  deliveryDate.value = null
})

watch(drafts, () => {
  if (open.value && !targetNo.value) mode.value = preferredMode()
})

async function resolveTarget(): Promise<{ no: string; version?: string } | null> {
  if (mode.value === 'existing') return target.value ? { no: target.value.no } : null
  if (!vehicleCode.value || !deliveryDate.value) return null
  const created = await create.mutateAsync({
    vehicleCode: vehicleCode.value,
    deliveryDate: deliveryDate.value,
  })
  applyUpdate(created)
  // From now on the order exists: a retry must reuse it, not create another
  // one (the vehicle is booked for that date).
  mode.value = 'existing'
  targetNo.value = created.no
  return { no: created.no, version: created.version }
}

function rejectedSalesOrders(error: unknown): string[] {
  if (!(error instanceof ApiRequestError) || !UNAVAILABLE_CODES.has(error.code)) return []
  const nos = error.details.salesOrderNos
  return Array.isArray(nos) ? nos.filter((no): no is string => typeof no === 'string') : []
}

async function submit(): Promise<void> {
  let orderNo: string | undefined
  try {
    const resolved = await resolveTarget()
    if (!resolved) return
    orderNo = resolved.no
    const order = await addLines.mutateAsync({ ...resolved, salesOrderNos: props.salesOrderNos })
    applyUpdate(order)
    toast.success(t('addToTransport.success', { count: props.salesOrderNos.length, no: order.no }))
    open.value = false
    emit('added', order)
  } catch (error) {
    reportFailure(error, orderNo)
    const rejected = rejectedSalesOrders(error)
    if (rejected.length > 0) emit('unavailable', rejected)
  }
}

function draftLabel(order: (typeof drafts.value)[number]): string {
  return t('addToTransport.remaining', {
    no: order.no,
    vehicle: order.vehicleCode,
    date: formatDate(order.deliveryDate),
    remaining: formatKg(order.capacity.remainingKg),
  })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t('addToTransport.title', { count: salesOrderNos.length }) }}</DialogTitle>
          <DialogDescription>
            {{ t('addToTransport.selectedWeight', { weight: formatKg(weightKg) }) }}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup v-model="mode" class="grid grid-cols-2 gap-2">
          <Label class="flex items-center gap-2 rounded-md border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="existing" data-test="mode-existing" />
            {{ t('addToTransport.existing') }}
          </Label>
          <Label class="flex items-center gap-2 rounded-md border p-3 has-data-[state=checked]:border-primary">
            <RadioGroupItem value="new" data-test="mode-new" />
            {{ t('addToTransport.new') }}
          </Label>
        </RadioGroup>

        <template v-if="mode === 'existing'">
          <div v-if="draftsQuery.isPending.value" class="grid gap-2">
            <Skeleton v-for="index in 3" :key="index" class="h-10 w-full" />
          </div>
          <p v-else-if="draftsQuery.isError.value" class="text-sm text-destructive">
            {{ errorMessage(draftsQuery.error.value) }}
          </p>
          <p v-else-if="drafts.length === 0" class="text-sm text-muted-foreground">
            {{ t('addToTransport.noDraft') }}
          </p>
          <div v-else class="grid gap-2">
            <Label>{{ t('addToTransport.chooseOrder') }}</Label>
            <RadioGroup v-model="targetNo" class="grid max-h-64 gap-1 overflow-y-auto">
              <Label
                v-for="order in drafts"
                :key="order.no"
                class="flex items-center gap-2 rounded-md border p-2.5 font-normal has-data-[state=checked]:border-primary has-disabled:opacity-50"
              >
                <RadioGroupItem
                  :value="order.no"
                  :disabled="!order.canFit(weightKg)"
                  :data-test="`draft-${order.no}`"
                />
                <span class="flex-1">{{ draftLabel(order) }}</span>
                <span v-if="!order.canFit(weightKg)" class="text-xs text-destructive">
                  {{ t('addToTransport.tooHeavy') }}
                </span>
              </Label>
            </RadioGroup>
          </div>
        </template>

        <VehicleDateFields
          v-else
          :min-capacity-kg="weightKg"
          v-model:vehicle-code="vehicleCode"
          v-model:delivery-date="deliveryDate"
        />

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t('common.cancel') }}
          </Button>
          <Button type="submit" :disabled="!canSubmit || pending" data-test="add-submit">
            <Spinner v-if="pending" data-icon="inline-start" />
            {{ t('addToTransport.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
