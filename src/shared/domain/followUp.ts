import { SOON_THRESHOLD } from '../constants'
import type { Application, FollowUpInfo, Settings } from '../types'
import { addDaysIso, daysBetween } from './dates'

export function effectiveWeeks(application: Application, settings: Settings): number {
  return application.followUpWeeks ?? settings.followUpWeeks
}

/** Referenzdatum: letztes Nachfassen oder Absendedatum */
export function referenceDate(application: Application): string {
  return application.lastFollowUpAt ?? application.sentAt
}

export function getFollowUpInfo(
  application: Application,
  settings: Settings,
  today: Date,
): FollowUpInfo {
  const weeks = effectiveWeeks(application, settings)
  const totalDays = weeks * 7
  const reference = referenceDate(application)
  const elapsedDays = Math.max(0, daysBetween(reference, today))
  const ratio = Math.min(elapsedDays / totalDays, 1)
  const daysRemaining = totalDays - elapsedDays

  let status: FollowUpInfo['status']
  if (application.stage !== 'applied') status = 'none'
  else if (ratio >= 1) status = 'due'
  else if (ratio >= SOON_THRESHOLD) status = 'soon'
  else status = 'fresh'

  return {
    status,
    ratio,
    elapsedDays,
    totalDays,
    daysRemaining,
    dueDate: addDaysIso(reference, totalDays),
    weeks,
  }
}

export function isDue(application: Application, settings: Settings, today: Date): boolean {
  return getFollowUpInfo(application, settings, today).status === 'due'
}

/** Kurzer deutscher Text für den Fortschrittsbalken */
export function describeFollowUp(info: FollowUpInfo): string {
  if (info.status === 'none') return ''
  if (info.daysRemaining < 0) {
    const overdue = -info.daysRemaining
    return `Seit ${overdue} ${overdue === 1 ? 'Tag' : 'Tagen'} überfällig`
  }
  if (info.daysRemaining === 0) return 'Heute melden!'
  return `Noch ${info.daysRemaining} ${info.daysRemaining === 1 ? 'Tag' : 'Tage'}`
}
