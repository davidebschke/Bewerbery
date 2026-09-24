import { describe, expect, it } from 'vitest'
import { makeApplication, makeSettings } from '../../../../src/shared/testing/fixtures'
import { describeFollowUp, effectiveWeeks, getFollowUpInfo, isDue, referenceDate } from '../../../../src/shared/domain/followUp'

const settings = makeSettings({ followUpWeeks: 2 })
const day = (d: number) => new Date(2026, 8, d) // September 2026

describe('followUp', () => {
  it('uses global weeks unless the card overrides them', () => {
    expect(effectiveWeeks(makeApplication(), settings)).toBe(2)
    expect(effectiveWeeks(makeApplication({ followUpWeeks: 4 }), settings)).toBe(4)
  })

  it('uses the last follow-up as reference date', () => {
    expect(referenceDate(makeApplication({ sentAt: '2026-09-01' }))).toBe('2026-09-01')
    expect(
      referenceDate(makeApplication({ sentAt: '2026-09-01', lastFollowUpAt: '2026-09-10' })),
    ).toBe('2026-09-10')
  })

  it('computes 50% after half of the period', () => {
    const info = getFollowUpInfo(makeApplication({ sentAt: '2026-09-01' }), settings, day(8))
    expect(info).toMatchObject({
      status: 'fresh',
      ratio: 0.5,
      elapsedDays: 7,
      totalDays: 14,
      daysRemaining: 7,
      dueDate: '2026-09-15',
      weeks: 2,
    })
  })

  it('switches to soon at 60% and due at 100%', () => {
    const app = makeApplication({ sentAt: '2026-09-01' })
    expect(getFollowUpInfo(app, settings, day(9)).status).toBe('fresh') // 8/14 ≈ 57 %
    expect(getFollowUpInfo(app, settings, day(10)).status).toBe('soon') // 9/14 ≈ 64 %
    expect(getFollowUpInfo(app, settings, day(15)).status).toBe('due')
    expect(getFollowUpInfo(app, settings, day(25)).ratio).toBe(1)
    expect(isDue(app, settings, day(15))).toBe(true)
    expect(isDue(app, settings, day(14))).toBe(false)
  })

  it('reacts to changed settings and per-card override', () => {
    const app = makeApplication({ sentAt: '2026-09-01' })
    expect(isDue(app, makeSettings({ followUpWeeks: 1 }), day(8))).toBe(true)
    expect(isDue({ ...app, followUpWeeks: 3 }, makeSettings({ followUpWeeks: 1 }), day(8))).toBe(
      false,
    )
  })

  it('treats future send dates as 0%', () => {
    const info = getFollowUpInfo(makeApplication({ sentAt: '2026-09-30' }), settings, day(1))
    expect(info.ratio).toBe(0)
    expect(info.status).toBe('fresh')
  })

  it('has no follow-up status after the applied stage', () => {
    for (const stage of ['interview', 'offer', 'rejected'] as const) {
      const info = getFollowUpInfo(makeApplication({ stage }), settings, day(30))
      expect(info.status).toBe('none')
    }
  })

  it('describes the remaining time in German', () => {
    const base = getFollowUpInfo(makeApplication({ sentAt: '2026-09-01' }), settings, day(8))
    expect(describeFollowUp(base)).toBe('Noch 7 Tage')
    expect(describeFollowUp({ ...base, daysRemaining: 1 })).toBe('Noch 1 Tag')
    expect(describeFollowUp({ ...base, daysRemaining: 0 })).toBe('Heute melden!')
    expect(describeFollowUp({ ...base, daysRemaining: -1 })).toBe('Seit 1 Tag überfällig')
    expect(describeFollowUp({ ...base, daysRemaining: -4 })).toBe('Seit 4 Tagen überfällig')
    expect(describeFollowUp({ ...base, status: 'none' })).toBe('')
  })
})
