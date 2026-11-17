import type { Rewrites } from './document/rewriteXml'
import type { CvParagraph, CvSource } from './schemas'

export type { Rewrites }

export interface AiParagraph {
  id: string
  segments: string[]
}

const LEADING_SPACE = /^\s+/
const TRAILING_SPACE = /\s+$/

/** Übernimmt führende/abschließende Leerzeichen des Originals (z. B. „Skills: “ vor dem nächsten Segment) */
function keepOuterSpace(original: string, next: string): string {
  let result = next.trim()
  const leading = LEADING_SPACE.exec(original)?.[0] ?? ''
  const trailing = TRAILING_SPACE.exec(original)?.[0] ?? ''
  if (result === '') return next
  result = leading + result + trailing
  return result
}

/**
 * Prüft die Antwort der KI und behält nur gültige Änderungen:
 * bekannte, bearbeitbare Absätze mit gleicher Segmentanzahl und nicht leerem Text.
 * Alle anderen Absätze bleiben unverändert – das Layout kann so nicht kaputtgehen.
 */
export function mergeRewrite(source: CvSource, aiParagraphs: AiParagraph[]): Rewrites {
  const byId = new Map(source.paragraphs.map((paragraph) => [paragraph.id, paragraph]))
  const rewrites: Rewrites = {}

  for (const candidate of aiParagraphs) {
    const original = byId.get(candidate.id)
    if (!original?.editable) continue
    if (candidate.segments.length !== original.segments.length) continue
    if (candidate.segments.join('').trim() === '') continue

    const segments = candidate.segments.map((text, index) =>
      keepOuterSpace(original.segments[index], text),
    )
    if (segments.every((text, index) => text === original.segments[index])) continue
    rewrites[original.id] = segments
  }
  return rewrites
}

/** Absätze mit angewendeten Änderungen (für Vorschau und Text) */
export function applyRewrites(source: CvSource, rewrites: Rewrites): CvParagraph[] {
  return source.paragraphs.map((paragraph) =>
    rewrites[paragraph.id] ? { ...paragraph, segments: rewrites[paragraph.id] } : paragraph,
  )
}

/** Verbindet Segmente; ohne Leerraum an der Grenze (Tabulator, Umbruch) wird ein Leerzeichen eingefügt */
export function paragraphText(paragraph: CvParagraph): string {
  return paragraph.segments.reduce((text, segment) => {
    if (!text) return segment
    const needsSpace = !/\s$/.test(text) && !/^\s/.test(segment)
    return text + (needsSpace ? ' ' : '') + segment
  }, '')
}

/** Reiner Text einer Variante – zum Kopieren und Bewerten */
export function variantText(source: CvSource, rewrites: Rewrites = {}): string {
  return applyRewrites(source, rewrites).map(paragraphText).join('\n')
}

/** Verhältnis Textlänge Variante / Original (1 = gleich lang) */
export function lengthRatio(source: CvSource, rewrites: Rewrites): number {
  const original = variantText(source).length
  return original === 0 ? 1 : variantText(source, rewrites).length / original
}

/** IDs der geänderten Absätze */
export function changedParagraphIds(rewrites: Rewrites): Set<string> {
  return new Set(Object.keys(rewrites))
}
