import { useQuery } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { queries } from '@/api'
import { useSessionStore } from '@/stores/session'

/**
 * Current user = id chosen in the session store + role from GET /users.
 * Selects the first known user when none (or an unknown one) is chosen.
 */
export function useCurrentUser() {
  const session = useSessionStore()
  const usersQuery = useQuery(queries.users.all())

  const users = computed(() => usersQuery.data.value ?? [])
  const user = computed(() => users.value.find((candidate) => candidate.id === session.userId))
  const role = computed(() => user.value?.role)

  watchEffect(() => {
    const first = users.value[0]
    if (first && !user.value) session.selectUser(first.id)
  })

  return { users, user, role, usersQuery, selectUser: session.selectUser }
}
