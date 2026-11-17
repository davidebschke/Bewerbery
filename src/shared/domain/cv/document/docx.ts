import { decodeEntities, tokenizeXml } from '../../../xml/tokens'
import { appendText, finishParagraphs, type ParagraphDraft, type ParsedDocument } from './types'

/** Elemente in einem Lauf, die den Textfluss unterbrechen (Segmentgrenze) */
const RUN_BREAKS = new Set([
  'w:tab',
  'w:br',
  'w:cr',
  'w:sym',
  'w:noBreakHyphen',
  'w:softHyphen',
  'w:drawing',
  'w:pict',
  'w:object',
  'w:ptab',
])

const TRACKED_CHANGES = new Set(['w:ins', 'w:del', 'w:moveFrom', 'w:moveTo'])

interface StackEntry {
  name: string
  start: number
  draft?: ParagraphDraft
}

interface RunState {
  /** Rohes `w:rPr` – gleiche Formatierung = gleicher Schlüssel */
  format: string
  /** Element, in dem der Lauf steht (Absatz, Hyperlink, Inhaltssteuerelement …) */
  parent: string
}

interface PendingText {
  contentStart: number
  tagEnd: number
  preserve: boolean
}

/**
 * Zerlegt `word/document.xml` in Absätze und Formatierungs-Segmente.
 *
 * - Ein Segment fasst aufeinanderfolgende Läufe gleicher Formatierung im selben Element zusammen
 *   (Word zerlegt Text oft wegen Rechtschreibprüfung in viele Läufe).
 * - Tabulatoren, Umbrüche und Grafiken trennen Segmente.
 * - Feldergebnisse (`w:fldChar`, `w:fldSimple`) und `mc:Fallback`-Kopien von Textfeldern werden
 *   nicht erfasst; Kopf-/Fußzeilen liegen in eigenen Dateien und bleiben unberührt.
 */
export function parseDocxParagraphs(xml: string): ParsedDocument {
  const stack: StackEntry[] = []
  const drafts: ParagraphDraft[] = []
  const paragraphs: ParagraphDraft[] = []
  const runs: RunState[] = []
  let order = 0
  let fallbackDepth = 0
  let fieldDepth = 0
  let simpleFieldDepth = 0
  let formatStart: number | null = null
  let pending: PendingText | null = null
  let hasTrackedChanges = false

  const currentParagraph = () => paragraphs.at(-1)
  const breakSegment = () => {
    const paragraph = currentParagraph()
    if (paragraph) paragraph.lastKey = null
  }

  for (const token of tokenizeXml(xml)) {
    if (token.kind === 'open') {
      const parent = stack.at(-1)
      const entry: StackEntry = { name: token.name, start: token.start }

      if (TRACKED_CHANGES.has(token.name)) hasTrackedChanges = true

      switch (token.name) {
        case 'mc:Fallback':
          if (!token.selfClosing) fallbackDepth++
          break
        case 'w:fldSimple':
          if (!token.selfClosing) simpleFieldDepth++
          breakSegment()
          break
        case 'w:p':
          if (!token.selfClosing && fallbackDepth === 0) {
            entry.draft = { order: order++, segments: [], nodes: [], lastKey: null }
            paragraphs.push(entry.draft)
            drafts.push(entry.draft)
          }
          break
        case 'w:r':
          runs.push({ format: '', parent: `${parent?.name}@${parent?.start}` })
          break
        case 'w:rPr':
          if (parent?.name === 'w:r' && !token.selfClosing) formatStart = token.start
          break
        case 'w:fldChar': {
          const type = token.attributes['w:fldCharType']
          if (type === 'begin') fieldDepth++
          if (type === 'end') fieldDepth = Math.max(0, fieldDepth - 1)
          breakSegment()
          break
        }
        case 'w:t':
          if (!token.selfClosing) {
            pending = {
              contentStart: token.end,
              tagEnd: token.end,
              preserve: token.attributes['xml:space'] === 'preserve',
            }
          }
          break
        default:
          if (RUN_BREAKS.has(token.name)) breakSegment()
      }

      if (!token.selfClosing) stack.push(entry)
      if (token.selfClosing && token.name === 'w:r') runs.pop()
      continue
    }

    if (token.kind !== 'close') continue
    const entry = stack.pop()

    switch (token.name) {
      case 'w:t': {
        const paragraph = currentParagraph()
        const run = runs.at(-1)
        if (pending && paragraph && run && fallbackDepth === 0) {
          if (fieldDepth > 0 || simpleFieldDepth > 0) {
            breakSegment()
          } else {
            const text = decodeEntities(xml.slice(pending.contentStart, token.start))
            const segmentIndex = appendText(paragraph, `${run.format}|${run.parent}`, text)
            paragraph.nodes.push({
              segmentIndex,
              kind: 'text',
              start: pending.contentStart,
              end: token.start,
              tagEnd: pending.tagEnd,
              preserve: pending.preserve,
            })
          }
        }
        pending = null
        break
      }
      case 'w:rPr':
        if (formatStart !== null) {
          const run = runs.at(-1)
          if (run) run.format = xml.slice(formatStart, token.end)
          formatStart = null
        }
        break
      case 'w:r':
        runs.pop()
        break
      case 'w:p':
        if (entry?.draft) paragraphs.pop()
        break
      case 'w:fldSimple':
        simpleFieldDepth = Math.max(0, simpleFieldDepth - 1)
        breakSegment()
        break
      case 'mc:Fallback':
        fallbackDepth = Math.max(0, fallbackDepth - 1)
        break
    }
  }

  return finishParagraphs(drafts, hasTrackedChanges)
}
