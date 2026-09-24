import {
  addDays,
  differenceInCalendarDays,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
} from 'date-fns'

/** Heutiges Datum als YYYY-MM-DD (lokale Zeit) */
export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseIsoDate(value: string): Date {
  return parseISO(value)
}

export function daysBetween(from: string, to: Date): number {
  return differenceInCalendarDays(to, parseIsoDate(from))
}

export function addDaysIso(value: string, days: number): string {
  return toIsoDate(addDays(parseIsoDate(value), days))
}

/** ISO-Wochenschlüssel, z. B. „2026-W39“ */
export function isoWeekKey(date: Date): string {
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`
}

/** „heute“, „gestern“, „vor 5 Tagen“, „in 2 Tagen“ */
export function formatDaysAgo(days: number): string {
  if (days === 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days === -1) return 'morgen'
  return days > 0 ? `vor ${days} Tagen` : `in ${-days} Tagen`
}

export function formatGermanDate(value: string): string {
  return format(parseIsoDate(value), 'dd.MM.yyyy')
}

export function formatGermanDateTime(value: string): string {
  return format(parseISO(value), "dd.MM.yyyy 'um' HH:mm 'Uhr'")
}
