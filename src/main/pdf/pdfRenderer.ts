import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { wrapText, type PdfApplicationSummary } from '@shared/domain/pdfSummary'

const PAGE_SIZE: [number, number] = [595.28, 841.89] // A4 in Punkt
const MARGIN = 50
const NOTES_LINE_WIDTH = 95
const TEXT_COLOR = rgb(0.1, 0.11, 0.15)
const MUTED_COLOR = rgb(0.42, 0.45, 0.5)

interface Cursor {
  page: PDFPage
  y: number
}

interface RenderContext {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  cursor: Cursor
}

function newPage(doc: PDFDocument): Cursor {
  return { page: doc.addPage(PAGE_SIZE), y: PAGE_SIZE[1] - MARGIN }
}

function writeLine(
  ctx: RenderContext,
  text: string,
  options: { size?: number; bold?: boolean; gap?: number; muted?: boolean } = {},
): void {
  const { size = 11, bold = false, gap = 14, muted = false } = options
  if (ctx.cursor.y - gap < MARGIN) ctx.cursor = newPage(ctx.doc)
  ctx.cursor.page.drawText(text, {
    x: MARGIN,
    y: ctx.cursor.y,
    size,
    font: bold ? ctx.bold : ctx.font,
    color: muted ? MUTED_COLOR : TEXT_COLOR,
  })
  ctx.cursor.y -= gap
}

function writeApplication(ctx: RenderContext, summary: PdfApplicationSummary): void {
  if (ctx.cursor.y - 40 < MARGIN) ctx.cursor = newPage(ctx.doc)
  const title = summary.position ? `${summary.company} – ${summary.position}` : summary.company
  writeLine(ctx, title, { size: 13, bold: true, gap: 18 })
  writeLine(ctx, `Status: ${summary.stageLabel}`, { gap: 14 })
  writeLine(ctx, summary.sentLine, { gap: 14 })
  for (const line of summary.contactLines) writeLine(ctx, line, { gap: 14 })
  if (summary.followUpLine) writeLine(ctx, summary.followUpLine, { gap: 14 })
  if (summary.appointmentLine) writeLine(ctx, summary.appointmentLine, { gap: 14 })
  if (summary.notes) {
    writeLine(ctx, 'Notizen:', { gap: 13, muted: true })
    for (const line of wrapText(summary.notes, NOTES_LINE_WIDTH)) {
      writeLine(ctx, line, { size: 10, gap: 12, muted: true })
    }
  }
  if (summary.documents.length > 0) {
    const label = summary.documents.length === 1 ? 'Dokument' : 'Dokumente'
    writeLine(ctx, `${summary.documents.length} ${label}:`, { gap: 13, muted: true })
    for (const document of summary.documents) {
      writeLine(ctx, `– ${document.name}`, { size: 10, gap: 12, muted: true })
    }
  }
  ctx.cursor.y -= 10
}

/** Rendert eine Zusammenfassung ausgewählter Bewerbungen als PDF (nur Textinhalte, keine Dateien) */
export async function renderApplicationsPdf(
  summaries: PdfApplicationSummary[],
  generatedAtLabel: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ctx: RenderContext = { doc, font, bold, cursor: newPage(doc) }

  writeLine(ctx, 'Bewerbery – Zusammenfassung der Bewerbungen', { size: 16, bold: true, gap: 22 })
  writeLine(ctx, `Erstellt am ${generatedAtLabel}`, { size: 10, gap: 24, muted: true })

  if (summaries.length === 0) {
    writeLine(ctx, 'Keine Bewerbungen ausgewählt.', { gap: 14 })
  } else {
    for (const summary of summaries) writeApplication(ctx, summary)
  }

  return doc.save()
}
