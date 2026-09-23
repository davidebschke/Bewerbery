import { describe, expect, it, vi } from 'vitest'
import { makeApplication, makeData, makeSettings } from '@shared/testing/fixtures'
import { buildReminderMessage, createReminderService } from './reminderService'

const now = () => new Date(2026, 8, 23)

describe('buildReminderMessage', () => {
  it('names contact and company for a single application', () => {
    const msg = buildReminderMessage([
      makeApplication({ company: 'ACME', contactName: 'Frau Roth' }),
    ])
    expect(msg.body).toBe(
      'Melde dich bei Frau Roth (ACME) und frag nach dem Stand deiner Bewerbung.',
    )
  })

  it('works without contact', () => {
    const msg = buildReminderMessage([makeApplication({ company: 'ACME' })])
    expect(msg.body).toBe('Frag bei ACME nach dem Stand deiner Bewerbung.')
  })

  it('summarizes multiple applications', () => {
    const msg = buildReminderMessage([
      makeApplication({ company: 'A' }),
      makeApplication({ company: 'B' }),
    ])
    expect(msg.title).toContain('2 Bewerbungen')
    expect(msg.body).toBe('A, B')
  })
})

describe('reminderService', () => {
  const due = makeApplication({ id: 'due', sentAt: '2026-08-01' })
  const fresh = makeApplication({ id: 'fresh', sentAt: '2026-09-22' })

  it('notifies once per due application', () => {
    const notify = vi.fn()
    const service = createReminderService(notify, now)
    const data = makeData({ applications: [due, fresh] })

    expect(service.check(data).map((a) => a.id)).toEqual(['due'])
    expect(service.check(data)).toEqual([])
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('respects disabled notifications', () => {
    const notify = vi.fn()
    const service = createReminderService(notify, now)
    service.check(
      makeData({ applications: [due], settings: makeSettings({ notificationsEnabled: false }) }),
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('reminds again after the card was followed up and became due again', () => {
    const notify = vi.fn()
    const service = createReminderService(notify, now)
    service.check(makeData({ applications: [due] }))
    service.check(makeData({ applications: [{ ...due, lastFollowUpAt: '2026-09-23' }] }))
    service.check(makeData({ applications: [due] }))
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('uses the current date by default', () => {
    const notify = vi.fn()
    const service = createReminderService(notify)
    service.check(makeData({ applications: [makeApplication({ sentAt: '2000-01-01' })] }))
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
