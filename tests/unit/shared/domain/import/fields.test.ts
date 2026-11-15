import { describe, expect, it } from 'vitest'
import {
  columnLabel,
  columnLetter,
  detectHeaderRow,
  matchColumns,
  matchHeader,
} from '@shared/domain/import/fields'

describe('matchHeader', () => {
  it.each([
    ['Unternehmen', 'company'],
    ['Firma', 'company'],
    ['Company', 'company'],
    ['Employer', 'company'],
    ['Stelle', 'position'],
    ['Job Title', 'position'],
    ['Beworben am', 'sentAt'],
    ['Date applied', 'sentAt'],
    ['Status', 'stage'],
    ['Letzte Nachfrage', 'lastFollowUpAt'],
    ['Melden nach (Wochen)', 'followUpWeeks'],
    ['Termin', 'appointmentAt'],
    ['Ansprechpartner:in', 'contactName'],
    ['E-Mail', 'contactEmail'],
    ['Tel.', 'contactPhone'],
    ['Phone', 'contactPhone'],
    ['Bemerkungen', 'notes'],
  ])('maps %j exactly to %s', (header, field) => {
    expect(matchHeader(header)?.field).toBe(field)
  })

  it('matches partial headers and prefers contact channels over the name', () => {
    expect(matchHeader('Name des Unternehmens')).toMatchObject({
      field: 'company',
      exact: false,
    })
    expect(matchHeader('Datum der Bewerbung')?.field).toBe('sentAt')
    expect(matchHeader('Telefon Ansprechpartner')?.field).toBe('contactPhone')
    expect(matchHeader('E-Mail-Adresse des Kontakts')?.field).toBe('contactEmail')
  })

  it('returns null for unknown or empty headers', () => {
    expect(matchHeader('Gehalt')).toBeNull()
    expect(matchHeader(' - ')).toBeNull()
  })
})

describe('detectHeaderRow', () => {
  it('finds the header below title rows', () => {
    const rows = [['Meine Bewerbungen 2026'], [], ['Firma', 'Stelle', 'Datum'], ['A', 'B', 'C']]
    expect(detectHeaderRow(rows)).toBe(2)
  })

  it('returns null without at least two recognised columns', () => {
    expect(
      detectHeaderRow([
        ['Firma', 'Gehalt'],
        ['A', '1'],
      ]),
    ).toBeNull()
    expect(detectHeaderRow([])).toBeNull()
  })
})

describe('columnLetter / columnLabel', () => {
  it('builds spreadsheet letters', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(701)).toBe('ZZ')
  })

  it('uses the header text or a fallback name', () => {
    expect(columnLabel(['Firma', ' '], 0)).toBe('Firma')
    expect(columnLabel(['Firma', ' '], 1)).toBe('Spalte B')
    expect(columnLabel(null, 2)).toBe('Spalte C')
  })
})

describe('matchColumns', () => {
  it('maps columns in any order and keeps unknown columns as notes', () => {
    const header = ['Gehalt', 'Status', 'Company', 'Position', 'Applied', 'Leer']
    const rows = [['50k', 'Rejected', 'ACME', 'Dev', '2026-01-02', '']]
    expect(matchColumns(header, rows)).toEqual([
      'appendNotes',
      'stage',
      'company',
      'position',
      'sentAt',
      'ignore',
    ])
  })

  it('assigns each field once and lets exact matches win', () => {
    const header = ['Firmenname', 'Name', 'Firma']
    expect(matchColumns(header, [])).toEqual(['company', 'contactName', 'ignore'])
    expect(matchColumns(header, [['A', 'B', 'C']])).toEqual([
      'company',
      'contactName',
      'appendNotes',
    ])
  })

  it('allows several notes columns', () => {
    expect(matchColumns(['Notizen', 'Kommentar'], [])).toEqual(['notes', 'notes'])
  })

  it('guesses fields from content when headers are missing or unknown', () => {
    const rows = [
      ['ACME', 'a@acme.de', '01.02.2026', '+49 30 123456', 'Absage', '05.02.2026'],
      ['Beta', 'b@beta.de', '03.02.2026', '0301234567', 'offen', '07.02.2026'],
    ]
    expect(matchColumns(null, rows)).toEqual([
      'appendNotes',
      'contactEmail',
      'sentAt',
      'contactPhone',
      'stage',
      'lastFollowUpAt',
    ])
  })

  it('handles rows longer than the header', () => {
    expect(matchColumns(['Firma'], [['A', 'x']])).toEqual(['company', 'appendNotes'])
  })
})
