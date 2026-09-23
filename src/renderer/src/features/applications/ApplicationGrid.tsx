import type { Application, Settings } from '@shared/types'
import { ApplicationCard } from './ApplicationCard'

export interface ApplicationGridProps {
  applications: Application[]
  settings: Settings
  today: Date
  pinned?: boolean
  onEdit(application: Application): void
}

/** Responsives Raster: 1 Spalte (schmal) bis 4 Spalten (breit) */
export function ApplicationGrid({
  applications,
  settings,
  today,
  pinned,
  onEdit,
}: ApplicationGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          settings={settings}
          today={today}
          pinned={pinned}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}
