import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { wrapTextToWidth, type PdfApplicationSummary } from '@shared/domain/pdfSummary'

const PAGE_SIZE: [number, number] = [595.28, 841.89] // A4 in Punkt
const MARGIN = 40
const CONTENT_WIDTH = PAGE_SIZE[0] - 2 * MARGIN
const PAGE_TOP = PAGE_SIZE[1] - MARGIN

const CARD_PADDING = 12
const CARD_RADIUS = 14
const PILL_HEIGHT = 20
const PILL_RADIUS = 7
const PILL_PADDING_X = 9
const PILL_FONT_SIZE = 10
const CARD_GAP = 16
const TILE_PADDING = 10
const TILE_RADIUS = 10
const TILE_GAP = 8
const CARD_HEADER_HEIGHT = PILL_HEIGHT + TILE_GAP
const TILE_HEADER_HEIGHT = 18

const TEXT_COLOR = rgb(0.1, 0.11, 0.15)
const MUTED_COLOR = rgb(0.42, 0.45, 0.5)
const BRAND_COLOR = rgb(0.15, 0.39, 0.92)
const CARD_FILL = rgb(0.965, 0.972, 0.984)
const CARD_BORDER = rgb(0.84, 0.86, 0.9)
const TILE_FILL = rgb(1, 1, 1)
const TILE_BORDER = rgb(0.88, 0.9, 0.93)

interface Fonts {
  regular: PDFFont
  bold: PDFFont
}

/** Eine Textzeile innerhalb einer Kachel; `label` wird gedämpft vor dem Text gezeichnet, der Text beginnt `label.width` weiter rechts */
interface TextLine {
  text: string
  size: number
  height: number
  bold?: boolean
  muted?: boolean
  label?: { text: string; width: number }
}

interface RenderContext {
  doc: PDFDocument
  fonts: Fonts
  page: PDFPage
  y: number
}

function newPage(ctx: RenderContext): void {
  ctx.page = ctx.doc.addPage(PAGE_SIZE)
  ctx.y = PAGE_TOP
}

function fontFor(fonts: Fonts, line: Pick<TextLine, 'bold'>): PDFFont {
  return line.bold ? fonts.bold : fonts.regular
}

/** Kürzt Text mit Auslassungspunkten, bis er in `maxWidth` passt */
function fitText(font: PDFFont, size: number, text: string, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/** Bricht Text auf die Breite um; zu lange Einzelwörter werden gekürzt */
function wrapToWidth(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  return wrapTextToWidth(text, maxWidth, (candidate) =>
    font.widthOfTextAtSize(candidate, size),
  ).map((line) => fitText(font, size, line, maxWidth))
}

function buildCompanyLines(
  fonts: Fonts,
  summary: PdfApplicationSummary,
  width: number,
): TextLine[] {
  const lines: TextLine[] = wrapToWidth(fonts.bold, 12.5, summary.company, width).map((text) => ({
    text,
    size: 12.5,
    height: 16,
    bold: true,
  }))
  if (summary.position) {
    for (const text of wrapToWidth(fonts.regular, 10.5, summary.position, width)) {
      lines.push({ text, size: 10.5, height: 14, muted: true })
    }
  }
  return lines
}

function buildContactLines(
  fonts: Fonts,
  summary: PdfApplicationSummary,
  width: number,
): TextLine[] {
  const rows: [string, string][] = [
    ['Ansprechpartner:', summary.contactName],
    ['Telefon:', summary.contactPhone],
    ['E-Mail:', summary.contactEmail],
  ]
  const labelWidth =
    Math.max(...rows.map(([label]) => fonts.regular.widthOfTextAtSize(label, 10))) + 6
  return rows.map(([label, value]) => ({
    label: { text: label, width: labelWidth },
    text: fitText(fonts.regular, 10, value || '–', width - labelWidth),
    size: 10,
    height: 15,
  }))
}

function buildDetailLines(fonts: Fonts, summary: PdfApplicationSummary, width: number): TextLine[] {
  const lines: TextLine[] = []
  const heading = (text: string): TextLine => ({
    text,
    size: 9.5,
    height: 15,
    bold: true,
    muted: true,
  })

  lines.push(heading(`Dokumente (${summary.documents.length})`))
  if (summary.documents.length === 0) {
    lines.push({ text: 'Keine Dokumente', size: 10, height: 13, muted: true })
  }
  for (const document of summary.documents) {
    const text = fitText(fonts.regular, 10, `– ${document.name}`, width)
    lines.push({ text, size: 10, height: 13 })
  }

  lines.push({ text: '', size: 10, height: 6 })
  lines.push(heading('Notizen'))
  if (summary.notes) {
    for (const text of wrapToWidth(fonts.regular, 10, summary.notes, width)) {
      lines.push({ text, size: 10, height: 13 })
    }
  } else {
    lines.push({ text: 'Keine Notizen', size: 10, height: 13, muted: true })
  }
  return lines
}

function linesHeight(lines: TextLine[]): number {
  return lines.reduce((sum, line) => sum + line.height, 0)
}

function tileHeight(lines: TextLine[]): number {
  return 2 * TILE_PADDING + TILE_HEADER_HEIGHT + linesHeight(lines)
}

/** Pfad eines abgerundeten Rechtecks (Ursprung oben links, y nach unten – wie drawSvgPath erwartet) */
function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2)
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${height - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ')
}

