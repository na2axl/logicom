<script setup lang="ts">
import AppHeader from '@/components/app/AppHeader.vue'
import ErrorState from '@/components/app/ErrorState.vue'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/sonner'
import { useCurrentUser } from '@/composables/useCurrentUser'

const { user, usersQuery } = useCurrentUser()
</script>

<template>
  <div class="min-h-svh bg-background">
    <AppHeader />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <ErrorState
        v-if="usersQuery.isError.value"
        :error="usersQuery.error.value"
        @retry="usersQuery.refetch()"
      />
      <!-- Views need a current user (X-User-Id); re-mounted when it changes. -->
      <RouterView v-else-if="user" :key="user.id" />
      <div v-else class="flex justify-center py-16">
        <Spinner class="size-6" />
      </div>
    </main>
    <Toaster position="bottom-right" rich-colors />
  </div>
</template>
