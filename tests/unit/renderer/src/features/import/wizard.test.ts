import { describe, expect, it } from 'vitest'
import type { ImportDraft } from '@shared/domain/import/rows'
import {
  analyzeColumns,
  columnLabels,
  columnSamples,
  detectOrderFor,
  headerOf,
  missingRequired,
  previewState,
  reassign,
  rowPreview,
} from '../../../../../../src/renderer/src/features/import/wizard'

const rows = [
  ['Liste'],
  ['Firma', 'Datum', 'Stelle', 'X'],
  ['A', '03/04/2026', 'Dev', ''],
  ['B', '05/06/2026', '', ''],
]

function draft(rowNumber: number, overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    rowNumber,
    company: 'A',
    position: 'P',
    sentAt: '2026-01-01',
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

describe('wizard helpers', () => {
  it('analyses columns and date order for a header row', () => {
    const mapping = analyzeColumns(rows, 1)
    expect(mapping).toEqual(['company', 'sentAt', 'position', 'ignore'])
    expect(detectOrderFor(rows, 1, mapping)).toEqual({ order: 'dmy', ambiguous: true })
    expect(detectOrderFor(rows, 1, ['company', 'ignore', 'position', 'ignore'])).toEqual({
      order: 'dmy',
      ambiguous: false,
    })
    expect(headerOf(rows, null)).toBeNull()
    expect(headerOf(rows, 9)).toEqual([])
  })

  it('builds labels and sample values', () => {
    expect(columnLabels(rows, 1, 5)).toEqual(['Firma', 'Datum', 'Stelle', 'X', 'Spalte E'])
    expect(columnSamples(rows, 1, 0)).toEqual(['A', 'B'])
    expect(columnSamples(rows, 1, 2)).toEqual(['Dev'])
    expect(columnSamples(rows, null, 0, 1)).toEqual(['Liste'])
  })

  it('moves a field to the newly chosen column', () => {
    const mapping = reassign(['company', 'position', 'notes', 'ignore'], 3, 'company')
    expect(mapping).toEqual(['appendNotes', 'position', 'notes', 'company'])
    expect(reassign(mapping, 1, 'notes')).toEqual(['appendNotes', 'notes', 'notes', 'company'])
    expect(reassign(['ignore', 'ignore'], 0, 'ignore')).toEqual(['ignore', 'ignore'])
  })

  it('lists missing required fields', () => {
    expect(missingRequired(['company'])).toEqual(['position', 'sentAt'])
    expect(missingRequired(['sentAt', 'position', 'company'])).toEqual([])
  })

  it('previews rows briefly', () => {
    expect(rowPreview(['a', ' ', 'b', 'c', 'd'])).toBe('a · b · c …')
    expect(rowPreview(['a'])).toBe('a')
    expect(rowPreview([])).toBe('(leer)')
    expect(rowPreview(undefined)).toBe('(leer)')
  })

  it('classifies rows for the preview', () => {
    const drafts = [
      draft(2),
      draft(3, { warnings: ['w'] }),
      draft(4, { company: '' }),
      draft(5),
      draft(6, { sentAt: '' }),
      draft(7),
    ]
    const state = previewState(drafts, new Set([5]), new Set([5, 7]), '')
    expect(state.rows.map((row) => [row.status, row.included])).toEqual([
      ['ok', true],
      ['warning', true],
      ['error', false],
      ['duplicate', false],
      ['error', false],
      ['ok', false],
    ])
    expect(state).toMatchObject({
      errorCount: 2,
      warningCount: 1,
      duplicateCount: 1,
      missingDateCount: 1,
    })
    expect(state.included.map((d) => d.rowNumber)).toEqual([2, 3])
    expect(previewState(drafts, new Set(), new Set(), '2026-02-02').errorCount).toBe(1)
  })
})
