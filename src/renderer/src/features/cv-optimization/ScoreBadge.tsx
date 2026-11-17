import { formatDelta } from '@shared/domain/cv/assessment'
import { cn } from '../../lib/cn'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function toneOf(score: number): string {
  if (score >= 75) return 'text-ok'
  if (score >= 50) return 'text-warn'
  return 'text-due'
}

export interface ScoreBadgeProps {
  score: number
  /** Abstand zum Original; `null` für das Original selbst */
  delta: number | null
}

/** Match-Score als Ring mit Zahl – die Zahl macht den Wert unabhängig von der Farbe lesbar */
export function ScoreBadge({ score, delta }: ScoreBadgeProps) {
  const offset = CIRCUMFERENCE * (1 - Math.min(Math.max(score, 0), 100) / 100)
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={`Übereinstimmung ${score} von 100`}
        className={cn('relative grid h-16 w-16 place-items-center', toneOf(score))}
      >
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={RADIUS} fill="none" strokeWidth="6" className="stroke-line" />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
          />
        </svg>
        <span className="font-display text-lg font-bold text-fg">{score}</span>
      </div>
      {delta !== null && (
        <span
          aria-label={`${formatDelta(delta)} Punkte gegenüber dem Original`}
          className={cn(
            'rounded-full px-2 py-0.5 text-sm font-semibold',
            delta > 0 && 'bg-ok/15 text-ok',
            delta < 0 && 'bg-due/15 text-due',
            delta === 0 && 'bg-surface-2 text-muted',
          )}
        >
          {formatDelta(delta)}
        </span>
      )}
    </div>
  )
}
