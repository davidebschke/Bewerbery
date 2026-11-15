import { MAX_IMPORT_ROWS } from '@shared/constants'

/** Fehler mit einer Meldung, die so dem Nutzer angezeigt werden kann */
export class ImportFileError extends Error {}

/**
 * Minimaler, ereignisbasierter XML-Leser für die XML-Teile von .xlsx/.ods.
 * Bewusst ohne DTD-/Entity-Auflösung (keine externen Entities, keine Entity-Expansion).
 */

export interface XmlHandlers {
  open?(name: string, attributes: Record<string, string>, selfClosing: boolean): void
  close?(name: string): void
  text?(text: string): void
}

const TOKEN =
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

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of source.matchAll(ATTRIBUTE)) {
    attributes[match[1]] = decodeEntities(match[2] ?? match[3])
  }
  return attributes
}

/** Durchläuft ein XML-Dokument und ruft für Start-, End-Tags und Text die Handler auf */
export function walkXml(xml: string, handlers: XmlHandlers): void {
  for (const match of xml.matchAll(TOKEN)) {
    const [, cdata, closing, opening, attributes, selfClosing, text] = match
    if (cdata !== undefined) {
      handlers.text?.(cdata)
    } else if (closing !== undefined) {
      handlers.close?.(closing)
    } else if (opening !== undefined) {
      handlers.open?.(opening, parseAttributes(attributes), selfClosing === '/')
      if (selfClosing === '/') handlers.close?.(opening)
    } else if (text !== undefined) {
      handlers.text?.(decodeEntities(text))
    }
  }
}

export function tooManyRows(): ImportFileError {
  return new ImportFileError(
    `Die Tabelle hat mehr als ${MAX_IMPORT_ROWS.toLocaleString('de-DE')} Zeilen. Bitte teile sie auf.`,
  )
}

/**
 * Setzt eine Zelle in einer dünn besetzten Tabelle und füllt Lücken auf.
 * Bricht ab, sobald die Tabelle mehr Zeilen hat, als importiert werden dürfen.
 */
export function setCell(rows: string[][], row: number, column: number, value: string): void {
  if (row >= MAX_IMPORT_ROWS) throw tooManyRows()
  while (rows.length <= row) rows.push([])
  const target = rows[row]
  while (target.length < column) target.push('')
  target[column] = value
}

/** Entfernt am Ende leere Zellen jeder Zeile und leere Zeilen am Tabellenende */
export function trimRows(rows: string[][]): string[][] {
  const trimmed = rows.map((row) => {
    let end = row.length
    while (end > 0 && row[end - 1].trim() === '') end--
    return row.slice(0, end)
  })
  let end = trimmed.length
  while (end > 0 && trimmed[end - 1].length === 0) end--
  return trimmed.slice(0, end)
}
