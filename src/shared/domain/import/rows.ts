import { MAX_FOLLOW_UP_WEEKS, MIN_FOLLOW_UP_WEEKS, STAGE_LABELS } from '../../constants'
import type { Application, Stage } from '../../types'
import { createApplication } from '../factory'
import { columnLabel, type ColumnTarget } from './fields'
import { normalizeKey, parseDate, parseEmail, parseStage, parseWeeks, type DateOrder } from './values'

/** Uhrzeit für Termine ohne Zeitangabe */
export const DEFAULT_APPOINTMENT_TIME = '09:00'

/** Eine Tabellenzeile, aufbereitet für Vorschau und Import */
export interface ImportDraft {
  /** Zeilennummer in der Tabelle (1-basiert) */
  rowNumber: number
  company: string
  position: string
  /** YYYY-MM-DD oder '' wenn fehlend/ungültig */
  sentAt: string
  stage: Stage
  lastFollowUpAt: string | null
  followUpWeeks: number | null
  /** YYYY-MM-DDTHH:mm */
  appointmentAt: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
  /** Hinweise zu nicht erkannten Werten */
  warnings: string[]
}

export interface BuildOptions {
  /** Index der Kopfzeile oder `null`, wenn die Tabelle keine hat */
  headerRow: number | null
  mapping: ColumnTarget[]
  dateOrder: DateOrder
}

const SUMMARY_ROW = /^(summe|gesamt|total|anzahl|sum|count)\b/i

function isBlank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === '')
}

/** Summen- oder Zählzeilen am Tabellenende („Summe: 12“) gehören nicht zu den Daten */
function isSummaryRow(row: string[]): boolean {
  const filled = row.map((cell) => cell.trim()).filter(Boolean)
  return filled.length <= 2 && filled.some((cell) => SUMMARY_ROW.test(cell))
}

/** Liefert die Datenzeilen (ohne Kopfzeile) samt Zeilennummer */
export function dataRowsOf(
  rows: string[][],
  headerRow: number | null,
): { rowNumber: number; cells: string[] }[] {
  const start = headerRow === null ? 0 : headerRow + 1
  return rows
    .slice(start)
    .map((cells, offset) => ({ rowNumber: start + offset + 1, cells }))
    .filter(({ cells }) => !isBlank(cells) && !isSummaryRow(cells))
}

function joinText(current: string, addition: string): string {
  return current ? `${current}\n${addition}` : addition
}

/** Baut aus einer Tabellenzeile einen Import-Entwurf und sammelt Hinweise */
function buildDraft(
  rowNumber: number,
  cells: string[],
  header: string[] | null,
  { mapping, dateOrder }: BuildOptions,
): ImportDraft {
  const draft: ImportDraft = {
    rowNumber,
    company: '',
    position: '',
    sentAt: '',
    stage: 'applied',
    lastFollowUpAt: null,
    followUpWeeks: null,
    appointmentAt: null,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    warnings: [],
  }
  const extraNotes: string[] = []
  const originals: string[] = []

  const keepOriginal = (label: string, value: string, warning: string) => {
    draft.warnings.push(warning)
    originals.push(`${label}: ${value}`)
  }

  mapping.forEach((target, index) => {
    const value = (cells[index] ?? '').trim()
    if (!value || target === 'ignore') return
    const label = columnLabel(header, index)

    switch (target) {
      case 'company':
      case 'position':
      case 'contactName':
      case 'contactPhone':
        draft[target] = value
        break
      case 'notes':
        draft.notes = joinText(draft.notes, value)
        break
      case 'appendNotes':
        extraNotes.push(`${label}: ${value}`)
        break
      case 'sentAt':
      case 'lastFollowUpAt': {
        const parsed = parseDate(value, dateOrder)
        if (parsed) draft[target] = parsed.date
        else keepOriginal(label, value, `${label}: Datum „${value}“ nicht erkannt`)
        break
      }
      case 'appointmentAt': {
        const parsed = parseDate(value, dateOrder)
        if (!parsed) {
          keepOriginal(label, value, `${label}: Termin „${value}“ nicht erkannt`)
        } else {
          if (!parsed.time) {
            draft.warnings.push(
              `${label}: keine Uhrzeit angegeben – ${DEFAULT_APPOINTMENT_TIME} Uhr angenommen`,
            )
          }
          draft.appointmentAt = `${parsed.date}T${parsed.time ?? DEFAULT_APPOINTMENT_TIME}`
        }
        break
      }
      case 'stage': {
        const stage = parseStage(value)
        if (stage) draft.stage = stage
        else {
          keepOriginal(
            label,
            value,
            `${label}: „${value}“ nicht erkannt – „${STAGE_LABELS.applied}“ übernommen`,
          )
        }
        break
      }
      case 'followUpWeeks': {
        const weeks = parseWeeks(value)
        if (weeks !== null && weeks >= MIN_FOLLOW_UP_WEEKS && weeks <= MAX_FOLLOW_UP_WEEKS) {
          draft.followUpWeeks = weeks
        } else {
          keepOriginal(
            label,
            value,
            `${label}: „${value}“ ist keine Frist von ${MIN_FOLLOW_UP_WEEKS}–${MAX_FOLLOW_UP_WEEKS} Wochen – Standard übernommen`,
          )
        }
        break
      }
      case 'contactEmail': {
        const email = parseEmail(value)
        if (email) draft.contactEmail = email
        else keepOriginal(label, value, `${label}: „${value}“ ist keine gültige E-Mail-Adresse`)
        break
      }
    }
  })

  for (const note of [...extraNotes, ...originals]) draft.notes = joinText(draft.notes, note)
  return draft
}

