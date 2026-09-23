import { isDue } from '@shared/domain/followUp'
import { getStreak } from '@shared/domain/gamification'
import type { AppData } from '@shared/types'

export interface StatsBarProps {
  data: AppData
  today: Date
}

export function StatsBar({ data, today }: StatsBarProps) {
  const { applications, settings, progress } = data
  const stats = [
    { label: 'Bewerbungen', value: applications.length, icon: '📬' },
    {
      label: 'Jetzt melden',
      value: applications.filter((a) => isDue(a, settings, today)).length,
      icon: '📞',
    },
    {
      label: 'Termine',
      value: applications.filter((a) => a.stage === 'interview').length,
      icon: '🎤',
    },
    { label: 'Wochen-Serie', value: getStreak(progress.activeWeeks, today), icon: '🔥' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
        >
          <span className="text-2xl" aria-hidden="true">
            {stat.icon}
          </span>
          <div className="min-w-0">
            <dt className="truncate text-xs text-muted">{stat.label}</dt>
            <dd className="font-display text-xl font-bold">{stat.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
