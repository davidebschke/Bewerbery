import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectHeaderRow, matchColumns } from '@shared/domain/import/fields'
import { buildDrafts, draftErrors, findDuplicates } from '@shared/domain/import/rows'
import { TEMPLATE_FORMATS } from '@shared/domain/import/template'
import { detectDateOrder } from '@shared/domain/import/values'
import type { ImportSheet } from '@shared/types'
import {
  createImportService,
  encodeTemplate,
  type ImportServiceDeps,
} from '../../../../src/main/import/importService'

const FIXTURES = join(__dirname, '../../../fixtures/import')

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-import-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function service(overrides: Partial<ImportServiceDeps> = {}) {
  return createImportService({
    pickFile: vi.fn(async () => null),
    saveFile: vi.fn(async () => null),
    ...overrides,
  })
}

/** Führt den kompletten automatischen Import-Ablauf für ein Blatt aus */
function autoImport(sheet: ImportSheet) {
  const headerRow = detectHeaderRow(sheet.rows)
  const data = sheet.rows.slice(headerRow === null ? 0 : headerRow + 1)
  const mapping = matchColumns(headerRow === null ? null : sheet.rows[headerRow], data)
  const { order, ambiguous } = detectDateOrder(data.flat())
  const drafts = buildDrafts(sheet.rows, { headerRow, mapping, dateOrder: order })
  return { headerRow, mapping, ambiguous, drafts }
}

describe('importService.readWorkbook', () => {
  it('reads CSV (UTF-8, semicolon) with the sheet name „Tabelle“', async () => {
    const workbook = await service().readWorkbook(join(FIXTURES, '01-sauber.csv'))
    expect(workbook.fileName).toBe('01-sauber.csv')
    expect(workbook.sheets).toHaveLength(1)
    expect(workbook.sheets[0].name).toBe('Tabelle')
    expect(workbook.sheets[0].rows[3][0]).toBe('Café Kranich KG')
  })

  it('reads TSV files with tabs', async () => {
    const path = join(dir, 'liste.TSV')
    await writeFile(path, 'Firma\tStelle\nA\tB\n')
    expect((await service().readWorkbook(path)).sheets[0].rows).toEqual([
      ['Firma', 'Stelle'],
      ['A', 'B'],
    ])
  })

  it('rejects unsupported, too large, empty and broken files', async () => {
    const svc = service()
    await writeFile(join(dir, 'a.pdf'), 'x')
    await expect(svc.readWorkbook(join(dir, 'a.pdf'))).rejects.toThrow(
      '„a.pdf“ wird nicht unterstützt. Erlaubt sind CSV-, ODS- und XLSX-Dateien.',
    )

    await writeFile(join(dir, 'gross.csv'), Buffer.alloc(5 * 1024 * 1024 + 1, 'a'))
    await expect(svc.readWorkbook(join(dir, 'gross.csv'))).rejects.toThrow(
      '„gross.csv“ ist zu groß (höchstens 5 MB).',
    )

    await writeFile(join(dir, 'leer.csv'), '\r\n ; \r\n')
    await expect(svc.readWorkbook(join(dir, 'leer.csv'))).rejects.toThrow(
      '„leer.csv“ enthält keine Daten.',
    )

    await writeFile(join(dir, 'kaputt.xlsx'), 'kein zip')
    await expect(svc.readWorkbook(join(dir, 'kaputt.xlsx'))).rejects.toThrow(
      '„kaputt.xlsx“ konnte nicht gelesen werden. Ist die Datei beschädigt oder mit einem Passwort geschützt?',
    )

    const rows = Array.from({ length: 5001 }, (_, i) => `Firma ${i}`).join('\n')
    await writeFile(join(dir, 'viele.csv'), rows)
    await expect(svc.readWorkbook(join(dir, 'viele.csv'))).rejects.toThrow(
      'Die Tabelle hat mehr als 5.000 Zeilen.',
    )
  })

  it('passes user-facing reader errors through unchanged', async () => {
    const svc = service()
    const header = '<table:table-row table:number-rows-repeated="9000">'
    const { strToU8, zipSync } = await import('fflate')
    const bytes = zipSync({
      'content.xml': strToU8(
        `<a><table:table>${header}<table:table-cell><text:p>x</text:p></table:table-cell></table:table-row></table:table></a>`,
      ),
    })
    await writeFile(join(dir, 'viele.ods'), bytes)
    await expect(svc.readWorkbook(join(dir, 'viele.ods'))).rejects.toThrow(
      'Die Tabelle hat mehr als 5.000 Zeilen. Bitte teile sie auf.',
    )
  })
})

