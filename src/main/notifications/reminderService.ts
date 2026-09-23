import { isDue } from '@shared/domain/followUp'
import type { AppData, Application } from '@shared/types'

export interface ReminderMessage {
  title: string
  body: string
}

export interface ReminderService {
  /** Prüft auf neu fällige Bewerbungen und benachrichtigt einmal pro Sitzung */
  check(data: AppData): Application[]
}

export function buildReminderMessage(applications: Application[]): ReminderMessage {
  if (applications.length === 1) {
    const [app] = applications
    return {
      title: 'Zeit, dich zu melden! 📞',
      body: app.contactName
        ? `Melde dich bei ${app.contactName} (${app.company}) und frag nach dem Stand deiner Bewerbung.`
        : `Frag bei ${app.company} nach dem Stand deiner Bewerbung.`,
    }
  }
  return {
    title: `${applications.length} Bewerbungen warten auf dich 📞`,
    body: applications.map((a) => a.company).join(', '),
  }
}

export function createReminderService(
  notify: (message: ReminderMessage) => void,
  now: () => Date = () => new Date(),
): ReminderService {
  const notified = new Set<string>()

  function check(data: AppData): Application[] {
    const today = now()
    const dueIds = new Set<string>()
    const fresh: Application[] = []
    for (const app of data.applications) {
      if (!isDue(app, data.settings, today)) continue
      dueIds.add(app.id)
      if (!notified.has(app.id)) fresh.push(app)
    }
    // Nicht mehr fällige (z. B. nachgefasst) dürfen später erneut erinnern
    for (const id of notified) if (!dueIds.has(id)) notified.delete(id)

    if (!data.settings.notificationsEnabled || fresh.length === 0) return []
    fresh.forEach((app) => notified.add(app.id))
    notify(buildReminderMessage(fresh))
    return fresh
  }

  return { check }
}
