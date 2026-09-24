import { getBadges, getLevelInfo, LEVELS } from '@shared/domain/gamification'
import type { Progress } from '@shared/types'
import { Dialog } from '../../components/ui/Dialog'
import { cn } from '../../lib/cn'

export interface BadgesDialogProps {
  open: boolean
  onClose(): void
  progress: Progress
  today: Date
}

export function BadgesDialog({ open, onClose, progress, today }: BadgesDialogProps) {
  const badges = getBadges(progress, today)
  const level = getLevelInfo(progress.xp)
  const unlocked = badges.filter((b) => b.unlocked).length

  return (
    <Dialog open={open} onClose={onClose} title="Deine Erfolge 🏆" size="lg">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted">
          Level {level.current.level} von {LEVELS.length} · {progress.xp} XP · {unlocked} von{' '}
          {badges.length} Abzeichen freigeschaltet
          {level.next && ` · Noch ${level.xpForNext} XP bis „${level.next.title}“`}
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Abzeichen">
          {badges.map((badge) => (
            <li
              key={badge.id}
              aria-label={`${badge.title}${badge.unlocked ? '' : ' (gesperrt)'}`}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                badge.unlocked ? 'border-brand/40 bg-brand/5' : 'border-line opacity-50 grayscale',
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {badge.unlocked ? badge.icon : '🔒'}
              </span>
              <span>
                <span className="block text-sm font-semibold">{badge.title}</span>
                <span className="block text-xs text-muted">{badge.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
