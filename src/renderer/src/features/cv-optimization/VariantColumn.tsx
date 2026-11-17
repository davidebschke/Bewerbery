import { useId } from 'react'
import { AlertTriangle, Check, Copy, Download, Paperclip, Trophy, X } from 'lucide-react'
import { LENGTH_WARNING_RATIO } from '@shared/constants'
import { paragraphText } from '@shared/domain/cv/rewrite'
import type { Assessment, CvParagraph } from '@shared/domain/cv/schemas'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import { ScoreBadge } from './ScoreBadge'

export interface VariantActions {
  onSave(): void
  /** Fehlt, wenn keine (existierende) Bewerbung gewählt ist */
  onAttach?: () => void
  onCopy(): void
  busy?: boolean
}

export interface VariantColumnProps {
  title: string
  assessment: Assessment
  /** Abstand zum Original; `null` für das Original */
  delta: number | null
  best?: boolean
  paragraphs: CvParagraph[]
  changedIds?: Set<string>
  changes?: string[]
  inventedNumbers?: string[]
  lengthRatio?: number
  actions?: VariantActions
}

function KeywordList({
  label,
  keywords,
  covered,
}: {
  label: string
  keywords: string[]
  covered: boolean
}) {
  if (!keywords.length) return null
  const Icon = covered ? Check : X
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{label}</h4>
      <ul className="flex flex-wrap gap-1.5">
        {keywords.map((keyword) => (
          <li
            key={keyword}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
              covered ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-muted',
            )}
          >
            <Icon size={12} aria-hidden="true" />
            {keyword}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Eine Spalte der Vergleichsansicht (Original oder Variante) */
export function VariantColumn({
  title,
  assessment,
  delta,
  best = false,
  paragraphs,
  changedIds = new Set(),
  changes = [],
  inventedNumbers = [],
  lengthRatio = 1,
  actions,
}: VariantColumnProps) {
  const headingId = useId()
  const longer = Math.round((lengthRatio - 1) * 100)

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-2xl border bg-surface p-4',
        best ? 'border-brand shadow-md shadow-brand/15' : 'border-line',
      )}
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="font-display text-base font-semibold">
            {title}
          </h3>
          {best && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
              <Trophy size={12} aria-hidden="true" /> Beste Übereinstimmung
            </span>
          )}
        </div>
        <ScoreBadge score={assessment.score} delta={delta} />
      </header>

      {(inventedNumbers.length > 0 || lengthRatio > LENGTH_WARNING_RATIO) && (
        <ul className="flex flex-col gap-1.5 text-xs">
          {inventedNumbers.length > 0 && (
            <li className="flex gap-1.5 rounded-lg bg-warn/15 p-2 text-fg">
              <AlertTriangle size={14} className="shrink-0 text-warn" aria-hidden="true" />
              Bitte prüfen: {inventedNumbers.join(', ')} steht nicht im Original.
            </li>
          )}
          {lengthRatio > LENGTH_WARNING_RATIO && (
            <li className="flex gap-1.5 rounded-lg bg-warn/15 p-2 text-fg">
              <AlertTriangle size={14} className="shrink-0 text-warn" aria-hidden="true" />
              Text ist {longer} % länger – Layout (z. B. Seitenumbruch) prüfen.
            </li>
          )}
        </ul>
      )}

      <KeywordList label="Abgedeckt" keywords={assessment.coveredKeywords} covered />
      <KeywordList label="Fehlt" keywords={assessment.missingKeywords} covered={false} />

      {changes.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
            Wichtigste Änderungen
          </h4>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        tabIndex={0}
        aria-label={`Text: ${title}`}
        className="max-h-96 overflow-y-auto rounded-xl border border-line bg-bg p-3 text-sm"
      >
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph.id}
            data-changed={changedIds.has(paragraph.id) || undefined}
            className={cn(
              'rounded px-1 whitespace-pre-wrap',
              changedIds.has(paragraph.id) && 'bg-brand/10',
              !paragraph.editable && 'text-muted',
            )}
          >
            {paragraphText(paragraph)}
          </p>
        ))}
      </div>

      {actions && (
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={actions.onSave} disabled={actions.busy}>
            <Download size={14} aria-hidden="true" /> Speichern unter …
          </Button>
          {actions.onAttach && (
            <Button size="sm" onClick={actions.onAttach} disabled={actions.busy}>
              <Paperclip size={14} aria-hidden="true" /> An Bewerbung speichern
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={actions.onCopy}>
            <Copy size={14} aria-hidden="true" /> Text kopieren
          </Button>
        </div>
      )}
    </article>
  )
}
