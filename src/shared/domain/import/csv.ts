/** Mögliche Trennzeichen – in dieser Reihenfolge bei Gleichstand bevorzugt */
const DELIMITERS = [';', ',', '\t', '|'] as const

export type CsvDelimiter = (typeof DELIMITERS)[number]

/**
 * Dekodiert Dateibytes als Text: UTF-8 (mit oder ohne BOM), sonst Windows-1252
 * (Standard älterer Excel-Exporte unter Windows).
 */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Zählt ein Zeichen außerhalb von Anführungszeichen */
function countOutsideQuotes(line: string, char: string): number {
  let count = 0
  let quoted = false
  for (const c of line) {
    if (c === '"') quoted = !quoted
    else if (c === char && !quoted) count++
  }
  return count
}

/**
 * Erkennt das Trennzeichen: gewinnt, wer in den ersten Zeilen am häufigsten und am
 * gleichmäßigsten vorkommt.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== '')
    .slice(0, 20)
  let best: CsvDelimiter = ';'
  let bestScore = 0
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter))
    const max = Math.max(0, ...counts)
    if (max === 0) continue
    // Zeilen, die die häufigste Anzahl haben, zählen doppelt – Einheitlichkeit schlägt Ausreißer
    const consistent = counts.filter((count) => count === max).length
    const score = consistent * 2 + counts.filter((count) => count > 0).length
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }
  return best
}

/**
 * Zerlegt CSV-Text nach RFC 4180: Felder in Anführungszeichen dürfen Trennzeichen,
 * Zeilenumbrüche und verdoppelte Anführungszeichen enthalten.
 */
export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
    } else if (char === '"' && field.trim() === '') {
      field = ''
      quoted = true
    } else if (char === delimiter) {
      endField()
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) endRow()
  return rows
}

/**
 * Erzeugt CSV-Text (Semikolon wie bei deutschem Excel/LibreOffice, Windows-Zeilenumbrüche);
 * Felder mit Trennzeichen, Anführungszeichen oder Umbrüchen werden in Anführungszeichen gesetzt.
 */
export function toCsv(rows: string[][], delimiter: string = ';'): string {
  return rows
    .map((row) =>
      row
        .map((value) =>
          value.includes(delimiter) || /["\r\n]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value,
        )
        .join(delimiter),
    )
    .join('\r\n')
}
