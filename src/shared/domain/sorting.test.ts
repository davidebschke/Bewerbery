import { describe, expect, it } from 'vitest'
import { makeApplication, makeSettings } from '../testing/fixtures'
import { arrangeApplications } from './sorting'

const settings = makeSettings({ followUpWeeks: 2 })
const today = new Date(2026, 8, 23)

const ids = (list: { id: string }[]) => list.map((a) => a.id)

describe('arrangeApplications', () => {
  const dueOld = makeApplication({ id: 'due-old', company: 'Alpha', sentAt: '2026-08-01' })
  const dueNew = makeApplication({ id: 'due-new', company: 'Beta', sentAt: '2026-09-05' })
  const fresh = makeApplication({ id: 'fresh', company: 'Gamma', sentAt: '2026-09-20' })
  const soon = makeApplication({ id: 'soon', company: 'Delta', sentAt: '2026-09-12' })
  const interviewLate = makeApplication({
    id: 'iv-late',
    stage: 'interview',
    appointmentAt: '2026-10-10T10:00',
  })
  const interviewEarly = makeApplication({
    id: 'iv-early',
    stage: 'interview',
    appointmentAt: '2026-09-30T10:00',
  })
  const interviewNoDate = makeApplication({ id: 'iv-none', stage: 'interview' })
  const offer = makeApplication({ id: 'offer', stage: 'offer' })
  const rejectedOld = makeApplication({
    id: 'rej-old',
    stage: 'rejected',
    updatedAt: '2026-09-01T00:00:00.000Z',
  })
  const rejectedNew = makeApplication({
    id: 'rej-new',
    stage: 'rejected',
    updatedAt: '2026-09-10T00:00:00.000Z',
  })

  const all = [
    fresh,
    rejectedOld,
    interviewNoDate,
    dueNew,
    offer,
    interviewLate,
    soon,
    rejectedNew,
    dueOld,
    interviewEarly,
  ]

  it('pins due cards, most overdue first', () => {
    const { pinned } = arrangeApplications(all, settings, today)
    expect(ids(pinned)).toEqual(['due-old', 'due-new'])
  })

  it('sorts the rest by urgency and stage', () => {
    const { others } = arrangeApplications(all, settings, today)
    expect(ids(others)).toEqual([
      'soon',
      'fresh',
      'iv-early',
      'iv-late',
      'iv-none',
      'offer',
      'rej-new',
      'rej-old',
    ])
  })

  it('filters by search term across company, position and contact', () => {
    const withContact = makeApplication({ id: 'c', company: 'X', contactName: 'Frau Müller' })
    const withPosition = makeApplication({ id: 'p', company: 'Y', position: 'Müllerei-Leitung' })
    const result = arrangeApplications([withContact, withPosition, fresh], settings, today, {
      search: ' müller ',
      filter: 'all',
    })
    expect(ids([...result.pinned, ...result.others]).sort()).toEqual(['c', 'p'])
  })

  it('filters by stage', () => {
    const result = arrangeApplications(all, settings, today, { search: '', filter: 'interview' })
    expect(result.pinned).toEqual([])
    expect(ids(result.others)).toEqual(['iv-early', 'iv-late', 'iv-none'])
  })

  it('filters by due status', () => {
    const result = arrangeApplications(all, settings, today, { search: '', filter: 'due' })
    expect(ids(result.pinned)).toEqual(['due-old', 'due-new'])
    expect(result.others).toEqual([])
  })

  it('keeps due cards pinned when filtering by applied', () => {
    const result = arrangeApplications(all, settings, today, { search: '', filter: 'applied' })
    expect(ids(result.pinned)).toEqual(['due-old', 'due-new'])
    expect(ids(result.others)).toEqual(['soon', 'fresh'])
  })
})
