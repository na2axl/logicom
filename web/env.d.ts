/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API (default http://localhost:3000). */
  readonly VITE_API_URL?: string
  /** Business time zone, same as the API's APP_TIMEZONE (default Africa/Douala). */
  readonly VITE_APP_TIMEZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
