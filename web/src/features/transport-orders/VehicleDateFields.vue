<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { queries } from '@/api'
import type { ISODate } from '@/api/resources'
import DatePicker from '@/components/app/DatePicker.vue'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/i18n'
import { formatKg } from '@/utils/format'

const vehicleCode = defineModel<string | null>('vehicleCode', { required: true })
const deliveryDate = defineModel<ISODate | null>('deliveryDate', { required: true })

/** Weight the new order must carry: smaller vehicles are not offered. */
const props = defineProps<{ minCapacityKg?: number }>()

const { t } = useI18n()
const vehiclesQuery = useQuery(queries.vehicles.active())

function changeVehicle(value: unknown): void {
  if (typeof value === 'string') vehicleCode.value = value
}
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <Label for="vehicle">{{ t('createOrder.vehicle') }}</Label>
      <Skeleton v-if="vehiclesQuery.isPending.value" class="h-9 w-full" />
      <p v-else-if="vehiclesQuery.isError.value" class="text-sm text-destructive">
        {{ errorMessage(vehiclesQuery.error.value) }}
      </p>
      <Select v-else :model-value="vehicleCode ?? undefined" @update:model-value="changeVehicle">
        <SelectTrigger id="vehicle" class="w-full" data-test="vehicle-select">
          <SelectValue :placeholder="t('createOrder.vehicle')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="vehicle in vehiclesQuery.data.value"
            :key="vehicle.code"
            :value="vehicle.code"
            :disabled="vehicle.capacityKg < (props.minCapacityKg ?? 0)"
          >
            {{
              t('createOrder.vehicleOption', {
                code: vehicle.code,
                plate: vehicle.plateNo,
                capacity: formatKg(vehicle.capacityKg),
              })
            }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="grid gap-2">
      <Label>{{ t('createOrder.deliveryDate') }}</Label>
      <DatePicker
        v-model="deliveryDate"
        :placeholder="t('createOrder.deliveryDate')"
        future-only
      />
    </div>
  </div>
</template>
