import { defineStore } from 'pinia'
import { ref } from 'vue'

const USER_KEY = 'currentUserId'

function readSavedUserId(): string | null {
  try {
    return localStorage.getItem(USER_KEY)
  } catch {
    return null
  }
}

/** Simulated login: the selected user is sent as X-User-Id on every call. */
export const useSessionStore = defineStore('session', () => {
  const userId = ref<string | null>(readSavedUserId())

  function selectUser(id: string): void {
    userId.value = id
    try {
      localStorage.setItem(USER_KEY, id)
    } catch {
      // Storage unavailable (private mode): the choice lasts for the session.
    }
  }

  return { userId, selectUser }
})
