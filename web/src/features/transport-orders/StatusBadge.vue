<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TransportOrderStatus } from '@/api/resources'
import { Badge, type BadgeVariants } from '@/components/ui/badge'

defineProps<{ status: TransportOrderStatus }>()

const VARIANTS: Record<TransportOrderStatus, BadgeVariants['variant']> = {
  DRAFT: 'outline',
  VALIDATED: 'default',
  DEPARTED: 'secondary',
}

const { t } = useI18n()
</script>

<template>
  <Badge :variant="VARIANTS[status]" :data-status="status">
    {{ t(`transportOrderStatus.${status}`) }}
  </Badge>
</template>
