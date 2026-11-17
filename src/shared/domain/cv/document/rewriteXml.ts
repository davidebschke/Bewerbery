import { applyEdits, escapeXmlText, type XmlEdit } from '../../../xml/tokens'
import type { CvFormat } from '../schemas'
import type { ParsedDocument, TextNodeRef } from './types'

/** Absatz-ID → neue Segmenttexte */
export type Rewrites = Record<string, string[]>

/** Steuerzeichen, die in einem Segment nichts verloren haben, werden zu Leerzeichen */
function normalize(text: string): string {
  return text.replace(/[\t\r\n\v\f]+/g, ' ')
}

function encodeDocx(text: string): string {
  return escapeXmlText(normalize(text))
}

/** ODT fasst Leerzeichen zusammen – führende und mehrfache Leerzeichen werden als `text:s` kodiert */
function encodeOdt(text: string): string {
  const escaped = escapeXmlText(normalize(text))
  const runs = escaped.replace(/ {2,}/g, (spaces) => ` <text:s text:c="${spaces.length - 1}"/>`)
  return runs.startsWith(' ') ? `<text:s/>${runs.slice(1)}` : runs
}

function groupNodes(nodes: TextNodeRef[]): Map<string, TextNodeRef[]> {
  const groups = new Map<string, TextNodeRef[]>()
  for (const node of nodes) {
    const key = `${node.paragraphId}#${node.segmentIndex}`
    const group = groups.get(key)
    if (group) group.push(node)
    else groups.set(key, [node])
  }
  return groups
}

/**
 * Ersetzt in einem Dokument-XML nur die Texte der geänderten Segmente.
 * Alle anderen Zeichen – Formatierung, Struktur, Namespaces – bleiben unverändert.
 * Pro Segment bekommt die erste Textstelle den neuen Text, die übrigen werden geleert.
 */
export function rewriteXml(
  xml: string,
  parsed: ParsedDocument,
  rewrites: Rewrites,
  format: CvFormat,
): string {
  const encode = format === 'docx' ? encodeDocx : encodeOdt
  const groups = groupNodes(parsed.nodes)
  const edits: XmlEdit[] = []

  for (const paragraph of parsed.paragraphs) {
    const segments = rewrites[paragraph.id]
    if (!segments) continue

    segments.forEach((text, segmentIndex) => {
      if (text === paragraph.segments[segmentIndex]) return
      const nodes = groups.get(`${paragraph.id}#${segmentIndex}`)
      if (!nodes) return

      nodes.forEach((node, index) => {
        const replacement = index === 0 ? encode(text) : ''
        edits.push({ start: node.start, end: node.end, replacement })
        // Word entfernt sonst führende/abschließende Leerzeichen
        if (index === 0 && format === 'docx' && node.tagEnd !== undefined && !node.preserve) {
          edits.push({
            start: node.tagEnd - 1,
            end: node.tagEnd - 1,
            replacement: ' xml:space="preserve"',
          })
        }
      })
    })
  }

  return edits.length ? applyEdits(xml, edits) : xml
}
