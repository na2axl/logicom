<script setup lang="ts">
import { TruckIcon } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { LOCALES, saveLocale, type Locale } from '@/i18n'

const { t, locale } = useI18n()
const { users, user, selectUser } = useCurrentUser()

const NAV = [
  { to: '/sales-orders', label: 'app.nav.salesOrders' },
  { to: '/transport-orders', label: 'app.nav.transportOrders' },
] as const

function changeLocale(value: unknown): void {
  const next = LOCALES.find((candidate) => candidate === value)
  if (!next) return
  locale.value = next
  saveLocale(next)
}

function changeUser(value: unknown): void {
  if (typeof value === 'string') selectUser(value)
}

const localeLabel = (code: Locale) => code.toUpperCase()
</script>

<template>
  <header class="border-b bg-card">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
      <div class="flex items-center gap-2 font-semibold">
        <TruckIcon class="size-5 text-primary" />
        <span>{{ t('app.title') }}</span>
      </div>

      <nav class="flex gap-1">
        <RouterLink
          v-for="item in NAV"
          :key="item.to"
          :to="item.to"
          class="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          active-class="bg-muted !text-foreground font-medium"
        >
          {{ t(item.label) }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <Select :model-value="user?.id" @update:model-value="changeUser">
          <SelectTrigger size="sm" :aria-label="t('app.user')" data-test="user-select">
            <SelectValue :placeholder="t('app.user')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="candidate in users" :key="candidate.id" :value="candidate.id">
              {{ candidate.id }} · {{ t(`roles.${candidate.role}`) }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select :model-value="locale" @update:model-value="changeLocale">
          <SelectTrigger size="sm" :aria-label="t('app.language')">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="code in LOCALES" :key="code" :value="code">
              {{ localeLabel(code) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </header>
</template>
