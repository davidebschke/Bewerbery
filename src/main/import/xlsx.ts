import { strToU8, unzipSync, zipSync, type Unzipped } from 'fflate'
import { MAX_IMPORT_COLUMNS } from '@shared/constants'
import type { ImportSheet } from '@shared/types'
import { columnLetter } from '@shared/domain/import/fields'
import { escapeXml, setCell, trimRows, walkXml } from './xml'

/** Eingebaute Excel-Zahlenformate für Datum (mit/ohne Zeit) und reine Uhrzeit */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57])
const BUILTIN_DATETIME_FORMATS = new Set([22])
const BUILTIN_TIME_FORMATS = new Set([18, 19, 20, 21, 45, 46, 47])

type CellKind = 'date' | 'datetime' | 'time' | 'number'

function text(files: Unzipped, path: string): string | null {
  const file = files[path]
  return file ? new TextDecoder('utf-8').decode(file) : null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Excel-Seriennummer → ISO-Datum/Uhrzeit (Basis 1899-12-30 bzw. 1904-01-01) */
export function serialToIso(serial: number, kind: CellKind, date1904 = false): string {
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const date = new Date(base + Math.round((serial * 86_400_000) / 60_000) * 60_000)
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  if (kind === 'time') return time
  if (kind === 'datetime' || (kind === 'date' && time !== '00:00')) return `${day}T${time}`
  return day
}

/** Ordnet jedem Zellstil (Index in cellXfs) die Art seines Zahlenformats zu */
function readStyleKinds(xml: string | null): CellKind[] {
  if (!xml) return []
  const customFormats = new Map<number, CellKind>()
  const kinds: CellKind[] = []
  let inCellXfs = false

  const kindOfCode = (code: string): CellKind => {
    // Text in Anführungszeichen, Escapes und [Farbe]/[$-Locale] entfernen
    const cleaned = code.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '')
    const hasDate = /[dy]/i.test(cleaned)
    const hasTime = /[hs]/i.test(cleaned)
    if (hasDate && hasTime) return 'datetime'
    if (hasDate) return 'date'
    return hasTime ? 'time' : 'number'
  }

  walkXml(xml, {
    open(name, attributes) {
      if (name === 'numFmt') {
        customFormats.set(Number(attributes.numFmtId), kindOfCode(attributes.formatCode ?? ''))
      } else if (name === 'cellXfs') {
        inCellXfs = true
      } else if (name === 'xf' && inCellXfs) {
        const id = Number(attributes.numFmtId ?? 0)
        let kind: CellKind = customFormats.get(id) ?? 'number'
        if (BUILTIN_DATETIME_FORMATS.has(id)) kind = 'datetime'
        else if (BUILTIN_DATE_FORMATS.has(id)) kind = 'date'
        else if (BUILTIN_TIME_FORMATS.has(id)) kind = 'time'
        kinds.push(kind)
      }
    },
    close(name) {
      if (name === 'cellXfs') inCellXfs = false
    },
  })
  return kinds
}

/** Gemeinsame Zeichenketten; Lautschrift (`rPh`) wird ausgelassen */
function readSharedStrings(xml: string | null): string[] {
  if (!xml) return []
  const strings: string[] = []
  let current = ''
  let inText = false
  let phoneticDepth = 0
  walkXml(xml, {
    open(name) {
      if (name === 'si') current = ''
      else if (name === 'rPh') phoneticDepth++
      else if (name === 't') inText = phoneticDepth === 0
    },
    close(name) {
      if (name === 'si') strings.push(current)
      else if (name === 'rPh') phoneticDepth--
      else if (name === 't') inText = false
    },
    text(value) {
      if (inText) current += value
    },
  })
  return strings
}