function drawRoundedBox(
  page: PDFPage,
  box: { x: number; top: number; width: number; height: number; radius: number },
  colors: { fill: ReturnType<typeof rgb>; border: ReturnType<typeof rgb> },
): void {
  page.drawSvgPath(roundedRectPath(box.width, box.height, box.radius), {
    x: box.x,
    y: box.top,
    color: colors.fill,
    borderColor: colors.border,
    borderWidth: 0.8,
  })
}

function drawTile(
  ctx: RenderContext,
  box: { x: number; top: number; width: number; height: number },
  title: string,
  lines: TextLine[],
): void {
  drawRoundedBox(
    ctx.page,
    { ...box, radius: TILE_RADIUS },
    { fill: TILE_FILL, border: TILE_BORDER },
  )
  const left = box.x + TILE_PADDING
  ctx.page.drawText(title, {
    x: left,
    y: box.top - TILE_PADDING - 9,
    size: 9,
    font: ctx.fonts.bold,
    color: BRAND_COLOR,
  })

  let top = box.top - TILE_PADDING - TILE_HEADER_HEIGHT
  for (const line of lines) {
    const baseline = top - line.height / 2 - line.size * 0.35
    let x = left
    if (line.label) {
      ctx.page.drawText(line.label.text, {
        x,
        y: baseline,
        size: line.size,
        font: ctx.fonts.regular,
        color: MUTED_COLOR,
      })
      x += line.label.width
    }
    if (line.text) {
      ctx.page.drawText(line.text, {
        x,
        y: baseline,
        size: line.size,
        font: fontFor(ctx.fonts, line),
        color: line.muted ? MUTED_COLOR : TEXT_COLOR,
      })
    }
    top -= line.height
  }
}

/** Anzahl der Zeilen ab Anfang, die in die verfügbare Höhe passen */
function countFittingLines(lines: TextLine[], room: number): number {
  let used = 0
  let count = 0
  for (const line of lines) {
    if (used + line.height > room) break
    used += line.height
    count += 1
  }
  return count
}

interface PillPart {
  text: string
  font: PDFFont
  color: ReturnType<typeof rgb>
}

function pillWidth(parts: PillPart[]): number {
  const textWidth = parts.reduce(
    (sum, part) => sum + part.font.widthOfTextAtSize(part.text, PILL_FONT_SIZE),
    0,
  )
  return textWidth + 2 * PILL_PADDING_X
}

/** Kleines abgerundetes Feld mit mehrfarbigem Text; `x` ist die linke Kante */
function drawPill(ctx: RenderContext, x: number, top: number, parts: PillPart[]): void {
  drawRoundedBox(
    ctx.page,
    { x, top, width: pillWidth(parts), height: PILL_HEIGHT, radius: PILL_RADIUS },
    { fill: TILE_FILL, border: TILE_BORDER },
  )
  const y = top - PILL_HEIGHT / 2 - PILL_FONT_SIZE * 0.35
  let textX = x + PILL_PADDING_X
  for (const part of parts) {
    ctx.page.drawText(part.text, {
      x: textX,
      y,
      size: PILL_FONT_SIZE,
      font: part.font,
      color: part.color,
    })
    textX += part.font.widthOfTextAtSize(part.text, PILL_FONT_SIZE)
  }
}

/** Kopfzeile der Karte: links „Abgeschickt am“, rechts der Status – je in einem kleinen Feld */
function drawCardHeader(
  ctx: RenderContext,
  summary: PdfApplicationSummary,
  area: { left: number; right: number; top: number },
): void {
  const { regular, bold } = ctx.fonts
  const sent: PillPart[] = [
    { text: 'Abgeschickt am ', font: regular, color: MUTED_COLOR },
    { text: summary.sentAtLabel, font: bold, color: TEXT_COLOR },
  ]
  const status: PillPart[] = [
    { text: 'Status: ', font: regular, color: MUTED_COLOR },
    { text: summary.stageLabel, font: bold, color: BRAND_COLOR },
  ]
  drawPill(ctx, area.left, area.top, sent)
  drawPill(ctx, area.right - pillWidth(status), area.top, status)
}

