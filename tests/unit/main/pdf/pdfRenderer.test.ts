import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildPdfSummary } from '../../../../src/shared/domain/pdfSummary'
import { makeApplication, makeSettings } from '../../../../src/shared/testing/fixtures'
import { renderApplicationsPdf } from '../../../../src/main/pdf/pdfRenderer'

const settings = makeSettings({ followUpWeeks: 2 })
const today = new Date(2026, 8, 23)

describe('renderApplicationsPdf', () => {
  it('produces a valid pdf with all optional sections filled in', async () => {
    const summaries = buildPdfSummary(
      [
        makeApplication({
          company: 'Muster GmbH',
          position: 'Softwareentwickler:in',
          contactName: 'Frau Beispiel',
          contactPhone: '+49 30 1234567',
          contactEmail: 'jobs@example.com',
          stage: 'interview',
          appointmentAt: '2026-10-01T10:00',
          notes: 'Eine kurze Notiz zur Bewerbung.',
          documents: [
            { id: 'd1', name: 'Lebenslauf.pdf', storedName: 'd1-cv.pdf', size: 1, addedAt: 'x' },
            { id: 'd2', name: 'Anschreiben.pdf', storedName: 'd2-cl.pdf', size: 1, addedAt: 'x' },
          ],
        }),
      ],
      settings,
      today,
    )
    const bytes = await renderApplicationsPdf(summaries, '23.09.2026')
    expect(Buffer.from(bytes.slice(0, 5)).toString('utf8')).toBe('%PDF-')

    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
  })

  it('uses the singular label for exactly one document', async () => {
    const summaries = buildPdfSummary(
      [
        makeApplication({
          documents: [
            { id: 'd1', name: 'Lebenslauf.pdf', storedName: 'd1-cv.pdf', size: 1, addedAt: 'x' },
          ],
        }),
      ],
      settings,
      today,
    )
    const bytes = await renderApplicationsPdf(summaries, '23.09.2026')
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
  })

  it('renders a minimal entry without optional sections', async () => {
    const summaries = buildPdfSummary(
      [makeApplication({ company: 'Minimal AG', stage: 'rejected' })],
      settings,
      today,
    )
    const bytes = await renderApplicationsPdf(summaries, '23.09.2026')
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
  })

  it('shows a placeholder page when nothing is selected', async () => {
    const bytes = await renderApplicationsPdf([], '23.09.2026')
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
  })

  it('starts new pages once content overflows one page', async () => {
    const applications = Array.from({ length: 40 }, (_, index) =>
      makeApplication({
        company: `Firma ${index}`,
        contactName: 'Kontakt',
        contactPhone: '0123',
        contactEmail: 'a@b.de',
        notes:
          'Eine etwas längere Notiz, die mehrere Zeilen im PDF belegen soll, damit die Seite überläuft und ein Seitenumbruch nötig wird.',
      }),
    )
    const summaries = buildPdfSummary(applications, settings, today)
    const bytes = await renderApplicationsPdf(summaries, '23.09.2026')
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBeGreaterThan(1)
  })
})
