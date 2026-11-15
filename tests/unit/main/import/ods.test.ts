import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readOds, writeOds } from '../../../../src/main/import/ods'

const FIXTURES = join(__dirname, '../../../fixtures/import')

function ods(body: string): Uint8Array {
  return zipSync({
    'content.xml': strToU8(
      `<office:document-content><office:body><office:spreadsheet>${body}</office:spreadsheet></office:body></office:document-content>`,
    ),
  })
}

describe('readOds', () => {
  it('reads text, dates, times, repeats, spacing, annotations and covered cells', () => {
    const bytes = ods(`
      <table:table table:name="Blatt">
        <table:table-row>
          <table:table-cell table:number-columns-spanned="2"><text:p>Titel</text:p></table:table-cell>
          <table:covered-table-cell/>
          <table:table-cell table:number-columns-repeated="2"><text:p>x</text:p></table:table-cell>
        </table:table-row>
        <table:table-row table:number-rows-repeated="3"><table:table-cell table:number-columns-repeated="1024"/></table:table-row>
        <table:table-row>
          <table:table-cell office:value-type="date" office:date-value="2026-03-15"><text:p>15.03.26</text:p></table:table-cell>
          <table:table-cell office:value-type="date" office:date-value="2026-03-15T14:30:00"><text:p>x</text:p></table:table-cell>
          <table:table-cell office:value-type="date" office:date-value="2026-03-15T00:00:00"/>
          <table:table-cell office:value-type="time" office:time-value="PT09H05M00S"/>
          <table:table-cell office:value-type="date" office:date-value="kaputt"/>
          <table:table-cell office:value-type="time" office:time-value="kaputt"/>
          <table:table-cell office:value-type="date"><text:p>ohne Wert</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>a<text:s text:c="2"/>b<text:s/>c<text:tab/>d<text:line-break/>e</text:p><text:p><text:span>zweiter</text:span> Absatz</text:p><office:annotation><text:p>Kommentar</text:p></office:annotation></table:table-cell>
          <table:table-cell office:value-type="float" office:value="1234.5"><text:p>1.234,50</text:p></table:table-cell>
          <table:table-cell><table:table><table:table-row><table:table-cell><text:p>innen</text:p></table:table-cell></table:table-row></table:table></table:table-cell>
          <table:table-cell><text:h>Überschrift</text:h></table:table-cell>
        </table:table-row>
        <table:table-row table:number-rows-repeated="2"><table:table-cell><text:p>wdh</text:p></table:table-cell></table:table-row>
        <table:table-row table:number-rows-repeated="1048000"><table:table-cell/></table:table-row>
      </table:table>
      <table:table><table:table-row><table:table-cell><text:p>ohne Name</text:p></table:table-cell></table:table-row></table:table>`)

    expect(readOds(bytes)).toEqual([
      {
        name: 'Blatt',
        rows: [
          ['Titel', '', 'x', 'x'],
          [],
          [],
          [],
          [
            '2026-03-15',
            '2026-03-15T14:30',
            '2026-03-15',
            '09:05',
            'kaputt',
            'kaputt',
            'ohne Wert',
          ],
          ['a  b c\td\ne\nzweiter Absatz', '1.234,50', '', 'Überschrift'],
          ['wdh'],
          ['wdh'],
        ],
      },
      { name: 'Tabelle 2', rows: [['ohne Name']] },
    ])
  })

  it('refuses repeated rows beyond the row limit', () => {
    const bytes = ods(
      `<table:table><table:table-row table:number-rows-repeated="6000"><table:table-cell><text:p>x</text:p></table:table-cell></table:table-row></table:table>`,
    )
    expect(() => readOds(bytes)).toThrow('mehr als 5.000 Zeilen')
  })

  it('rejects files without content or tables', () => {
    expect(() => readOds(zipSync({ 'a.xml': strToU8('<a/>') }))).toThrow('content.xml fehlt')
    expect(() => readOds(ods(''))).toThrow('Die Datei enthält keine Tabelle.')
  })

  it('reads a real LibreOffice file with date cells, merged title and two sheets', async () => {
    const sheets = readOds(new Uint8Array(await readFile(join(FIXTURES, '02-unsortiert.ods'))))
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Bewerbungen 2026', 'Archiv 2025'])
    expect(sheets[0].rows[3][0]).toBe('Status')
    expect(sheets[0].rows[4][3]).toBe('2026-10-14')
    expect(sheets[1].rows).toHaveLength(3)
  })
})

describe('writeOds', () => {
  it('stores the mimetype first and uncompressed and can be read back', () => {
    const sheets = [
      { name: 'A & B', rows: [['Kopf', '', 'C'], [], ['zwei\nZeilen']] },
      { name: 'Leer', rows: [] },
    ]
    const bytes = writeOds(sheets)
    // ODF: „mimetype“ steht unkomprimiert direkt hinter dem ersten lokalen Dateikopf
    expect(new TextDecoder().decode(bytes.slice(30, 38))).toBe('mimetype')
    expect(new TextDecoder().decode(bytes.slice(38, 84))).toBe(
      'application/vnd.oasis.opendocument.spreadsheet',
    )
    expect(Object.keys(unzipSync(bytes))).toEqual([
      'mimetype',
      'META-INF/manifest.xml',
      'content.xml',
    ])
    expect(readOds(bytes)).toEqual([
      { name: 'A & B', rows: [['Kopf', '', 'C'], [], ['zwei\nZeilen']] },
      { name: 'Leer', rows: [] },
    ])
  })
})
