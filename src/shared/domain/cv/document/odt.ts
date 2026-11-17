import { tokenizeXml } from '../../../xml/tokens'
import { appendText, finishParagraphs, type ParagraphDraft, type ParsedDocument } from './types'

const PARAGRAPHS = new Set(['text:p', 'text:h'])
/** Elemente, deren direkter Text zum Absatz gehört */
const TEXT_CONTAINERS = new Set(['text:p', 'text:h', 'text:span', 'text:a'])
/** Bereiche, deren Absätze nicht bearbeitet werden (Kommentare, Fußnoten-Nummern) */
const SKIPPED = new Set(['office:annotation', 'office:annotation-end', 'text:note-citation'])
const TRACKED_CHANGES = new Set(['text:tracked-changes', 'text:changed-region'])

interface StackEntry {
  name: string
  start: number
  draft?: ParagraphDraft
}

/**
 * Zerlegt die `content.xml` einer ODT-Datei in Absätze und Formatierungs-Segmente.
 *
 * - Ein Segment ist zusammenhängender Text im selben Element (Absatz, `text:span`, `text:a`).
 * - `text:s` (Leerzeichen) gehört zum Segment; Tabulatoren, Zeilenumbrüche und alle anderen
 *   Elemente (Rahmen, Felder …) trennen Segmente.
 * - Kommentare werden ignoriert, Text in Feldern (z. B. Seitenzahl) wird nicht erfasst.
 */
export function parseOdtParagraphs(xml: string): ParsedDocument {
  const stack: StackEntry[] = []
  const drafts: ParagraphDraft[] = []
  const paragraphs: ParagraphDraft[] = []
  let order = 0
  let skippedDepth = 0
  let hasTrackedChanges = false

  const currentParagraph = () => (skippedDepth === 0 ? paragraphs.at(-1) : undefined)
  const containerKey = (entry: StackEntry | undefined) =>
    entry && TEXT_CONTAINERS.has(entry.name) ? `${entry.name}@${entry.start}` : null

  for (const token of tokenizeXml(xml)) {
    const top = stack.at(-1)

    if (token.kind === 'open') {
      const entry: StackEntry = { name: token.name, start: token.start }
      if (TRACKED_CHANGES.has(token.name)) hasTrackedChanges = true
      const paragraph = currentParagraph()

      if (SKIPPED.has(token.name)) {
        if (!token.selfClosing) skippedDepth++
      } else if (PARAGRAPHS.has(token.name)) {
        if (!token.selfClosing && skippedDepth === 0) {
          entry.draft = { order: order++, segments: [], nodes: [], lastKey: null }
          paragraphs.push(entry.draft)
          drafts.push(entry.draft)
        }
      } else if (token.name === 'text:s') {
        const key = containerKey(top)
        if (paragraph && key) {
          const count = Math.max(1, Number(token.attributes['text:c']) || 1)
          const segmentIndex = appendText(paragraph, key, ' '.repeat(count))
          paragraph.nodes.push({ segmentIndex, kind: 'space', start: token.start, end: token.end })
        }
      } else if (!TEXT_CONTAINERS.has(token.name) && paragraph) {
        // Tabulator, Umbruch, Rahmen, Feld … unterbrechen den Textfluss
        paragraph.lastKey = null
      }

      if (!token.selfClosing) stack.push(entry)
      continue
    }

    if (token.kind === 'text') {
      const paragraph = currentParagraph()
      const key = containerKey(top)
      if (!paragraph) continue
      if (!key) {
        paragraph.lastKey = null
        continue
      }
      const segmentIndex = appendText(paragraph, key, token.text)
      paragraph.nodes.push({ segmentIndex, kind: 'text', start: token.start, end: token.end })
      continue
    }

    if (token.kind !== 'close') continue
    const entry = stack.pop()
    if (SKIPPED.has(token.name)) {
      skippedDepth = Math.max(0, skippedDepth - 1)
    } else if (entry?.draft) {
      paragraphs.pop()
    } else if (!TEXT_CONTAINERS.has(token.name)) {
      const paragraph = currentParagraph()
      if (paragraph) paragraph.lastKey = null
    }
  }

  return finishParagraphs(drafts, hasTrackedChanges)
}