/** Wandelt die Datenzeilen eines Tabellenblatts in Import-Entwürfe um */
export function buildDrafts(rows: string[][], options: BuildOptions): ImportDraft[] {
  const header = options.headerRow === null ? null : (rows[options.headerRow] ?? [])
  return dataRowsOf(rows, options.headerRow).map(({ rowNumber, cells }) =>
    buildDraft(rowNumber, cells, header, options),
  )
}

/** Pflichtfeld-Fehler eines Entwurfs; leer = importierbar */
export function draftErrors(draft: ImportDraft, fallbackSentAt = ''): string[] {
  const errors: string[] = []
  if (!draft.company.trim()) errors.push('Unternehmen fehlt')
  if (!draft.position.trim()) errors.push('Position fehlt')
  if (!draft.sentAt && !parseDate(fallbackSentAt)) errors.push('Datum fehlt oder ist ungültig')
  return errors
}

function duplicateKey(company: string, position: string, sentAt: string): string {
  return `${normalizeKey(company)}|${normalizeKey(position)}|${sentAt}`
}

/**
 * Zeilennummern der Entwürfe, die eine vorhandene (oder weiter oben importierte) Bewerbung
 * mit gleichem Unternehmen, gleicher Position und gleichem Datum wiederholen.
 */
export function findDuplicates(
  drafts: ImportDraft[],
  existing: Application[],
  fallbackSentAt = '',
): Set<number> {
  const seen = new Set(existing.map((app) => duplicateKey(app.company, app.position, app.sentAt)))
  const duplicates = new Set<number>()
  for (const draft of drafts) {
    const key = duplicateKey(draft.company, draft.position, draft.sentAt || fallbackSentAt)
    if (seen.has(key)) duplicates.add(draft.rowNumber)
    else seen.add(key)
  }
  return duplicates
}

export interface ToApplicationsOptions {
  now: Date
  fallbackSentAt?: string
}

/** Erzeugt aus gültigen Entwürfen fertige Bewerbungen */
export function draftsToApplications(
  drafts: ImportDraft[],
  { now, fallbackSentAt = '' }: ToApplicationsOptions,
): Application[] {
  return drafts.map((draft) => {
    const application = createApplication(
      {
        company: draft.company,
        position: draft.position,
        contactName: draft.contactName,
        contactPhone: draft.contactPhone,
        contactEmail: draft.contactEmail,
        sentAt: draft.sentAt || fallbackSentAt,
        followUpWeeks: draft.followUpWeeks,
        notes: draft.notes,
      },
      { now },
    )
    return {
      ...application,
      stage: draft.stage,
      lastFollowUpAt: draft.lastFollowUpAt,
      appointmentAt: draft.appointmentAt,
      // Bereits erreichte Phase gilt als belohnt – spätere Wechsel zählen nicht doppelt
      awardedStages: draft.stage === 'applied' ? [] : [draft.stage],
    }
  })
}
