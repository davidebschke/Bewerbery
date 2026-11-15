import { getBadgeGroups, getLevelInfo, MAX_LEVEL, type Badge } from '@shared/domain/gamification'
import { formatNumber } from '@shared/domain/numbers'
import type { Progress } from '@shared/types'
import { Dialog } from '../../components/ui/Dialog'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { cn } from '../../lib/cn'

export interface BadgesDialogProps {
  open: boolean
  onClose(): void
  progress: Progress
  today: Date
}

function BadgeItem({ badge }: { badge: Badge }) {
  return (
    <li
      aria-label={`${badge.title}${badge.unlocked ? '' : ' (gesperrt)'}`}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3',
        badge.unlocked ? 'border-brand/40 bg-brand/5' : 'border-line',
      )}
    >
      <span className={cn('text-2xl', !badge.unlocked && 'grayscale')} aria-hidden="true">
        {badge.unlocked ? badge.icon : '🔒'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('block text-sm font-semibold', !badge.unlocked && 'text-muted')}>
          {badge.title}
        </span>
        <span className="block text-xs text-muted">{badge.description}</span>
        {!badge.unlocked && (
          <span className="flex items-center gap-2">
            <ProgressBar
              value={badge.current / badge.target}
              label={`Fortschritt ${badge.title}`}
              className="h-1.5"
            />
            <span className="shrink-0 text-xs text-muted tabular-nums">
              {formatNumber(badge.current)}/{formatNumber(badge.target)}
            </span>
          </span>
        )}
      </span>
    </li>
  )
}

export function BadgesDialog({ open, onClose, progress, today }: BadgesDialogProps) {
  const groups = getBadgeGroups(progress, today)
  const level = getLevelInfo(progress.xp)
  const total = groups.reduce((sum, group) => sum + group.badges.length, 0)
  const unlocked = groups.reduce((sum, group) => sum + group.unlockedCount, 0)

  return (
    <Dialog open={open} onClose={onClose} title="Deine Erfolge 🏆" size="lg">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted">
          Level {formatNumber(level.current.level)} von {formatNumber(MAX_LEVEL)} ·{' '}
          {formatNumber(progress.xp)} XP · {unlocked} von {total} Abzeichen freigeschaltet
          {level.next &&
            ` · Noch ${formatNumber(level.xpForNext)} XP bis Level ${formatNumber(level.next.level)}`}
        </p>
        {groups.map((group) => {
          const headingId = `badges-${group.category}`
          return (
            <section
              key={group.category}
              aria-labelledby={headingId}
              className="flex flex-col gap-3"
            >
              <h3
                id={headingId}
                className="flex items-baseline justify-between gap-3 font-display text-sm font-semibold"
              >
                {group.title}
                <span className="text-xs font-normal text-muted">
                  {group.unlockedCount}/{group.badges.length} freigeschaltet
                </span>
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={group.title}>
                {group.badges.map((badge) => (
                  <BadgeItem key={badge.id} badge={badge} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Dialog>
  )
}
