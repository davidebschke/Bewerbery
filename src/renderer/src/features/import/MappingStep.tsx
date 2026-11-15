import { AlertTriangle } from 'lucide-react'
import { IMPORT_FIELD_LABELS, type ColumnTarget } from '@shared/domain/import/fields'
import type { DateOrder, DateOrderResult } from '@shared/domain/import/values'
import type { ImportWorkbook } from '@shared/types'
import { SelectField } from '../../components/ui/Field'
import {
  COLUMN_TARGETS,
  columnLabels,
  columnSamples,
  HEADER_CHOICES,
  missingRequired,
  rowPreview,
  TARGET_LABELS,
} from './wizard'

export interface MappingStepProps {
  workbook: ImportWorkbook
  sheetIndex: number
  onSheet(index: number): void
  headerRow: number | null
  onHeaderRow(row: number | null): void
  mapping: ColumnTarget[]
  onTarget(index: number, target: ColumnTarget): void
  dateInfo: DateOrderResult
  dateOrder: DateOrder
  onDateOrder(order: DateOrder): void
  dataRowCount: number
}

const NO_HEADER = 'none'

export function MappingStep({
  workbook,
  sheetIndex,
  onSheet,
  headerRow,
  onHeaderRow,
  mapping,
  onTarget,
  dateInfo,
  dateOrder,
  onDateOrder,
  dataRowCount,
}: MappingStepProps) {
  const rows = workbook.sheets[sheetIndex].rows
  const labels = columnLabels(rows, headerRow, mapping.length)
  const missing = missingRequired(mapping)
  const headerOptions = rows.slice(0, HEADER_CHOICES)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        <span className="font-semibold text-fg">{workbook.fileName}</span> – {dataRowCount}{' '}
        {dataRowCount === 1 ? 'Datenzeile' : 'Datenzeilen'} gefunden. Prüfe, welche Spalte zu
        welchem Feld gehört.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {workbook.sheets.length > 1 && (
          <SelectField
            label="Tabellenblatt"
            value={sheetIndex}
            onChange={(event) => onSheet(Number(event.target.value))}
          >
            {workbook.sheets.map((sheet, index) => (
              <option key={index} value={index}>
                {sheet.name || `Tabelle ${index + 1}`} ({sheet.rows.length} Zeilen)
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label="Kopfzeile"
          value={headerRow === null ? NO_HEADER : headerRow}
          onChange={(event) =>
            onHeaderRow(event.target.value === NO_HEADER ? null : Number(event.target.value))
          }
          hint="Zeile mit den Spaltennamen – darüber liegende Zeilen werden ignoriert."
        >
          <option value={NO_HEADER}>Keine Kopfzeile</option>
          {headerOptions.map((row, index) => (
            <option key={index} value={index}>
              Zeile {index + 1}: {rowPreview(row)}
            </option>
          ))}
        </SelectField>
        {dateInfo.ambiguous && (
          <SelectField
            label="Datumsformat"
            value={dateOrder}
            onChange={(event) => onDateOrder(event.target.value as DateOrder)}
            hint="Nicht eindeutig: Ist 03/04/2026 der 3. April oder der 4. März?"
          >
            <option value="dmy">Tag zuerst (TT/MM/JJJJ)</option>
            <option value="mdy">Monat zuerst (MM/TT/JJJJ)</option>
          </SelectField>
        )}
      </div>

      {missing.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm">
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-warn" />
          <span>
            Pflichtfeld nicht zugeordnet:{' '}
            {missing.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')}. Betroffene Zeilen
            kannst du in der Vorschau ergänzen.
          </span>
        </p>
      )}

      {mapping.length === 0 ? (
        <p className="text-sm text-muted">Diese Tabelle enthält keine Spalten.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {mapping.map((target, index) => {
            const samples = columnSamples(rows, headerRow, index)
            return (
              <li
                key={index}
                className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{labels[index]}</p>
                  <p className="truncate text-xs text-muted">
                    {samples.length ? samples.join(' · ') : 'keine Werte'}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`column-${index}`}>
                  Ziel für Spalte {labels[index]}
                </label>
                <select
                  id={`column-${index}`}
                  value={target}
                  onChange={(event) => onTarget(index, event.target.value as ColumnTarget)}
                  className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
                >
                  {COLUMN_TARGETS.map((option) => (
                    <option key={option} value={option}>
                      {TARGET_LABELS[option]}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
