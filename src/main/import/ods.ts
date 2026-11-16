import { strToU8, unzipSync, zipSync } from 'fflate'
import { MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from '@shared/constants'
import type { ImportSheet } from '@shared/types'
import { escapeXml, ImportFileError, setCell, tooManyRows, trimRows, walkXml } from './xml'

const MIME_TYPE = 'application/vnd.oasis.opendocument.spreadsheet'

/** „2026-03-15T14:30:00“ → „2026-03-15T14:30“, reine Tage ohne Uhrzeit */
function formatDateValue(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!match) return value
  const [, day, hours, minutes] = match
  return hours && `${hours}:${minutes}` !== '00:00' ? `${day}T${hours}:${minutes}` : day
}

/** „PT14H30M00S“ → „14:30“ */
function formatTimeValue(value: string): string {
  const match = /PT(\d+)H(\d+)M/i.exec(value)
  return match ? `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}` : value
}

interface CellState {
  repeat: number
  type: string
  dateValue?: string
  timeValue?: string
  paragraphs: string[]
}

/** Liest alle Tabellenblätter einer .ods-Datei als Textzellen */
export function readOds(bytes: Uint8Array): ImportSheet[] {
  const files = unzipSync(bytes)
  const content = files['content.xml']
  if (!content) throw new Error('Keine gültige OpenDocument-Tabelle (content.xml fehlt)')

  const sheets: ImportSheet[] = []
  let sheet: ImportSheet | null = null
  let rowIndex = 0
  let rowRepeat = 1
  let rowHasContent = false
  let columnIndex = 0
  let cell: CellState | null = null
  let paragraph: string | null = null
  // Kommentare (Anmerkungen) an Zellen gehören nicht zum Zellinhalt
  let annotationDepth = 0
  // Verschachtelte Tabellen in Zellen werden übersprungen
  let tableDepth = 0

  const addText = (value: string) => {
    if (cell && paragraph !== null && annotationDepth === 0) paragraph += value
  }

  walkXml(new TextDecoder('utf-8').decode(content), {
    open(name, attributes) {
      if (name === 'table:table') {
        tableDepth++
        if (tableDepth === 1) {
          sheet = { name: attributes['table:name'] ?? `Tabelle ${sheets.length + 1}`, rows: [] }
          sheets.push(sheet)
          rowIndex = 0
        }
      } else if (tableDepth !== 1) {
        return
      } else if (name === 'table:table-row') {
        rowRepeat = Math.max(1, Number(attributes['table:number-rows-repeated'] ?? 1))
        rowHasContent = false
        columnIndex = 0
      } else if (name === 'table:table-cell' || name === 'table:covered-table-cell') {
        cell = {
          repeat: Math.max(1, Number(attributes['table:number-columns-repeated'] ?? 1)),
          type: attributes['office:value-type'] ?? '',
          dateValue: attributes['office:date-value'],
          timeValue: attributes['office:time-value'],
          paragraphs: [],
        }
      } else if (name === 'office:annotation') {
        annotationDepth++
      } else if (cell && annotationDepth === 0) {
        if (name === 'text:p' || name === 'text:h') paragraph = ''
        else if (name === 'text:s') addText(' '.repeat(Number(attributes['text:c'] ?? 1)))
        else if (name === 'text:tab') addText('\t')
        else if (name === 'text:line-break') addText('\n')
      }
    },
    close(name) {
      if (name === 'table:table') {
        if (tableDepth === 1 && sheet) sheet.rows = trimRows(sheet.rows)
        tableDepth--
      } else if (tableDepth !== 1) {
        return
      } else if (name === 'office:annotation') {
        annotationDepth--
      } else if ((name === 'text:p' || name === 'text:h') && cell && paragraph !== null) {
        if (annotationDepth === 0) cell.paragraphs.push(paragraph)
        paragraph = null
      } else if ((name === 'table:table-cell' || name === 'table:covered-table-cell') && cell) {
        const value =
          cell.type === 'date' && cell.dateValue
            ? formatDateValue(cell.dateValue)
            : cell.type === 'time' && cell.timeValue
              ? formatTimeValue(cell.timeValue)
              : cell.paragraphs.join('\n')
        if (value !== '' && sheet) {
          rowHasContent = true
          const repeat = Math.min(cell.repeat, MAX_IMPORT_COLUMNS - columnIndex)
          for (let i = 0; i < repeat; i++) setCell(sheet.rows, rowIndex, columnIndex + i, value)
        }
        columnIndex += cell.repeat
        cell = null
      } else if (name === 'table:table-row' && sheet) {
        if (rowHasContent && rowRepeat > 1) {
          // Wiederholte Zeilen mit Inhalt (selten) ausschreiben
          if (rowIndex + rowRepeat > MAX_IMPORT_ROWS) throw tooManyRows()
          const template = sheet.rows[rowIndex]
          for (let i = 1; i < rowRepeat; i++) sheet.rows[rowIndex + i] = [...template]
        }
        // Leere wiederholte Zeilen (oft bis Zeile 1.048.576) nur zählen, nicht anlegen
        rowIndex += rowRepeat
      }
    },
    text: addText,
  })

  if (!sheets.length) throw new ImportFileError('Die Datei enthält keine Tabelle.')
  return sheets
}

const CONTENT_NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
].join(' ')

function tableXml(sheet: ImportSheet): string {
  const columns = Math.max(1, ...sheet.rows.map((row) => row.length))
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((value) => {
          if (value === '') return '<table:table-cell/>'
          const style = r === 0 ? ' table:style-name="ce1"' : ''
          const paragraphs = value
            .split('\n')
            .map((line) => `<text:p>${escapeXml(line)}</text:p>`)
            .join('')
          return `<table:table-cell office:value-type="string"${style}>${paragraphs}</table:table-cell>`
        })
        .join('')
      return `<table:table-row>${cells || '<table:table-cell/>'}</table:table-row>`
    })
    .join('')
  return `<table:table table:name="${escapeXml(sheet.name)}"><table:table-column table:style-name="co1" table:number-columns-repeated="${columns}"/>${rows}</table:table>`
}

/** Schreibt Tabellenblätter als .ods (Text-Zellen, erste Zeile fett) */
export function writeOds(sheets: ImportSheet[]): Uint8Array {
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content ${CONTENT_NS} office:version="1.2"><office:automatic-styles><style:style style:name="co1" style:family="table-column"><style:table-column-properties style:column-width="4.5cm"/></style:style><style:style style:name="ce1" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles><office:body><office:spreadsheet>${sheets.map(tableXml).join('')}</office:spreadsheet></office:body></office:document-content>`
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${MIME_TYPE}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`
  // „mimetype“ muss laut ODF-Standard die erste, unkomprimierte Datei sein
  return zipSync({
    mimetype: [strToU8(MIME_TYPE), { level: 0 }],
    'META-INF/manifest.xml': strToU8(manifest),
    'content.xml': strToU8(content),
  })
}
