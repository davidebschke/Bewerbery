/**
 * Minimaler, positionsgenauer XML-Tokenizer.
 * Bewusst ohne DTD-/Entity-Auflösung (keine externen Entities, keine Entity-Expansion).
 * Jeder Token kennt seine Start-/End-Position im Originaltext – damit lassen sich
 * gezielt einzelne Stellen ersetzen, ohne das übrige Dokument anzufassen.
 */

export const XML_TOKEN =
  /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g

const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()]
  })
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Escaping für Textinhalt (Anführungszeichen bleiben lesbar) */
export function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of source.matchAll(ATTRIBUTE)) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3])
  }
  return attributes
}

interface Position {
  /** Index des ersten Zeichens im Originaltext */
  start: number
  /** Index direkt hinter dem letzten Zeichen */
  end: number
}

export type XmlToken =
  | (Position & {
      kind: 'open'
      name: string
      attributes: Record<string, string>
      selfClosing: boolean
    })
  | (Position & { kind: 'close'; name: string })
  | (Position & { kind: 'text'; text: string })
  | (Position & { kind: 'cdata'; text: string })
  | (Position & { kind: 'other' })

/** Zerlegt XML in Tokens mit Positionen; `slice(start, end)` ergibt jeweils den Originaltext */
export function tokenizeXml(xml: string): XmlToken[] {
  const tokens: XmlToken[] = []
  for (const match of xml.matchAll(XML_TOKEN)) {
    const [raw, cdata, closing, opening, attributes, selfClosing, text] = match
    const start = match.index
    const end = start + raw.length
    if (cdata !== undefined) {
      tokens.push({ kind: 'cdata', text: cdata, start, end })
    } else if (closing !== undefined) {
      tokens.push({ kind: 'close', name: closing, start, end })
    } else if (opening !== undefined) {
      tokens.push({
        kind: 'open',
        name: opening,
        attributes: parseAttributes(attributes),
        selfClosing: selfClosing === '/',
        start,
        end,
      })
    } else if (text !== undefined) {
      tokens.push({ kind: 'text', text: decodeEntities(text), start, end })
    } else {
      tokens.push({ kind: 'other', start, end })
    }
  }
  return tokens
}

/** Eine Ersetzung im Originaltext */
export interface XmlEdit {
  start: number
  end: number
  replacement: string
}

/** Wendet sich nicht überlappende Ersetzungen von hinten nach vorn an */
export function applyEdits(xml: string, edits: XmlEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start)
  let result = xml
  let limit = Infinity
  for (const edit of sorted) {
    if (edit.end > limit || edit.start > edit.end) {
      throw new Error('Überlappende XML-Ersetzungen')
    }
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end)
    limit = edit.start
  }
  return result
}
