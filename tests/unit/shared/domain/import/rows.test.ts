import { describe, expect, it } from 'vitest'
import { matchColumns, type ColumnTarget } from '@shared/domain/import/fields'
import {
  buildDrafts,
  dataRowsOf,
  draftErrors,
  draftsToApplications,
  findDuplicates,
  type ImportDraft,
} from '@shared/domain/import/rows'
import { makeApplication } from '@shared/testing/fixtures'

const HEADER = [
  'Unternehmen',
  'Position',
  'Beworben am',
  'Status',
  'Letzte Nachfrage',
  'Melden nach',
  'Termin',
  'Ansprechpartner',
  'E-Mail',
  'Telefon',
  'Notizen',
]

function draft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    rowNumber: 2,
    company: 'ACME',
    position: 'Dev',
    sentAt: '2026-09-01',
    stage: 'applied',
    lastFollowUpAt: null,
    followUpWeeks: null,
    appointmentAt: null,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    warnings: [],
    ...overrides,
  }
}

function build(rows: string[][], headerRow: number | null = 0, mapping?: ColumnTarget[]) {
  const header = headerRow === null ? null : rows[headerRow]
  const data = rows.slice(headerRow === null ? 0 : headerRow + 1)
  return buildDrafts(rows, {
    headerRow,
    mapping: mapping ?? matchColumns(header, data),
    dateOrder: 'dmy',
  })
}

describe('dataRowsOf', () => {
  it('skips header, blank and summary rows and keeps row numbers', () => {
    const rows = [['Titel'], ['Firma', 'Stelle'], ['A', 'B'], ['', ' '], ['C', 'D'], ['Summe', '2']]
    expect(dataRowsOf(rows, 1)).toEqual([
      { rowNumber: 3, cells: ['A', 'B'] },
      { rowNumber: 5, cells: ['C', 'D'] },
    ])
    expect(dataRowsOf([['A']], null)).toEqual([{ rowNumber: 1, cells: ['A'] }])
  })
})

describe('buildDrafts', () => {
  it('fills every field from a complete row', () => {
    const [result] = build([
      HEADER,
      [
        ' ACME ',
        'Dev',
        '01.09.2026',
        'Termin',
        '10.09.2026',
        '3 Wochen',
        '20.09.2026 14:30',
        'Frau A',
        'mailto:a@acme.de',
        '+49 1',
        'Remote',
      ],
    ])
    expect(result).toEqual({
      rowNumber: 2,
      company: 'ACME',
      position: 'Dev',
      sentAt: '2026-09-01',
      stage: 'interview',
      lastFollowUpAt: '2026-09-10',
      followUpWeeks: 3,
      appointmentAt: '2026-09-20T14:30',
      contactName: 'Frau A',
      contactEmail: 'a@acme.de',
      contactPhone: '+49 1',
      notes: 'Remote',
      warnings: [],
    })
  })

  it('keeps unknown columns and unrecognised values in the notes with warnings', () => {
    const [result] = build([
      ['Firma', 'Stelle', 'Datum', 'Status', 'E-Mail', 'Wochen', 'Termin', 'Gehalt', 'Notizen'],
      ['A', 'B', 'gestern', 'vielleicht', 'kaputt', '20', '01.10.2026', '50k', 'Hallo'],
    ])
    expect(result.sentAt).toBe('')
    expect(result.stage).toBe('applied')
    expect(result.contactEmail).toBe('')
    expect(result.followUpWeeks).toBeNull()
    expect(result.appointmentAt).toBe('2026-10-01T09:00')
    expect(result.warnings).toEqual([
      'Datum: Datum „gestern“ nicht erkannt',
      'Status: „vielleicht“ nicht erkannt – „Beworben“ übernommen',
      'E-Mail: „kaputt“ ist keine gültige E-Mail-Adresse',
      'Wochen: „20“ ist keine Frist von 1–12 Wochen – Standard übernommen',
      'Termin: keine Uhrzeit angegeben – 09:00 Uhr angenommen',
    ])
    expect(result.notes).toBe(
      [
        'Hallo',
        'Gehalt: 50k',
        'Datum: gestern',
        'Status: vielleicht',
        'E-Mail: kaputt',
        'Wochen: 20',
      ].join('\n'),
    )
  })

  it('warns about unreadable appointments and follow-up dates', () => {
    const [result] = build([
      ['Firma', 'Termin', 'Nachgefragt'],
      ['A', 'irgendwann', 'nie'],
    ])
    expect(result.appointmentAt).toBeNull()
    expect(result.lastFollowUpAt).toBeNull()
    expect(result.warnings).toHaveLength(2)
  })

  it('works without header using column letters and ignored columns', () => {
    const rows = [['ACME', 'x', 'Notiz']]
    const [result] = build(rows, null, ['company', 'ignore', 'appendNotes'])
    expect(result.company).toBe('ACME')
    expect(result.notes).toBe('Spalte C: Notiz')
  })

  it('joins multiple notes columns', () => {
    const [result] = build([
      ['Firma', 'Notizen', 'Kommentar'],
      ['A', 'eins', 'zwei'],
    ])
    expect(result.notes).toBe('eins\nzwei')
  })

  it('uses the month-first order when requested', () => {
    const rows = [
      ['Firma', 'Datum'],
      ['A', '03/04/2026'],
    ]
    const [result] = buildDrafts(rows, {
      headerRow: 0,
      mapping: ['company', 'sentAt'],
      dateOrder: 'mdy',
    })
    expect(result.sentAt).toBe('2026-03-04')
  })

  it('tolerates a header index outside the rows', () => {
    expect(buildDrafts([], { headerRow: 3, mapping: [], dateOrder: 'dmy' })).toEqual([])
  })
})

