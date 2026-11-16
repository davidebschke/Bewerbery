import { z } from 'zod'
import type { Stage } from '../../types'

/** Reihenfolge von Tag und Monat bei Datumswerten mit „/“ oder „-“ */
export type DateOrder = 'dmy' | 'mdy'

export interface ParsedDate {
  /** YYYY-MM-DD */
  date: string
  /** HH:mm oder null */
  time: string | null
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur Buchstaben und Ziffern */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

const MONTHS: Record<string, number> = {}
const MONTH_NAMES: [number, string[]][] = [
  [1, ['jan', 'januar', 'january', 'jaenner']],
  [2, ['feb', 'februar', 'february']],
  [3, ['mar', 'maer', 'maerz', 'march', 'mrz']],
  [4, ['apr', 'april']],
  [5, ['mai', 'may']],
  [6, ['jun', 'juni', 'june']],
  [7, ['jul', 'juli', 'july']],
  [8, ['aug', 'august']],
  [9, ['sep', 'sept', 'september']],
  [10, ['okt', 'oct', 'oktober', 'october']],
  [11, ['nov', 'november']],
  [12, ['dez', 'dec', 'dezember', 'december']],
]
for (const [month, names] of MONTH_NAMES) for (const name of names) MONTHS[name] = month

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toYear(value: string): number {
  const year = Number(value)
  return value.length === 2 ? 2000 + year : year
}

function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function buildTime(hours?: string, minutes?: string): string | null {
  if (hours === undefined || minutes === undefined) return null
  const h = Number(hours)
  const m = Number(minutes)
  return h <= 23 && m <= 59 ? `${pad(h)}:${pad(m)}` : null
}

const TIME = String.raw`(?:,?\s+(?:um\s+|at\s+)?(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*uhr)?)?`
const ISO_DATE = new RegExp(
  String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$`,
  'i',
)
const DOT_DATE = new RegExp(String.raw`^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})${TIME}$`, 'i')
const SLASH_DATE = new RegExp(String.raw`^(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})${TIME}$`, 'i')
const DAY_MONTH_NAME = /^(\d{1,2})\.?[\s-]*([a-z]+)\.?[\s,-]*(\d{4}|\d{2})$/i
const MONTH_NAME_DAY = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i

function monthFromName(name: string): number | undefined {
  return MONTHS[normalizeKey(name)]
}

/**
 * Liest ein Datum in gängigen deutschen und englischen Schreibweisen, z. B.
 * „2026-03-15“, „15.03.2026“, „15.03.26 14:30“, „03/15/2026“, „15. März 2026“, „March 15, 2026“.
 */
export function parseDate(raw: string, order: DateOrder = 'dmy'): ParsedDate | null {
  const value = raw.trim().replace(/\s+/g, ' ')
  if (!value) return null

  let match = ISO_DATE.exec(value)
  if (match) {
    const date = buildDate(Number(match[1]), Number(match[2]), Number(match[3]))
    return date ? { date, time: buildTime(match[4], match[5]) } : null
  }

  match = DOT_DATE.exec(value)
  if (match) {
    const date = buildDate(toYear(match[3]), Number(match[2]), Number(match[1]))
    return date ? { date, time: buildTime(match[4], match[5]) } : null
  }

  match = SLASH_DATE.exec(value)
  if (match) {
    const first = Number(match[1])
    const second = Number(match[3])
    const [day, month] = order === 'dmy' ? [first, second] : [second, first]
    const date = buildDate(toYear(match[4]), month, day)
    return date ? { date, time: buildTime(match[5], match[6]) } : null
  }

  // Umlaute für die Monatsnamen-Muster vereinheitlichen („März“ → „maerz“)
  const ascii = value.toLowerCase().replace(/ä/g, 'ae')
  match = DAY_MONTH_NAME.exec(ascii)
  if (match) {
    const month = monthFromName(match[2])
    const date = month ? buildDate(toYear(match[3]), month, Number(match[1])) : null
    return date ? { date, time: null } : null
  }

  match = MONTH_NAME_DAY.exec(ascii)
  if (match) {
    const month = monthFromName(match[1])
    const date = month ? buildDate(Number(match[3]), month, Number(match[2])) : null
    return date ? { date, time: null } : null
  }

  return null
}

export interface DateOrderResult {
  order: DateOrder
  /** true, wenn es Werte wie „03/04/2026“ gibt und keiner die Reihenfolge verrät */
  ambiguous: boolean
}

/** Bestimmt anhand aller Werte einer Spalte, ob „/“-Datumswerte Tag/Monat oder Monat/Tag sind */
export function detectDateOrder(values: string[]): DateOrderResult {
  let slashValues = 0
  let dmy = 0
  let mdy = 0
  for (const value of values) {
    const match = /^(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}/.exec(value.trim())
    if (!match) continue
    slashValues++
    if (Number(match[1]) > 12) dmy++
    if (Number(match[2]) > 12) mdy++
  }
  if (mdy > dmy) return { order: 'mdy', ambiguous: false }
  return { order: 'dmy', ambiguous: slashValues > 0 && dmy === 0 }
}

const STAGE_KEYWORDS: [Stage, string[]][] = [
  [
    'rejected',
    ['absage', 'abgesagt', 'abgelehnt', 'ablehnung', 'reject', 'declined', 'negativ', 'refused'],
  ],
  [
    'offer',
    ['zusage', 'angebot', 'offer', 'accepted', 'angenommen', 'vertrag', 'eingestellt', 'hired'],
  ],
  [
    'interview',
    ['gespraech', 'interview', 'termin', 'vorstellung', 'einladung', 'eingeladen', 'assessment'],
  ],
  [
    'applied',
    [
      'beworben',
      'offen',
      'gesendet',
      'verschickt',
      'abgeschickt',
      'eingereicht',
      'applied',
      'pending',
      'sent',
      'open',
      'submitted',
      'wart',
      'laufend',
      'bearbeitung',
      'progress',
    ],
  ],
]

/** Ordnet einen Statustext (deutsch oder englisch) einer Phase zu; `null` = nicht erkannt */
export function parseStage(raw: string): Stage | null {
  const key = normalizeKey(raw)
  if (!key) return null
  for (const [stage, keywords] of STAGE_KEYWORDS) {
    if (keywords.some((keyword) => key.includes(keyword))) return stage
  }
  return null
}

/** Zieht die erste ganze Zahl aus Texten wie „3 Wochen“ oder „3w“ */
export function parseWeeks(raw: string): number | null {
  const match = /\d+/.exec(raw)
  return match ? Number(match[0]) : null
}

const emailSchema = z.email()

/** Bereinigt eine E-Mail-Adresse („mailto:“, „Name <mail>“); `null` = ungültig */
export function parseEmail(raw: string): string | null {
  let value = raw.trim()
  const angle = /<([^>]+)>/.exec(value)
  if (angle) value = angle[1].trim()
  value = value.replace(/^mailto:/i, '')
  if (!value) return ''
  return emailSchema.safeParse(value).success ? value : null
}

/** Grobe Telefonnummer-Erkennung für die inhaltsbasierte Spaltenzuordnung */
export function looksLikePhone(raw: string): boolean {
  const value = raw.trim()
  return /^[+()\d\s/.-]+$/.test(value) && (value.match(/\d/g) ?? []).length >= 6
}
