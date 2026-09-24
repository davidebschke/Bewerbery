import type { Application, Settings } from '@shared/types'
import { ApplicationCard } from './ApplicationCard'

export interface ApplicationGridProps {
  applications: Application[]
  settings: Settings
  today: Date
  pinned?: boolean
  onEdit(application: Application): void
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?(id: string): void
}

/** Responsives Raster: 1 Spalte (schmal) bis 4 Spalten (breit) */
export function ApplicationGrid({
  applications,
  settings,
  today,
  pinned,
  onEdit,
  selectionMode,
  selectedIds,
  onToggleSelect,
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
          selectionMode={selectionMode}
          selected={selectedIds?.has(application.id) ?? false}
          onToggleSelect={() => onToggleSelect?.(application.id)}
        />
      ))}
    </div>
  )
}
