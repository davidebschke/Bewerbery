import { useState } from 'react'
import { STAGE_LABELS } from '@shared/constants'
import { formatGermanDate, formatGermanDateTime } from '@shared/domain/dates'
import type { ImportDraft } from '@shared/domain/import/rows'
import type { Stage } from '@shared/types'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { SelectField, TextField } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
import type { PreviewRow, PreviewState, RowStatus } from './wizard'

export interface PreviewStepProps {
  preview: PreviewState
  fallbackSentAt: string
  onFallbackSentAt(value: string): void
  onToggle(rowNumber: number): void
  onEdit(rowNumber: number, patch: Partial<ImportDraft>): void
}

const STATUS: Record<RowStatus, { tone: BadgeTone; label: string }> = {
  ok: { tone: 'ok', label: '✅ Bereit' },
  warning: { tone: 'warn', label: '⚠️ Hinweis' },
  duplicate: { tone: 'neutral', label: '⧉ Duplikat' },
  error: { tone: 'due', label: '❌ Fehler' },
}

/** Weitere, nicht bearbeitbare Werte einer Zeile */
function details(draft: ImportDraft): [string, string][] {
  const entries: [string, string | null][] = [
    ['Ansprechpartner', draft.contactName],
    ['E-Mail', draft.contactEmail],
    ['Telefon', draft.contactPhone],
    ['Letzte Nachfrage', draft.lastFollowUpAt && formatGermanDate(draft.lastFollowUpAt)],
    [
      'Melden nach',
      draft.followUpWeeks === null
        ? null
        : `${draft.followUpWeeks} ${draft.followUpWeeks === 1 ? 'Woche' : 'Wochen'}`,
    ],
    ['Termin', draft.appointmentAt && formatGermanDateTime(draft.appointmentAt)],
    ['Notizen', draft.notes],
  ]
  return entries.filter((entry): entry is [string, string] => !!entry[1])
}

function PreviewCard({
  row,
  onToggle,
  onEdit,
}: {
  row: PreviewRow
  onToggle(): void
  onEdit(patch: Partial<ImportDraft>): void
}) {
  const { draft, errors, included, status } = row
  const info = details(draft)
  return (
    <li
      aria-label={`Zeile ${draft.rowNumber}`}
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3',
        status === 'error' ? 'border-due/50' : 'border-line',
        !included && 'bg-surface-2/50',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={included}
            disabled={errors.length > 0}
            onChange={onToggle}
            className="h-4 w-4 accent-brand"
          />
          Zeile {draft.rowNumber} importieren
        </label>
        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Unternehmen *"
          value={draft.company}
          onChange={(event) => onEdit({ company: event.target.value })}
          error={draft.company.trim() ? undefined : 'Unternehmen fehlt'}
        />
        <TextField
          label="Position *"
          value={draft.position}
          onChange={(event) => onEdit({ position: event.target.value })}
          error={draft.position.trim() ? undefined : 'Position fehlt'}
        />
        <TextField
          label="Beworben am *"
          type="date"
          value={draft.sentAt}
          onChange={(event) => onEdit({ sentAt: event.target.value })}
          error={errors.includes('Datum fehlt oder ist ungültig') ? 'Datum fehlt' : undefined}
        />
        <SelectField
          label="Status"
          value={draft.stage}
          onChange={(event) => onEdit({ stage: event.target.value as Stage })}
        >
          {(Object.keys(STAGE_LABELS) as Stage[]).map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </SelectField>
      </div>

      {info.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label} className="flex min-w-0 gap-1">
              <dt className="shrink-0 text-muted">{label}:</dt>
              <dd className="min-w-0 break-words whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {row.duplicate && (
        <p className="text-xs text-muted">
          Gleiches Unternehmen, gleiche Position und gleiches Datum wie eine vorhandene oder weiter
          oben stehende Bewerbung.
        </p>
      )}
      {draft.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-warn" aria-label="Hinweise">
          {draft.warnings.map((warning) => (
            <li key={warning}>⚠️ {warning}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function PreviewStep({
  preview,
  fallbackSentAt,
  onFallbackSentAt,
  onToggle,
  onEdit,
}: PreviewStepProps) {
  const [onlyProblems, setOnlyProblems] = useState(false)
  const visible = onlyProblems ? preview.rows.filter((row) => row.status !== 'ok') : preview.rows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label="Zusammenfassung">
        <Badge tone="brand">{preview.included.length} werden importiert</Badge>
        <Badge tone="due">{preview.errorCount} mit Fehler</Badge>
        <Badge tone="warn">{preview.warningCount} mit Hinweis</Badge>
        <Badge>{preview.duplicateCount} Duplikate</Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {preview.missingDateCount > 0 ? (
          <TextField
            label="Fehlendes Datum ersetzen durch"
            type="date"
            value={fallbackSentAt}
            onChange={(event) => onFallbackSentAt(event.target.value)}
            hint={`Gilt für ${preview.missingDateCount} ${preview.missingDateCount === 1 ? 'Zeile' : 'Zeilen'} ohne gültiges Datum.`}
            className="sm:max-w-xs"
          />
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(event) => setOnlyProblems(event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Nur Zeilen mit Fehlern, Hinweisen oder Duplikaten
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">Keine Zeilen mit Fehlern, Hinweisen oder Duplikaten.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((row) => (
            <PreviewCard
              key={row.draft.rowNumber}
              row={row}
              onToggle={() => onToggle(row.draft.rowNumber)}
              onEdit={(patch) => onEdit(row.draft.rowNumber, patch)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
