<script setup lang="ts">
import { CircleAlertIcon, RefreshCwIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/i18n'

const props = defineProps<{ error: unknown }>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
const message = computed(() => errorMessage(props.error))
</script>

<template>
  <Alert variant="destructive" data-test="error-state">
    <CircleAlertIcon />
    <AlertTitle>{{ t('errors.loadTitle') }}</AlertTitle>
    <AlertDescription class="flex flex-wrap items-center justify-between gap-3">
      <span>{{ message }}</span>
      <Button variant="outline" size="sm" @click="emit('retry')">
        <RefreshCwIcon data-icon="inline-start" />
        {{ t('common.retry') }}
      </Button>
    </AlertDescription>
  </Alert>
</template>
