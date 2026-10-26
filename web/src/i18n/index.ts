import { createI18n } from 'vue-i18n'
import { ApiNetworkError, ApiRequestError } from '@/api/transport'
import en from './en'
import fr from './fr'

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

const LOCALE_KEY = 'locale'

function readSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY)
    return LOCALES.find((locale) => locale === saved) ?? 'fr'
  } catch {
    return 'fr'
  }
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Storage unavailable (private mode): the choice simply won't persist.
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: readSavedLocale(),
  fallbackLocale: 'fr',
  messages: { fr, en },
})

/** Renders details lists (e.g. sales order numbers) as readable text. */
function toParams(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : value,
    ]),
  )
}

/** Translates an API error by its stable code, falling back to its message. */
export function errorMessage(error: unknown): string {
  const { t, te } = i18n.global
  if (error instanceof ApiNetworkError) return t('errors.NETWORK_ERROR')
  if (error instanceof ApiRequestError) {
    const key = `errors.${error.code}`
    return te(key) ? t(key, { message: error.message, ...toParams(error.details) }) : error.message
  }
  return t('errors.INTERNAL_ERROR')
}