/**
 * Zeichnet eine Bewerbung als abgerundete Karte (Kopfzeile „Abgeschickt am“/„Status“) mit drei Kacheln: „Unternehmen und Position“,
 * „Kontakt zum Unternehmen“ sowie „Dokumente und Notizen“. Lange Notizen laufen auf Folgeseiten weiter.
 */
function renderApplication(ctx: RenderContext, summary: PdfApplicationSummary): void {
  const cardWidth = CONTENT_WIDTH
  const innerWidth = cardWidth - 2 * CARD_PADDING
  const halfWidth = (innerWidth - TILE_GAP) / 2

  const companyLines = buildCompanyLines(ctx.fonts, summary, halfWidth - 2 * TILE_PADDING)
  const contactLines = buildContactLines(ctx.fonts, summary, halfWidth - 2 * TILE_PADDING)
  const topRowHeight = Math.max(tileHeight(companyLines), tileHeight(contactLines))
  let remaining = buildDetailLines(ctx.fonts, summary, innerWidth - 2 * TILE_PADDING)

  const firstBlockHeight = CARD_HEADER_HEIGHT + topRowHeight + TILE_GAP
  const wholeHeight = 2 * CARD_PADDING + firstBlockHeight + tileHeight(remaining)
  if (wholeHeight > ctx.y - MARGIN && wholeHeight <= PAGE_TOP - MARGIN) newPage(ctx)

  let isFirstFragment = true
  while (remaining.length > 0) {
    const topRow = isFirstFragment ? firstBlockHeight : 0
    const chrome = 2 * CARD_PADDING + topRow + 2 * TILE_PADDING + TILE_HEADER_HEIGHT
    let count = countFittingLines(remaining, ctx.y - MARGIN - chrome)
    if (count === 0) {
      if (ctx.y < PAGE_TOP) {
        newPage(ctx)
        continue
      }
      count = 1 // frische Seite: mindestens eine Zeile pro Fragment, damit es weitergeht
    }

    const fragment = remaining.slice(0, count)
    const detailHeight = tileHeight(fragment)
    const cardHeight = 2 * CARD_PADDING + topRow + detailHeight
    const left = MARGIN + CARD_PADDING
    let top = ctx.y - CARD_PADDING

    drawRoundedBox(
      ctx.page,
      { x: MARGIN, top: ctx.y, width: cardWidth, height: cardHeight, radius: CARD_RADIUS },
      { fill: CARD_FILL, border: CARD_BORDER },
    )
    if (isFirstFragment) {
      drawCardHeader(ctx, summary, { left, right: left + innerWidth, top })
      top -= CARD_HEADER_HEIGHT
      const tileBox = { top, width: halfWidth, height: topRowHeight }
      drawTile(ctx, { ...tileBox, x: left }, 'Unternehmen und Position', companyLines)
      drawTile(
        ctx,
        { ...tileBox, x: left + halfWidth + TILE_GAP },
        'Kontakt zum Unternehmen',
        contactLines,
      )
      top -= topRowHeight + TILE_GAP
    }
    const title = isFirstFragment ? 'Dokumente und Notizen' : 'Dokumente und Notizen (Fortsetzung)'
    drawTile(ctx, { x: left, top, width: innerWidth, height: detailHeight }, title, fragment)

    ctx.y -= cardHeight + CARD_GAP
    remaining = remaining.slice(count)
    isFirstFragment = false
    if (remaining.length > 0) newPage(ctx)
  }
}

/** Rendert eine Zusammenfassung ausgewählter Bewerbungen als PDF (nur Textinhalte, keine Dateien) */
export async function renderApplicationsPdf(
  summaries: PdfApplicationSummary[],
  generatedAtLabel: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  const ctx: RenderContext = { doc, fonts, page: doc.addPage(PAGE_SIZE), y: PAGE_TOP }

  ctx.page.drawText('Bewerbery – Zusammenfassung der Bewerbungen', {
    x: MARGIN,
    y: ctx.y - 16,
    size: 18,
    font: fonts.bold,
    color: TEXT_COLOR,
  })
  ctx.page.drawText(`Erstellt am ${generatedAtLabel}`, {
    x: MARGIN,
    y: ctx.y - 36,
    size: 10,
    font: fonts.regular,
    color: MUTED_COLOR,
  })
  ctx.y -= 60

  if (summaries.length === 0) {
    ctx.page.drawText('Keine Bewerbungen ausgewählt.', {
      x: MARGIN,
      y: ctx.y - 12,
      size: 11,
      font: fonts.regular,
      color: TEXT_COLOR,
    })
  }
  for (const summary of summaries) renderApplication(ctx, summary)

  return doc.save()
}
