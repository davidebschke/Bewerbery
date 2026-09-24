import { formatGermanDate } from '@shared/domain/dates'
import { describeFollowUp, getFollowUpInfo } from '@shared/domain/followUp'
import type { Application, FollowUpStatus, Settings } from '@shared/types'
import { ProgressBar, type ProgressTone } from '../../components/ui/ProgressBar'
import { cn } from '../../lib/cn'

const TONE: Record<Exclude<FollowUpStatus, 'none'>, ProgressTone> = {
  fresh: 'ok',
  soon: 'warn',
  due: 'due',
}

const TEXT: Record<Exclude<FollowUpStatus, 'none'>, string> = {
  fresh: 'text-ok',
  soon: 'text-warn',
  due: 'text-due',
}

export interface FollowUpBarProps {
  application: Application
  settings: Settings
  today: Date
}

export function FollowUpBar({ application, settings, today }: FollowUpBarProps) {
  const info = getFollowUpInfo(application, settings, today)
  if (info.status === 'none') return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-muted">Melden</span>
        <span className={cn('font-semibold', TEXT[info.status])}>{describeFollowUp(info)}</span>
      </div>
      <ProgressBar
        value={info.ratio}
        tone={TONE[info.status]}
        pulse={info.status === 'due'}
        label={`Fortschritt bis zum Melden (${info.weeks} ${info.weeks === 1 ? 'Woche' : 'Wochen'})`}
      />
      <p className="text-[11px] text-muted">
        Fällig am {formatGermanDate(info.dueDate)} · Frist {info.weeks}{' '}
        {info.weeks === 1 ? 'Woche' : 'Wochen'}
      </p>
    </div>
  )
}