/** Spaltenindex aus einem Zellbezug wie „AB12“ */
function columnIndex(reference: string): number | null {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase()
  if (!letters) return null
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  return `xl/${target}`.replace(/\/\.\//g, '/')
}

interface SheetContext {
  sharedStrings: string[]
  styleKinds: CellKind[]
  date1904: boolean
}

function readSheet(xml: string, context: SheetContext): string[][] {
  const rows: string[][] = []
  let rowIndex = -1
  let columnCursor = 0
  let cell: { column: number; type: string; style: number; value: string; inline: string } | null =
    null
  let capture: 'v' | 't' | null = null

  walkXml(xml, {
    open(name, attributes) {
      if (name === 'row') {
        const declared = Number(attributes.r)
        rowIndex = declared > 0 ? declared - 1 : rowIndex + 1
        columnCursor = 0
      } else if (name === 'c' && rowIndex >= 0) {
        const column = columnIndex(attributes.r ?? '') ?? columnCursor
        columnCursor = column + 1
        cell = {
          column,
          type: attributes.t ?? 'n',
          style: Number(attributes.s ?? 0),
          value: '',
          inline: '',
        }
      } else if (cell && (name === 'v' || name === 't')) {
        capture = name
      }
    },
    close(name) {
      if (name === 'v' || name === 't') capture = null
      else if (name === 'c' && cell) {
        const value = cellText(cell, context)
        // Nur Zellen mit Inhalt anlegen – formatierte Leerzeilen bis Zeile 1.048.576 sind üblich
        if (value !== '' && cell.column < MAX_IMPORT_COLUMNS)
          setCell(rows, rowIndex, cell.column, value)
        cell = null
      }
    },
    text(value) {
      if (!cell || !capture) return
      if (capture === 'v') cell.value += value
      else cell.inline += value
    },
  })
  return trimRows(rows)
}

function cellText(
  cell: { type: string; style: number; value: string; inline: string },
  { sharedStrings, styleKinds, date1904 }: SheetContext,
): string {
  switch (cell.type) {
    case 's':
      return sharedStrings[Number(cell.value)] ?? ''
    case 'inlineStr':
      return cell.inline
    case 'str':
    case 'd':
      return cell.value
    case 'b':
      return cell.value === '1' ? 'WAHR' : 'FALSCH'
    case 'e':
      return ''
    default: {
      if (cell.value === '') return ''
      const number = Number(cell.value)
      const kind = styleKinds[cell.style] ?? 'number'
      if (kind !== 'number' && Number.isFinite(number)) return serialToIso(number, kind, date1904)
      return Number.isFinite(number) ? String(number) : cell.value
    }
  }
}

/** Liest alle Tabellenblätter einer .xlsx-Datei als Textzellen */
export function readXlsx(bytes: Uint8Array): ImportSheet[] {
  const files = unzipSync(bytes)
  const workbook = text(files, 'xl/workbook.xml')
  if (!workbook) throw new Error('Keine gültige Excel-Datei (xl/workbook.xml fehlt)')

  const targets = new Map<string, string>()
  walkXml(text(files, 'xl/_rels/workbook.xml.rels') ?? '', {
    open(name, attributes) {
      if (name === 'Relationship') targets.set(attributes.Id, resolveTarget(attributes.Target))
    },
  })

  const declared: { name: string; path: string }[] = []
  let date1904 = false
  walkXml(workbook, {
    open(name, attributes) {
      if (name === 'workbookPr') {
        date1904 = attributes.date1904 === '1' || attributes.date1904 === 'true'
      } else if (name === 'sheet') {
        const id = attributes['r:id'] ?? ''
        declared.push({ name: attributes.name ?? '', path: targets.get(id) ?? '' })
      }
    },
  })

  const context: SheetContext = {
    sharedStrings: readSharedStrings(text(files, 'xl/sharedStrings.xml')),
    styleKinds: readStyleKinds(text(files, 'xl/styles.xml')),
    date1904,
  }
  return declared.map(({ name, path }) => {
    const xml = text(files, path)
    return { name, rows: xml ? readSheet(xml, context) : [] }
  })
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

const STYLES = `${XML_HEAD}<styleSheet xmlns="${MAIN_NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function sheetXml(rows: string[][]): string {
  const columns = Math.max(1, ...rows.map((row) => row.length))
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === '') return ''
          const style = r === 0 ? ' s="1"' : ''
          return `<c r="${columnLetter(c)}${r + 1}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  return `${XML_HEAD}<worksheet xmlns="${MAIN_NS}"><cols><col min="1" max="${columns}" width="24" customWidth="1"/></cols><sheetData>${body}</sheetData></worksheet>`
}

/** Schreibt Tabellenblätter als .xlsx (Text-Zellen, erste Zeile fett) */
export function writeXlsx(sheets: ImportSheet[]): Uint8Array {
  const sheetOverrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  const sheetEntries = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('')
  const sheetRelations = sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheetEntries}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="${PKG_REL_NS}">${sheetRelations}<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheet.rows))
  })
  return zipSync(files)
}
