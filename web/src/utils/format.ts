import { i18n } from '@/i18n'

const currentLocale = () => i18n.global.locale.value

export function formatKg(kg: number): string {
  const value = new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2 }).format(kg)
  return i18n.global.t('common.kg', { value })
}

/** Formats an API date (YYYY-MM-DD) without any time zone shift. */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

