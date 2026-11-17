import type { CvParagraph } from '../schemas'

/**
 * Eine ersetzbare Textstelle im Dokument-XML.
 * `start`/`end` umfassen genau den Bereich, der beim Zurückschreiben ersetzt wird.
 */
export interface TextNodeRef {
  paragraphId: string
  segmentIndex: number
  /** `space` = ODT-Element `text:s`, das beim Ersetzen entfällt */
  kind: 'text' | 'space'
  start: number
  end: number
  /** DOCX: Ende des öffnenden `w:t`-Tags und ob es `xml:space="preserve"` trägt */
  tagEnd?: number
  preserve?: boolean
}

export interface ParsedDocument {
  paragraphs: CvParagraph[]
  nodes: TextNodeRef[]
  hasTrackedChanges: boolean
}

/** Absatz während des Einlesens */
export interface ParagraphDraft {
  order: number
  segments: string[]
  nodes: Omit<TextNodeRef, 'paragraphId'>[]
  /** Schlüssel des zuletzt erweiterten Segments; `null` = nächster Text beginnt ein neues */
  lastKey: string | null
}

const HAS_LETTER = /\p{L}/u

/** Wandelt eingelesene Absätze in die Dokumentreihenfolge mit stabilen IDs um */
export function finishParagraphs(
  drafts: ParagraphDraft[],
  hasTrackedChanges: boolean,
): ParsedDocument {
  const paragraphs: CvParagraph[] = []
  const nodes: TextNodeRef[] = []
  const ordered = drafts
    .filter((draft) => draft.segments.length > 0)
    .sort((a, b) => a.order - b.order)
  ordered.forEach((draft, index) => {
    const id = `p${index}`
    paragraphs.push({
      id,
      segments: draft.segments,
      editable: HAS_LETTER.test(draft.segments.join('')),
    })
    for (const node of draft.nodes) nodes.push({ ...node, paragraphId: id })
  })
  return { paragraphs, nodes, hasTrackedChanges }
}

/** Hängt Text an das aktuelle Segment an oder beginnt ein neues */
export function appendText(draft: ParagraphDraft, key: string, text: string): number {
  if (draft.lastKey !== key) {
    draft.segments.push('')
    draft.lastKey = key
  }
  const index = draft.segments.length - 1
  draft.segments[index] += text
  return index
}
