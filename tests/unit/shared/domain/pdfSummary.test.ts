import { describe, expect, it } from 'vitest'
import { STAGE_LABELS } from '../../../../src/shared/constants'
import { makeApplication } from '../../../../src/shared/testing/fixtures'
import {
  buildPdfSummary,
  wrapText,
  wrapTextToWidth,
} from '../../../../src/shared/domain/pdfSummary'

describe('buildPdfSummary', () => {
  it('takes company, position and contact data over unchanged', () => {
    const [summary] = buildPdfSummary([
      makeApplication({
        company: 'Muster GmbH',
        position: 'Dev',
        contactName: 'Frau Beispiel',
        contactPhone: '+49 30 1234567',
        contactEmail: 'jobs@example.com',
        notes: 'Eine Notiz',
      }),
    ])
    expect(summary).toMatchObject({
      company: 'Muster GmbH',
      position: 'Dev',
      contactName: 'Frau Beispiel',
      contactPhone: '+49 30 1234567',
      contactEmail: 'jobs@example.com',
      notes: 'Eine Notiz',
    })
  })

  it('formats the sent date and the status label in German', () => {
    const [summary] = buildPdfSummary([
      makeApplication({ sentAt: '2026-09-16', stage: 'interview' }),
    ])
    expect(summary.sentAtLabel).toBe('16.09.2026')
    expect(summary.stageLabel).toBe(STAGE_LABELS.interview)
  })

  it('does not export the follow-up deadline or the appointment', () => {
    const [summary] = buildPdfSummary([
      makeApplication({ stage: 'interview', appointmentAt: '2026-10-01T10:00' }),
    ])
    expect(Object.keys(summary).sort()).toEqual([
      'company',
      'contactEmail',
      'contactName',
      'contactPhone',
      'documents',
      'notes',
      'position',
      'sentAtLabel',
      'stageLabel',
    ])
  })

  it('maps documents to name and added date only, no file contents', () => {
    const [summary] = buildPdfSummary([
      makeApplication({
        documents: [
          { id: 'd1', name: 'Lebenslauf.pdf', storedName: 'd1-cv.pdf', size: 1024, addedAt: 'x' },
        ],
      }),
    ])
    expect(summary.documents).toEqual([{ name: 'Lebenslauf.pdf', addedAt: 'x' }])
  })

  it('returns an empty list for an empty selection', () => {
    expect(buildPdfSummary([])).toEqual([])
  })
})

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('Kurzer Text', 20)).toEqual(['Kurzer Text'])
  })

  it('wraps at word boundaries once the limit is exceeded', () => {
    expect(wrapText('Dies ist ein etwas längerer Beispieltext', 12)).toEqual([
      'Dies ist ein',
      'etwas',
      'längerer',
      'Beispieltext',
    ])
  })

  it('keeps a single overlong word on its own line instead of breaking it', () => {
    expect(wrapText('Kurz Extrem-langes-einzelwort-ohne-leerzeichen Kurz', 10)).toEqual([
      'Kurz',
      'Extrem-langes-einzelwort-ohne-leerzeichen',
      'Kurz',
    ])
  })

  it('treats blank lines between paragraphs as separate lines', () => {
    expect(wrapText('Erster Absatz\n\nZweiter Absatz', 30)).toEqual([
      'Erster Absatz',
      '',
      'Zweiter Absatz',
    ])
  })
})

describe('wrapTextToWidth', () => {
  it('wraps by measured width instead of character count', () => {
    const measure = (text: string): number => text.replace(/i/g, '').length
    expect(wrapTextToWidth('iiii iiii iiii abcd efgh', 4, measure)).toEqual([
      'iiii iiii iiii',
      'abcd',
      'efgh',
    ])
  })
})
