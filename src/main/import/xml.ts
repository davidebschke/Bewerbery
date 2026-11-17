import { MAX_IMPORT_ROWS } from '@shared/constants'
import { decodeEntities, escapeXml, tokenizeXml } from '@shared/xml/tokens'

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

export { decodeEntities, escapeXml }

/** Durchläuft ein XML-Dokument und ruft für Start-, End-Tags und Text die Handler auf */
export function walkXml(xml: string, handlers: XmlHandlers): void {
  for (const token of tokenizeXml(xml)) {
    if (token.kind === 'cdata' || token.kind === 'text') {
      handlers.text?.(token.text)
    } else if (token.kind === 'close') {
      handlers.close?.(token.name)
    } else if (token.kind === 'open') {
      handlers.open?.(token.name, token.attributes, token.selfClosing)
      if (token.selfClosing) handlers.close?.(token.name)
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
