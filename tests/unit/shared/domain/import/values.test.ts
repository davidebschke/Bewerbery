import { describe, expect, it } from 'vitest'
import {
  detectDateOrder,
  looksLikePhone,
  normalizeKey,
  parseDate,
  parseEmail,
  parseStage,
  parseWeeks,
} from '@shared/domain/import/values'

describe('normalizeKey', () => {
  it('lowercases, transliterates umlauts and strips separators', () => {
    expect(normalizeKey('E-Mail Ansprech­partner')).toBe('emailansprechpartner')
    expect(normalizeKey('Gespräch / Straße')).toBe('gespraechstrasse')
    expect(normalizeKey('Café')).toBe('cafe')
  })
})

describe('parseDate', () => {
  it.each([
    ['2026-03-15', '2026-03-15', null],
    ['2026-3-5', '2026-03-05', null],
    ['2026-03-15T14:30:00.000Z', '2026-03-15', '14:30'],
    ['2026-03-15 08:05', '2026-03-15', '08:05'],
    ['15.03.2026', '2026-03-15', null],
    ['5.3.26', '2026-03-05', null],
    ['15.03.2026 14:30', '2026-03-15', '14:30'],
    ['15.03.2026, um 9.15 Uhr', '2026-03-15', '09:15'],
    ['15/03/2026', '2026-03-15', null],
    ['15-03-2026', '2026-03-15', null],
    ['15. März 2026', '2026-03-15', null],
    ['15 Maerz 2026', '2026-03-15', null],
    ['15-Mar-2026', '2026-03-15', null],
    ['1. Okt. 26', '2026-10-01', null],
    ['March 15, 2026', '2026-03-15', null],
    ['Dec 1st 2026', '2026-12-01', null],
  ])('parses %j', (raw, date, time) => {
    expect(parseDate(raw)).toEqual({ date, time })
  })

  it('respects the month/day order for slash dates', () => {
    expect(parseDate('03/15/2026', 'mdy')).toEqual({ date: '2026-03-15', time: null })
    expect(parseDate('03/04/2026', 'mdy')?.date).toBe('2026-03-04')
    expect(parseDate('03/04/2026', 'dmy')?.date).toBe('2026-04-03')
  })

  it.each([
    '',
    '  ',
    'morgen',
    '31.02.2026',
    '2026-13-01',
    '00.01.2026',
    '15 Foo 2026',
    'Foo 15, 2026',
    '2026-02-30',
    '03/15/2026',
    'Smarch 32, 2026',
    '32. März 2026',
  ])('rejects %j', (raw) => {
    expect(parseDate(raw)).toBeNull()
  })

  it('drops invalid times but keeps the date', () => {
    expect(parseDate('15.03.2026 25:00')).toEqual({ date: '2026-03-15', time: null })
  })
})

describe('detectDateOrder', () => {
  it('detects day-first and month-first columns', () => {
    expect(detectDateOrder(['01/02/2026', '25/02/2026'])).toEqual({
      order: 'dmy',
      ambiguous: false,
    })
    expect(detectDateOrder(['02/25/2026', '01/02/2026'])).toEqual({
      order: 'mdy',
      ambiguous: false,
    })
  })

  it('flags slash dates without a hint as ambiguous', () => {
    expect(detectDateOrder(['01/02/2026', '03/04/2026'])).toEqual({
      order: 'dmy',
      ambiguous: true,
    })
  })

  it('is not ambiguous without slash dates', () => {
    expect(detectDateOrder(['15.03.2026', 'x'])).toEqual({ order: 'dmy', ambiguous: false })
  })
})

describe('parseStage', () => {
  it.each([
    ['Beworben', 'applied'],
    ['offen', 'applied'],
    ['Pending', 'applied'],
    ['In Bearbeitung', 'applied'],
    ['Termin', 'interview'],
    ['Vorstellungsgespräch', 'interview'],
    ['Interview scheduled', 'interview'],
    ['Angebot', 'offer'],
    ['Zusage!', 'offer'],
    ['Offer', 'offer'],
    ['Absage', 'rejected'],
    ['abgelehnt', 'rejected'],
    ['Rejected', 'rejected'],
    ['Angebot abgelehnt', 'rejected'],
  ])('maps %j to %s', (raw, stage) => {
    expect(parseStage(raw)).toBe(stage)
  })

  it('returns null for empty or unknown values', () => {
    expect(parseStage('')).toBeNull()
    expect(parseStage('vielleicht')).toBeNull()
  })
})

describe('parseWeeks', () => {
  it('extracts the first number', () => {
    expect(parseWeeks('3 Wochen')).toBe(3)
    expect(parseWeeks('3w')).toBe(3)
    expect(parseWeeks('bald')).toBeNull()
  })
})

describe('parseEmail', () => {
  it('cleans mailto prefixes and display names', () => {
    expect(parseEmail(' mailto:a@b.de ')).toBe('a@b.de')
    expect(parseEmail('Frau Muster <muster@firma.de>')).toBe('muster@firma.de')
  })

  it('returns empty string for empty and null for invalid values', () => {
    expect(parseEmail('mailto:')).toBe('')
    expect(parseEmail('keine mail')).toBeNull()
  })
})

describe('looksLikePhone', () => {
  it('accepts phone numbers and rejects text or short numbers', () => {
    expect(looksLikePhone('+49 (30) 123-456')).toBe(true)
    expect(looksLikePhone('030/1234567')).toBe(true)
    expect(looksLikePhone('12345')).toBe(false)
    expect(looksLikePhone('Tel 123456')).toBe(false)
  })
})
