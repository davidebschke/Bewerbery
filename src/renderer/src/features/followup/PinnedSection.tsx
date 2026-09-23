import { Pin } from 'lucide-react'
import type { Application, Settings } from '@shared/types'
import { ApplicationGrid } from '../applications/ApplicationGrid'

export interface PinnedSectionProps {
  applications: Application[]
  settings: Settings
  today: Date
  onEdit(application: Application): void
}

/** Gepinnter Bereich am Anfang der Liste für alle Bewerbungen, bei denen man sich melden sollte */
export function PinnedSection({ applications, settings, today, onEdit }: PinnedSectionProps) {
  if (applications.length === 0) return null
  return (
    <section
      aria-labelledby="pinned-heading"
      className="flex flex-col gap-3 rounded-3xl border border-due/30 bg-due/5 p-4"
    >
      <h2
        id="pinned-heading"
        className="flex items-center gap-2 font-display text-base font-semibold text-due"
      >
        <Pin size={18} aria-hidden="true" />
        Jetzt melden
        <span className="rounded-full bg-due px-2 py-0.5 text-xs text-white">
          {applications.length}
        </span>
      </h2>
      <p className="-mt-2 text-sm text-muted">
        Hier ist die Frist abgelaufen – greif zum Hörer oder schreib eine kurze Mail. Das bringt +5
        XP!
      </p>
      <ApplicationGrid
        applications={applications}
        settings={settings}
        today={today}
        pinned
        onEdit={onEdit}
      />
    </section>
  )
}
