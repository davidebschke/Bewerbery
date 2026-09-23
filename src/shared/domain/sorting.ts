import type { Application, Settings, Stage } from '../types'
import { getFollowUpInfo } from './followUp'

export type StageFilter = Stage | 'all' | 'due'

export interface ListQuery {
  search: string
  filter: StageFilter
}

export interface ArrangedList {
  pinned: Application[]
  others: Application[]
}

const STAGE_ORDER: Record<Stage, number> = { applied: 0, interview: 1, offer: 2, rejected: 3 }

function matchesSearch(application: Application, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true
  return [application.company, application.position, application.contactName]
    .join(' ')
    .toLowerCase()
    .includes(term)
}

function compareOthers(a: Application, b: Application, settings: Settings, today: Date): number {
  const stageDiff = STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
  if (stageDiff !== 0) return stageDiff

  if (a.stage === 'applied') {
    return (
      getFollowUpInfo(a, settings, today).daysRemaining -
      getFollowUpInfo(b, settings, today).daysRemaining
    )
  }
  if (a.stage === 'interview') {
    // Nächster Termin zuerst, Termine ohne Datum ans Ende
    const at = a.appointmentAt ?? '9999'
    const bt = b.appointmentAt ?? '9999'
    return at.localeCompare(bt)
  }
  return b.updatedAt.localeCompare(a.updatedAt)
}

/**
 * Teilt die Bewerbungen in fällige (gepinnt, am längsten überfällig zuerst)
 * und übrige (nach Dringlichkeit bzw. Status sortiert).
 */
export function arrangeApplications(
  applications: Application[],
  settings: Settings,
  today: Date,
  query: ListQuery = { search: '', filter: 'all' },
): ArrangedList {
  const pinned: Application[] = []
  const others: Application[] = []

  for (const application of applications) {
    if (!matchesSearch(application, query.search)) continue
    const due = getFollowUpInfo(application, settings, today).status === 'due'
    if (query.filter === 'due' && !due) continue
    if (query.filter !== 'all' && query.filter !== 'due' && application.stage !== query.filter) {
      continue
    }
    ;(due ? pinned : others).push(application)
  }

  pinned.sort(
    (a, b) =>
      getFollowUpInfo(a, settings, today).daysRemaining -
      getFollowUpInfo(b, settings, today).daysRemaining,
  )
  others.sort((a, b) => compareOthers(a, b, settings, today))

  return { pinned, others }
}
