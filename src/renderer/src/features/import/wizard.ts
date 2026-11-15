import {
  columnLabel,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  matchColumns,
  REQUIRED_IMPORT_FIELDS,
  type ColumnTarget,
  type ImportField,
} from '@shared/domain/import/fields'
import { dataRowsOf, draftErrors, type ImportDraft } from '@shared/domain/import/rows'
import { detectDateOrder, type DateOrderResult } from '@shared/domain/import/values'

/** Bis zu dieser Zeile wird die Kopfzeile zur Auswahl angeboten */
export const HEADER_CHOICES = 20

const DATE_FIELDS: ColumnTarget[] = ['sentAt', 'lastFollowUpAt', 'appointmentAt']

export function headerOf(rows: string[][], headerRow: number | null): string[] | null {
  return headerRow === null ? null : (rows[headerRow] ?? [])
}

/** Automatische Spaltenzuordnung für eine gewählte Kopfzeile */
export function analyzeColumns(rows: string[][], headerRow: number | null): ColumnTarget[] {
  const data = dataRowsOf(rows, headerRow).map((row) => row.cells)
  return matchColumns(headerOf(rows, headerRow), data)
}

/** Ermittelt die Datumsreihenfolge aus den Spalten, die Datumsfeldern zugeordnet sind */
export function detectOrderFor(
  rows: string[][],
  headerRow: number | null,
  mapping: ColumnTarget[],
): DateOrderResult {
  const values = dataRowsOf(rows, headerRow).flatMap(({ cells }) =>
    mapping.flatMap((target, index) => (DATE_FIELDS.includes(target) ? [cells[index] ?? ''] : [])),
  )
  return detectDateOrder(values)
}

/** Die ersten Beispielwerte einer Spalte für die Zuordnungsansicht */
export function columnSamples(
  rows: string[][],
  headerRow: number | null,
  index: number,
  limit = 3,
): string[] {
  return dataRowsOf(rows, headerRow)
    .map(({ cells }) => (cells[index] ?? '').trim())
    .filter(Boolean)
    .slice(0, limit)
}

/** Anzeigename aller Spalten */
export function columnLabels(rows: string[][], headerRow: number | null, count: number): string[] {
  const header = headerOf(rows, headerRow)
  return Array.from({ length: count }, (_, index) => columnLabel(header, index))
}

/**
 * Setzt das Ziel einer Spalte. Ein Feld (außer Notizen) gehört immer nur einer Spalte –
 * die bisherige Spalte wandert dann in die Notizen.
 */
export function reassign(
  mapping: ColumnTarget[],
  index: number,
  target: ColumnTarget,
): ColumnTarget[] {
  return mapping.map((current, i) => {
    if (i === index) return target
    if (
      current === target &&
      target !== 'notes' &&
      target !== 'appendNotes' &&
      target !== 'ignore'
    ) {
      return 'appendNotes'
    }
    return current
  })
}

/** Pflichtfelder, denen keine Spalte zugeordnet ist */
export function missingRequired(mapping: ColumnTarget[]): ImportField[] {
  return REQUIRED_IMPORT_FIELDS.filter((field) => !mapping.includes(field))
}

/** Kurzvorschau einer Zeile für die Kopfzeilen-Auswahl */
export function rowPreview(row: string[] | undefined, maxCells = 3): string {
  const cells = (row ?? []).map((cell) => cell.trim()).filter(Boolean)
  if (!cells.length) return '(leer)'
  const text = cells.slice(0, maxCells).join(' · ')
  return cells.length > maxCells ? `${text} …` : text
}

export const TARGET_LABELS: Record<ColumnTarget, string> = {
  ...IMPORT_FIELD_LABELS,
  appendNotes: 'In Notizen übernehmen',
  ignore: 'Ignorieren',
}

/** Alle Ziele in der Reihenfolge der Auswahlliste */
export const COLUMN_TARGETS: ColumnTarget[] = [...IMPORT_FIELDS, 'appendNotes', 'ignore']

export type RowStatus = 'ok' | 'warning' | 'duplicate' | 'error'

export interface PreviewRow {
  draft: ImportDraft
  errors: string[]
  duplicate: boolean
  included: boolean
  status: RowStatus
}

export interface PreviewState {
  rows: PreviewRow[]
  included: ImportDraft[]
  errorCount: number
  warningCount: number
  duplicateCount: number
  /** Zeilen ohne Datum, für die ein Ersatzdatum greifen würde */
  missingDateCount: number
}

/** Bewertet alle Entwürfe für die Vorschau */
export function previewState(
  drafts: ImportDraft[],
  duplicates: Set<number>,
  deselected: Set<number>,
  fallbackSentAt: string,
): PreviewState {
  const rows = drafts.map((draft): PreviewRow => {
    const errors = draftErrors(draft, fallbackSentAt)
    const duplicate = duplicates.has(draft.rowNumber)
    const status: RowStatus = errors.length
      ? 'error'
      : duplicate
        ? 'duplicate'
        : draft.warnings.length
          ? 'warning'
          : 'ok'
    return {
      draft,
      errors,
      duplicate,
      included: !errors.length && !deselected.has(draft.rowNumber),
      status,
    }
  })
  return {
    rows,
    included: rows.filter((row) => row.included).map((row) => row.draft),
    errorCount: rows.filter((row) => row.errors.length).length,
    warningCount: rows.filter((row) => row.draft.warnings.length).length,
    duplicateCount: rows.filter((row) => row.duplicate).length,
    missingDateCount: drafts.filter((draft) => !draft.sentAt).length,
  }
}
