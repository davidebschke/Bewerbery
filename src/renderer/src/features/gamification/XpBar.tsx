import { Trophy } from 'lucide-react'
import { getLevelInfo } from '@shared/domain/gamification'
import { ProgressBar } from '../../components/ui/ProgressBar'

export interface XpBarProps {
  xp: number
  onOpenBadges(): void
}

/** Level-Anzeige im Header – ein Klick öffnet die Erfolge */
export function XpBar({ xp, onOpenBadges }: XpBarProps) {
  const info = getLevelInfo(xp)
  return (
    <button
      type="button"
      onClick={onOpenBadges}
      aria-label={`Level ${info.current.level}: ${info.current.title}, ${xp} XP – Erfolge anzeigen`}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left transition hover:border-brand/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand to-brand-2 font-display text-sm font-bold text-white">
        {info.current.level}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-semibold">{info.current.title}</span>
          <span className="shrink-0 text-muted">
            {info.next ? `${info.xpIntoLevel}/${info.xpIntoLevel + info.xpForNext} XP` : `${xp} XP`}
          </span>
        </span>
        <ProgressBar
          value={info.progress}
          label="Fortschritt zum nächsten Level"
          className="h-1.5 w-40 max-w-full"
        />
      </span>
      <Trophy size={16} aria-hidden="true" className="hidden shrink-0 text-warn sm:block" />
    </button>
  )
}
