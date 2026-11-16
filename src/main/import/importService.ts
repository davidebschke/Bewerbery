import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from '@shared/constants'
import { decodeText, parseCsv, toCsv } from '@shared/domain/import/csv'
import { templateSheets, type TemplateFormat } from '@shared/domain/import/template'
import type { ImportSheet, ImportWorkbook } from '@shared/types'
import { readOds, writeOds } from './ods'
import { readXlsx, writeXlsx } from './xlsx'
import { ImportFileError, tooManyRows, trimRows } from './xml'

/** Unterstützte Dateiendungen für den Import */
export const IMPORT_EXTENSIONS = ['csv', 'txt', 'tsv', 'ods', 'xlsx'] as const

export interface SaveOutcome {
  canceled: boolean
  filePath?: string
}

export interface ImportService {
  /** Liest eine Tabellendatei; wirft verständliche (deutsche) Fehlermeldungen */
  readWorkbook(filePath: string): Promise<ImportWorkbook>
  /** Öffnet den Dateidialog und liest die Datei; `null` = abgebrochen */
  pickWorkbook(): Promise<ImportWorkbook | null>
  /** Speichert die Import-Vorlage im gewünschten Format */
  saveTemplate(format: TemplateFormat): Promise<SaveOutcome>
}

export interface ImportServiceDeps {
  /** Dateiauswahl für Tabellen; `null` = abgebrochen */
  pickFile(): Promise<string | null>
  /** Speichern-Dialog; `null` = abgebrochen */
  saveFile(suggestedName: string, format: TemplateFormat): Promise<string | null>
}

function parseSheets(extension: string, bytes: Uint8Array): ImportSheet[] {
  switch (extension) {
    case 'ods':
      return readOds(bytes)
    case 'xlsx':
      return readXlsx(bytes)
    default: {
      const text = decodeText(bytes)
      const rows = extension === 'tsv' ? parseCsv(text, '\t') : parseCsv(text)
      return [{ name: 'Tabelle', rows: trimRows(rows) }]
    }
  }
}

export function encodeTemplate(format: TemplateFormat): Uint8Array {
  const sheets = templateSheets()
  if (format === 'xlsx') return writeXlsx(sheets)
  if (format === 'ods') return writeOds(sheets)
  // BOM, damit Excel die UTF-8-Umlaute korrekt anzeigt
  return new TextEncoder().encode(`\uFEFF${toCsv(sheets[0].rows)}\r\n`)
}

export function createImportService(deps: ImportServiceDeps): ImportService {
  async function readWorkbook(filePath: string): Promise<ImportWorkbook> {
    const fileName = basename(filePath)
    const extension = extname(filePath).slice(1).toLowerCase()
    if (!(IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new ImportFileError(
        `„${fileName}“ wird nicht unterstützt. Erlaubt sind CSV-, ODS- und XLSX-Dateien.`,
      )
    }
    const { size } = await stat(filePath)
    if (size > MAX_IMPORT_FILE_BYTES) {
      const limit = Math.round(MAX_IMPORT_FILE_BYTES / 1024 / 1024)
      throw new ImportFileError(`„${fileName}“ ist zu groß (höchstens ${limit} MB).`)
    }

    let sheets: ImportSheet[]
    try {
      sheets = parseSheets(extension, new Uint8Array(await readFile(filePath)))
    } catch (error) {
      if (error instanceof ImportFileError) throw error
      throw new ImportFileError(
        `„${fileName}“ konnte nicht gelesen werden. Ist die Datei beschädigt oder mit einem Passwort geschützt?`,
      )
    }
    if (sheets.some((sheet) => sheet.rows.length > MAX_IMPORT_ROWS)) throw tooManyRows()
    if (!sheets.some((sheet) => sheet.rows.length > 0)) {
      throw new ImportFileError(`„${fileName}“ enthält keine Daten.`)
    }
    return { fileName, sheets }
  }

  return {
    readWorkbook,

    async pickWorkbook() {
      const filePath = await deps.pickFile()
      return filePath ? readWorkbook(filePath) : null
    },

    async saveTemplate(format) {
      const filePath = await deps.saveFile(`Bewerbery-Importvorlage.${format}`, format)
      if (!filePath) return { canceled: true }
      await writeFile(filePath, encodeTemplate(format))
      return { canceled: false, filePath }
    },
  }
}
