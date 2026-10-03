import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildPdfSummary } from '../../../../src/shared/domain/pdfSummary'
import { makeApplication } from '../../../../src/shared/testing/fixtures'
import { renderApplicationsPdf } from '../../../../src/main/pdf/pdfRenderer'

const GENERATED_AT = '23.09.2026'

async function pageCount(applications: ReturnType<typeof makeApplication>[]): Promise<number> {
  const bytes = await renderApplicationsPdf(buildPdfSummary(applications), GENERATED_AT)
  expect(Buffer.from(bytes.slice(0, 5)).toString('utf8')).toBe('%PDF-')
  return (await PDFDocument.load(bytes)).getPageCount()
}

describe('renderApplicationsPdf', () => {
  it('produces a valid pdf with all three areas filled in', async () => {
    const count = await pageCount([
      makeApplication({
        company: 'Muster GmbH',
        position: 'Softwareentwickler:in',
        contactName: 'Frau Beispiel',
        contactPhone: '+49 30 1234567',
        contactEmail: 'jobs@example.com',
        notes: 'Eine kurze Notiz zur Bewerbung.',
        documents: [
          { id: 'd1', name: 'Lebenslauf.pdf', storedName: 'd1-cv.pdf', size: 1, addedAt: 'x' },
          { id: 'd2', name: 'Anschreiben.pdf', storedName: 'd2-cl.pdf', size: 1, addedAt: 'x' },
        ],
      }),
    ])
    expect(count).toBe(1)
  })

  it('renders a minimal entry with empty contact, documents and notes', async () => {
    expect(await pageCount([makeApplication({ company: 'Minimal AG', position: '' })])).toBe(1)
  })

  it('shows a placeholder page when nothing is selected', async () => {
    expect(await pageCount([])).toBe(1)
  })

  it('shortens values and words that are wider than their area', async () => {
    const long = 'Überlang'.repeat(40)
    const count = await pageCount([
      makeApplication({
        company: long,
        position: long,
        contactName: long,
        contactEmail: `${'a'.repeat(120)}@example.com`,
        notes: long,
        documents: [{ id: 'd1', name: `${long}.pdf`, storedName: 's', size: 1, addedAt: 'x' }],
      }),
    ])
    expect(count).toBe(1)
  })

  it('starts new pages once the cards overflow one page', async () => {
    const applications = Array.from({ length: 12 }, (_, index) =>
      makeApplication({
        company: `Firma ${index}`,
        contactName: 'Kontakt',
        contactPhone: '0123',
        contactEmail: 'a@b.de',
        notes: 'Eine kurze Notiz.',
      }),
    )
    expect(await pageCount(applications)).toBeGreaterThan(1)
  })

  it('splits the notes of a single very long entry across several pages', async () => {
    const notes = Array.from({ length: 120 }, (_, index) => `Notizzeile ${index}`).join('\n')
    expect(await pageCount([makeApplication({ notes })])).toBeGreaterThan(1)
  })

  it('moves a long entry to a fresh page when it starts too close to the page end', async () => {
    const notes = Array.from({ length: 70 }, (_, index) => `Notizzeile ${index}`).join('\n')
    // Je nach Anzahl der Füller bleibt unterschiedlich viel Platz am Seitenende übrig
    for (let fillerCount = 0; fillerCount <= 8; fillerCount += 1) {
      const filler = Array.from({ length: fillerCount }, (_, index) =>
        makeApplication({ company: `Füller ${index}`, notes: 'Kurz' }),
      )
      expect(await pageCount([...filler, makeApplication({ notes })])).toBeGreaterThan(1)
    }
  })
})
