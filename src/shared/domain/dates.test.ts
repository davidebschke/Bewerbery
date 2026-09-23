import { describe, expect, it } from 'vitest'
import {
  addDaysIso,
  daysBetween,
  formatDaysAgo,
  formatGermanDate,
  formatGermanDateTime,
  isoWeekKey,
  toIsoDate,
} from './dates'

describe('dates', () => {
  it('converts dates to ISO strings', () => {
    expect(toIsoDate(new Date(2026, 8, 3))).toBe('2026-09-03')
  })

  it('counts calendar days', () => {
    expect(daysBetween('2026-09-01', new Date(2026, 8, 15, 23, 59))).toBe(14)
    expect(daysBetween('2026-09-20', new Date(2026, 8, 15))).toBe(-5)
  })

  it('adds days', () => {
    expect(addDaysIso('2026-09-28', 5)).toBe('2026-10-03')
  })

  it('builds ISO week keys', () => {
    expect(isoWeekKey(new Date(2026, 8, 23))).toBe('2026-W39')
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53')
  })

  it('formats relative days', () => {
    expect(formatDaysAgo(0)).toBe('heute')
    expect(formatDaysAgo(1)).toBe('gestern')
    expect(formatDaysAgo(-1)).toBe('morgen')
    expect(formatDaysAgo(5)).toBe('vor 5 Tagen')
    expect(formatDaysAgo(-3)).toBe('in 3 Tagen')
  })

  it('formats German dates', () => {
    expect(formatGermanDate('2026-09-03')).toBe('03.09.2026')
    expect(formatGermanDateTime('2026-09-03T14:30')).toBe('03.09.2026 um 14:30 Uhr')
  })
})