describe('importService.pickWorkbook', () => {
  it('returns null when the dialog is cancelled', async () => {
    expect(await service().pickWorkbook()).toBeNull()
  })

  it('reads the picked file', async () => {
    const svc = service({ pickFile: async () => join(FIXTURES, '07-mehrdeutige-daten.csv') })
    expect((await svc.pickWorkbook())?.fileName).toBe('07-mehrdeutige-daten.csv')
  })
})

describe('importService.saveTemplate', () => {
  it.each(TEMPLATE_FORMATS)('saves a %s template that imports without warnings', async (format) => {
    const target = join(dir, `vorlage.${format}`)
    const saveFile = vi.fn(async () => target)
    const svc = service({ saveFile })
    expect(await svc.saveTemplate(format)).toEqual({ canceled: false, filePath: target })
    expect(saveFile).toHaveBeenCalledWith(`Bewerbery-Importvorlage.${format}`, format)

    const workbook = await svc.readWorkbook(target)
    expect(workbook.sheets.length).toBe(format === 'csv' ? 1 : 2)
    const { drafts } = autoImport(workbook.sheets[0])
    expect(drafts).toHaveLength(2)
    for (const draft of drafts) {
      expect(draft.warnings).toEqual([])
      expect(draftErrors(draft)).toEqual([])
    }
  })

  it('writes a CSV template with BOM and returns canceled when the dialog is closed', async () => {
    expect(
      new TextDecoder('utf-8', { ignoreBOM: true })
        .decode(encodeTemplate('csv'))
        .startsWith('\uFEFFUnternehmen;'),
    ).toBe(true)
    expect(await service().saveTemplate('xlsx')).toEqual({ canceled: true })
  })
})