describe('draftErrors', () => {
  it('lists missing required fields', () => {
    expect(draftErrors(draft({ company: ' ', position: '', sentAt: '' }))).toEqual([
      'Unternehmen fehlt',
      'Position fehlt',
      'Datum fehlt oder ist ungültig',
    ])
  })

  it('accepts a fallback date for missing dates', () => {
    expect(draftErrors(draft({ sentAt: '' }), '2026-09-01')).toEqual([])
    expect(draftErrors(draft())).toEqual([])
  })
})

describe('findDuplicates', () => {
  it('detects duplicates of existing and earlier imported applications', () => {
    const existing = [makeApplication({ company: 'ACME', position: 'Dev', sentAt: '2026-09-01' })]
    const drafts = [
      draft({ rowNumber: 2, company: 'acme', position: ' dev ' }),
      draft({ rowNumber: 3, company: 'Beta' }),
      draft({ rowNumber: 4, company: 'Beta' }),
      draft({ rowNumber: 5, company: 'Gamma', sentAt: '' }),
      draft({ rowNumber: 6, company: 'Gamma', sentAt: '2026-10-01' }),
    ]
    expect([...findDuplicates(drafts, existing, '2026-10-01')]).toEqual([2, 4, 6])
    expect([...findDuplicates(drafts, [])]).toEqual([4])
  })
})

describe('draftsToApplications', () => {
  it('creates applications with stage, dates and awarded stages', () => {
    const now = new Date(2026, 8, 23, 12)
    const [applied, interview] = draftsToApplications(
      [
        draft({ sentAt: '', notes: 'n', lastFollowUpAt: '2026-09-10', followUpWeeks: 4 }),
        draft({ stage: 'interview', appointmentAt: '2026-10-01T10:00' }),
      ],
      { now, fallbackSentAt: '2026-08-01' },
    )
    expect(applied).toMatchObject({
      company: 'ACME',
      sentAt: '2026-08-01',
      lastFollowUpAt: '2026-09-10',
      followUpWeeks: 4,
      notes: 'n',
      stage: 'applied',
      awardedStages: [],
      createdAt: now.toISOString(),
    })
    expect(interview).toMatchObject({
      stage: 'interview',
      appointmentAt: '2026-10-01T10:00',
      awardedStages: ['interview'],
    })
    expect(applied.id).not.toBe(interview.id)
  })

  it('works without fallback date', () => {
    const [app] = draftsToApplications([draft()], { now: new Date(2026, 8, 23) })
    expect(app.sentAt).toBe('2026-09-01')
  })
})
