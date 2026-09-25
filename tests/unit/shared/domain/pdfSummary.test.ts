import { describe, expect, it } from 'vitest'
import { makeApplication, makeSettings } from '../../../../src/shared/testing/fixtures'
import { buildPdfSummary, wrapText } from '../../../../src/shared/domain/pdfSummary'

const settings = makeSettings({ followUpWeeks: 2 })
const today = new Date(2026, 8, 23)

describe('buildPdfSummary', () => {
  it('formats the sent date, stage and follow-up status in German', () => {
    const [summary] = buildPdfSummary(
      [makeApplication({ company: 'Muster GmbH', position: 'Dev', sentAt: '2026-09-16' })],
      settings,
      today,
    )
    expect(summary.company).toBe('Muster GmbH')
    expect(summary.position).toBe('Dev')
    expect(summary.stageLabel).toBe('Beworben')
    expect(summary.sentLine).toBe('Abgeschickt am 16.09.2026 (vor 7 Tagen)')
    expect(summary.followUpLine).not.toBe('')
  })

  it('only includes contact lines that are actually filled in', () => {
    const [empty] = buildPdfSummary([makeApplication()], settings, today)
    expect(empty.contactLines).toEqual([])

    const [full] = buildPdfSummary(
      [
        makeApplication({
          contactName: 'Frau Beispiel',
          contactPhone: '+49 30 1234567',
          contactEmail: 'jobs@example.com',
        }),
      ],
      settings,
      today,
    )
    expect(full.contactLines).toEqual([
      'Ansprechpartner: Frau Beispiel',
      'Telefon: +49 30 1234567',
      'E-Mail: jobs@example.com',
    ])
  })

  it('adds an appointment line only when one is set', () => {
    const [withAppointment] = buildPdfSummary(
      [makeApplication({ stage: 'interview', appointmentAt: '2026-10-01T10:00' })],
      settings,
      today,
    )
    expect(withAppointment.appointmentLine).toBe('Termin am 01.10.2026 um 10:00 Uhr')

    const [without] = buildPdfSummary([makeApplication()], settings, today)
    expect(without.appointmentLine).toBeNull()
  })

  it('maps documents to name and added date only, no file contents', () => {
    const [summary] = buildPdfSummary(
      [
        makeApplication({
          documents: [
            { id: 'd1', name: 'Lebenslauf.pdf', storedName: 'd1-cv.pdf', size: 1024, addedAt: 'x' },
          ],
        }),
      ],
      settings,
      today,
    )
    expect(summary.documents).toEqual([{ name: 'Lebenslauf.pdf', addedAt: 'x' }])
  })

  it('returns an empty list for an empty selection', () => {
    expect(buildPdfSummary([], settings, today)).toEqual([])
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