describe('sample files', () => {
  async function load(name: string, sheet = 0) {
    const workbook = await service().readWorkbook(join(FIXTURES, name))
    return autoImport(workbook.sheets[sheet])
  }

  it('01: imports every row with every field and without warnings', async () => {
    const { drafts } = await load('01-sauber.csv')
    expect(drafts).toHaveLength(5)
    expect(drafts.flatMap((d) => d.warnings)).toEqual([])
    expect(drafts.map((d) => d.stage)).toEqual([
      'applied',
      'interview',
      'rejected',
      'offer',
      'applied',
    ])
    expect(drafts[1].appointmentAt).toBe('2026-09-24T10:30')
    expect(drafts[4].notes).toBe('"Initiativbewerbung"\nmit Portfolio-Link')
  })

  it.each(['02-unsortiert.ods', '02-unsortiert.xlsx'])(
    '02: finds the header below titles in %s and skips blank and summary rows',
    async (name) => {
      const { headerRow, mapping, drafts } = await load(name)
      expect(headerRow).toBe(3)
      expect(mapping).toEqual([
        'stage',
        'contactName',
        'position',
        'sentAt',
        'company',
        'contactEmail',
        'contactPhone',
        'notes',
      ])
      expect(drafts.map((d) => [d.rowNumber, d.company, d.sentAt, d.stage])).toEqual([
        [5, 'Datenwerk GmbH', '2026-10-14', 'applied'],
        [6, 'Agilo AG', '2026-09-01', 'interview'],
        [8, 'Helpdesk24 GmbH', '2026-10-30', 'rejected'],
        [9, 'Küstenwerft Digital', '2026-08-12', 'offer'],
        [10, 'Prüfstand KG', '2026-10-02', 'applied'],
      ])
      expect(drafts.flatMap((d) => d.warnings)).toEqual([])
    },
  )

  it.each(['03-englisch.xlsx', '03-englisch.ods'])(
    '03: maps English headers, values and US dates in %s',
    async (name) => {
      const { mapping, ambiguous, drafts } = await load(name)
      expect(ambiguous).toBe(false)
      expect(mapping).toEqual([
        'company',
        'position',
        'sentAt',
        'stage',
        'lastFollowUpAt',
        'appointmentAt',
        'contactName',
        'contactEmail',
        'contactPhone',
        'notes',
      ])
      expect(drafts.map((d) => [d.sentAt, d.stage, d.lastFollowUpAt, d.contactEmail])).toEqual([
        ['2026-09-15', 'applied', '2026-09-29', 'jobs@northwind.example'],
        ['2026-10-23', 'interview', null, 'hr@contoso.example'],
        ['2026-09-02', 'rejected', '2026-09-16', 'careers@fabrikam.example'],
        ['2026-08-27', 'offer', null, 'sam.lee@tailspin.example'],
        ['2026-10-05', 'applied', null, ''],
      ])
      expect(drafts[1].appointmentAt).toBe('2026-11-04T14:30')
      expect(drafts.flatMap((d) => d.warnings)).toEqual([])
    },
  )

  it('04: keeps unknown columns and values in the notes (Windows-1252, comma)', async () => {
    const { mapping, drafts } = await load('04-unbekannte-felder.csv')
    expect(mapping).toEqual([
      'company',
      'position',
      'sentAt',
      'appendNotes',
      'appendNotes',
      'stage',
      'contactEmail',
      'appendNotes',
      'followUpWeeks',
    ])
    expect(drafts[0]).toMatchObject({
      company: 'Müller & Söhne GmbH',
      stage: 'applied',
      followUpWeeks: 3,
      notes: 'Gehaltsvorstellung: 48.000 €\nQuelle: StepStone\nBewerbungsweg: Online-Formular',
      warnings: [],
    })
    expect(drafts[1].warnings).toHaveLength(3)
    expect(drafts[1].notes).toContain('Status: keine Ahnung')
    expect(drafts[1].notes).toContain('E-Mail: kein Kontakt')
    expect(drafts[2]).toMatchObject({ stage: 'rejected', followUpWeeks: null })
    expect(drafts[2].warnings).toHaveLength(1)
  })

  it('05: reports missing required values and duplicates', async () => {
    const { drafts } = await load('05-fehlende-pflichtwerte.xlsx')
    expect(drafts.map((d) => draftErrors(d))).toEqual([
      ['Unternehmen fehlt'],
      ['Position fehlt'],
      ['Datum fehlt oder ist ungültig'],
      ['Datum fehlt oder ist ungültig'],
      [],
      [],
      [],
      [],
    ])
    expect(drafts[3].warnings).toEqual(['Beworben am: Datum „31.02.2026“ nicht erkannt'])
    const clean = autoImport(
      (await service().readWorkbook(join(FIXTURES, '01-sauber.csv'))).sheets[0],
    )
    const existing = clean.drafts.map((d) => ({ ...d, id: '', documents: [] }))
    expect([...findDuplicates(drafts, existing as never)]).toEqual([7, 8])
  })

  it('06: guesses columns from content when there is no header', async () => {
    const { headerRow, mapping, drafts } = await load('06-ohne-kopfzeile.csv')
    expect(headerRow).toBeNull()
    expect(mapping).toEqual([
      'appendNotes',
      'appendNotes',
      'sentAt',
      'contactEmail',
      'contactPhone',
      'stage',
    ])
    expect(drafts[0].notes).toBe('Spalte A: Seeblick Hotels\nSpalte B: Rezeption')
  })

  it('07: flags ambiguous slash dates', async () => {
    const { ambiguous, drafts } = await load('07-mehrdeutige-daten.csv')
    expect(ambiguous).toBe(true)
    expect(drafts[0].sentAt).toBe('2026-04-03')
  })
})
