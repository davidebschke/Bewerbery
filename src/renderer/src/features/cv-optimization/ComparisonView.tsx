import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { bestVariant, scoreDelta } from '@shared/domain/cv/assessment'
import { applyRewrites, changedParagraphIds } from '@shared/domain/cv/rewrite'
import type { CvOptimizationResult } from '@shared/domain/cv/schemas'
import { VARIANT_STYLE_LABELS, type VariantStyle } from '@shared/domain/cv/styles'
import { cn } from '../../lib/cn'
import { VariantColumn } from './VariantColumn'

type ColumnKey = 'original' | VariantStyle

export interface ComparisonViewProps {
  result: CvOptimizationResult
  /** `true`, wenn die Bewerbung des Ergebnisses (noch) existiert */
  canAttach: boolean
  busy?: VariantStyle | null
  onSave(style: VariantStyle): void
  onAttach(style: VariantStyle): void
  onCopy(style: VariantStyle): void
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

/** Kurze Beschriftungen, damit vier Tabs ab 360 px nebeneinander passen */
const TAB_LABELS: Record<ColumnKey, string> = {
  original: 'Original',
  factual: 'Sachlich',
  impactful: 'Wirkung',
  ats: 'ATS',
}

/** Original und drei Varianten nebeneinander – auf schmalen Fenstern als Tabs */
export function ComparisonView({
  result,
  canAttach,
  busy = null,
  onSave,
  onAttach,
  onCopy,
}: ComparisonViewProps) {
  const baseId = useId()
  const best = bestVariant(result)
  const columns: ColumnKey[] = ['original', ...result.variants.map((variant) => variant.style)]
  const [selected, setSelected] = useState<ColumnKey>(best ?? 'original')
  const tabRefs = useRef<Partial<Record<ColumnKey, HTMLButtonElement | null>>>({})

  const label = (key: ColumnKey) => (key === 'original' ? 'Original' : VARIANT_STYLE_LABELS[key])
  const shortLabel = (key: ColumnKey) => TAB_LABELS[key]

  function onTabKey(event: KeyboardEvent) {
    const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!offset) return
    event.preventDefault()
    const index = columns.indexOf(selected)
    const next = columns[(index + offset + columns.length) % columns.length]
    setSelected(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${baseId}-heading`} className="font-display text-lg font-semibold">
          {result.jobTitle || 'Ergebnis der Optimierung'}
        </h2>
        <p className="text-xs text-muted">
          Optimiert am {DATE_FORMAT.format(new Date(result.createdAt))} · {result.source.fileName}
        </p>
      </div>

      {best === null && (
        <p role="note" className="rounded-xl border border-line bg-surface p-3 text-sm">
          Keine Variante übertrifft das Original. Dein Lebenslauf passt bereits gut zur Stelle –
          oder die Stellenanzeige verlangt Inhalte, die (noch) nicht im Lebenslauf stehen.
        </p>
      )}

      <div
        role="tablist"
        aria-label="Version auswählen"
        className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1 md:hidden"
        onKeyDown={onTabKey}
      >
        {columns.map((key) => (
          <button
            key={key}
            ref={(element) => {
              tabRefs.current[key] = element
            }}
            role="tab"
            id={`${baseId}-tab-${key}`}
            aria-label={label(key)}
            aria-selected={selected === key}
            aria-controls={`${baseId}-panel-${key}`}
            tabIndex={selected === key ? 0 : -1}
            onClick={() => setSelected(key)}
            className={cn(
              'min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap',
              selected === key ? 'bg-surface text-fg shadow-sm' : 'text-muted',
            )}
          >
            {shortLabel(key)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((key) => {
          const variant = result.variants.find((candidate) => candidate.style === key)
          return (
            <div
              key={key}
              role="tabpanel"
              id={`${baseId}-panel-${key}`}
              aria-labelledby={`${baseId}-tab-${key}`}
              className={cn('min-w-0 md:flex', selected === key ? 'flex' : 'hidden')}
            >
              {variant ? (
                <VariantColumn
                  title={label(key)}
                  assessment={variant.assessment}
                  delta={scoreDelta(result, variant.style)}
                  best={best === variant.style}
                  paragraphs={applyRewrites(result.source, variant.rewrites)}
                  changedIds={changedParagraphIds(variant.rewrites)}
                  changes={variant.changes}
                  inventedNumbers={variant.inventedNumbers}
                  lengthRatio={variant.lengthRatio}
                  actions={{
                    onSave: () => onSave(variant.style),
                    onAttach: canAttach ? () => onAttach(variant.style) : undefined,
                    onCopy: () => onCopy(variant.style),
                    busy: busy === variant.style,
                  }}
                />
              ) : (
                <VariantColumn
                  title="Original"
                  assessment={result.originalAssessment}
                  delta={null}
                  paragraphs={result.source.paragraphs}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
