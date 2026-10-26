<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { mutations } from '@/api'
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
import { Spinner } from '@/components/ui/spinner'
import { useTransportOrderCache } from './useTransportOrderCache'
import VehicleDateFields from './VehicleDateFields.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [order: TransportOrderResource] }>()

const { t } = useI18n()
const { applyUpdate, reportFailure } = useTransportOrderCache()

const vehicleCode = ref<string | null>(null)
const deliveryDate = ref<ISODate | null>(null)
const canSubmit = computed(() => Boolean(vehicleCode.value && deliveryDate.value))

const create = useMutation({
  ...mutations.transportOrders.create(),
  onSuccess: (order) => {
    applyUpdate(order)
    toast.success(t('createOrder.success', { no: order.no }))
    open.value = false
    emit('created', order)
  },
  onError: (error) => reportFailure(error),
})

watch(open, (isOpen) => {
  if (!isOpen) return
  vehicleCode.value = null
  deliveryDate.value = null
  create.reset()
})

function submit(): void {
  if (!vehicleCode.value || !deliveryDate.value) return
  create.mutate({ vehicleCode: vehicleCode.value, deliveryDate: deliveryDate.value })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t('createOrder.title') }}</DialogTitle>
          <DialogDescription class="sr-only">{{ t('createOrder.title') }}</DialogDescription>
        </DialogHeader>

        <VehicleDateFields
          v-model:vehicle-code="vehicleCode"
          v-model:delivery-date="deliveryDate"
        />

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t('common.cancel') }}
          </Button>
          <Button
            type="submit"
            :disabled="!canSubmit || create.isPending.value"
            data-test="create-submit"
          >
            <Spinner v-if="create.isPending.value" data-icon="inline-start" />
            {{ t('createOrder.submit') }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
