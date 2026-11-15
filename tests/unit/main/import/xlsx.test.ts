import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readXlsx, serialToIso, writeXlsx } from '../../../../src/main/import/xlsx'

const FIXTURES = join(__dirname, '../../../fixtures/import')

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

/** Baut eine kleine .xlsx-Datei aus einzelnen XML-Teilen */
function xlsx(parts: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])))
}

const RELS = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Target="./worksheets/missing.xml"/></Relationships>`

describe('serialToIso', () => {
  it('converts serial numbers in both date systems', () => {
    expect(serialToIso(46280, 'date')).toBe('2026-09-15')
    expect(serialToIso(46280.5, 'date')).toBe('2026-09-15T12:00')
    expect(serialToIso(46280.6041666667, 'datetime')).toBe('2026-09-15T14:30')
    expect(serialToIso(46280, 'datetime')).toBe('2026-09-15T00:00')
    expect(serialToIso(0.75, 'time')).toBe('18:00')
    expect(serialToIso(0, 'date', true)).toBe('1904-01-01')
  })
})

describe('readXlsx', () => {
  it('reads shared, inline, formula, boolean, error, number and date cells', () => {
    const bytes = xlsx({
      'xl/workbook.xml': `<workbook xmlns="${NS}"><workbookPr date1904="false"/><sheets><sheet name="Eins" r:id="rId1"/><sheet name="Zwei" r:id="rId2"/><sheet name="Fehlt" r:id="rId3"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': RELS,
      'xl/sharedStrings.xml': `<sst><si><t>Firma</t></si><si><r><t>Mül</t></r><r><t>ler</t></r><rPh><t>みゅ</t></rPh></si></sst>`,
      'xl/styles.xml': `<styleSheet><numFmts><numFmt numFmtId="164" formatCode="[$-407]DD.MM.YYYY"/><numFmt numFmtId="165" formatCode="&quot;Tag&quot; 0"/><numFmt numFmtId="166" formatCode="DD.MM.YY HH:MM"/><numFmt numFmtId="167" formatCode="hh:mm"/></numFmts><cellStyleXfs><xf numFmtId="14"/></cellStyleXfs><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="14"/><xf numFmtId="22"/><xf numFmtId="20"/><xf numFmtId="166"/><xf numFmtId="167"/><xf/></cellXfs></styleSheet>`,
      'xl/worksheets/sheet1.xml': `<worksheet><sheetData>
        <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
        <row r="3"><c r="A3" t="inlineStr"><is><t>inline</t></is></c><c t="str"><f>A1</f><v>Formel</v></c><c t="b"><v>1</v></c><c t="b"><v>0</v></c><c t="e"><v>#DIV/0!</v></c></row>
        <row><c s="1"><v>46280</v></c><c s="2"><v>7</v></c><c s="3"><v>46280</v></c><c s="4"><v>46280.5</v></c><c s="5"><v>0.5</v></c><c s="6"><v>46280.25</v></c><c s="7"><v>0.25</v></c><c><v>4930123456</v></c><c><v>1.5</v></c><c s="1"><v>abc</v></c><c><v></v></c><c t="d"><v>2026-09-15</v></c><c t="s"><v>99</v></c></row>
        <row r="8"/>
      </sheetData></worksheet>`,
      'xl/worksheets/sheet2.xml': `<worksheet><sheetData><row r="1"><c r="B1" t="inlineStr"><is><t>B</t></is></c></row></sheetData></worksheet>`,
    })
    expect(readXlsx(bytes)).toEqual([
      {
        name: 'Eins',
        rows: [
          ['Firma', '', 'Müller'],
          [],
          ['inline', 'Formel', 'WAHR', 'FALSCH'],
          [
            '2026-09-15',
            '7',
            '2026-09-15',
            '2026-09-15T12:00',
            '12:00',
            '2026-09-15T06:00',
            '06:00',
            '4930123456',
            '1.5',
            'abc',
            '',
            '2026-09-15',
          ],
        ],
      },
      { name: 'Zwei', rows: [['', 'B']] },
      { name: 'Fehlt', rows: [] },
    ])
  })

  it('supports the 1904 date system and files without styles or shared strings', () => {
    const bytes = xlsx({
      'xl/workbook.xml': `<workbook><workbookPr date1904="1"/><sheets><sheet r:id="rId1"/><sheet name="Ohne Relation"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': RELS,
      'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row><c><v>1</v></c></row></sheetData></worksheet>`,
    })
    expect(readXlsx(bytes)).toEqual([
      { name: '', rows: [['1']] },
      { name: 'Ohne Relation', rows: [] },
    ])
  })

  it('rejects archives without workbook', () => {
    expect(() => readXlsx(xlsx({ 'foo.xml': '<a/>' }))).toThrow('xl/workbook.xml fehlt')
  })

  it('reads a real LibreOffice export with date cells and two sheets', async () => {
    const sheets = readXlsx(new Uint8Array(await readFile(join(FIXTURES, '02-unsortiert.xlsx'))))
    expect(sheets.map((sheet) => sheet.name)).toEqual(['Bewerbungen 2026', 'Archiv 2025'])
    expect(sheets[0].rows[0]).toEqual(['Meine Bewerbungsübersicht 2026'])
    expect(sheets[0].rows[4]).toEqual([
      'offen',
      'Frau Lange',
      'Data Analyst',
      '2026-10-14',
      'Datenwerk GmbH',
      'jobs@datenwerk.example',
      '0511 223344',
      'Remote',
    ])
  })
})

describe('writeXlsx', () => {
  it('writes sheets that can be read back', () => {
    const sheets = [
      {
        name: 'A & B',
        rows: [
          ['Kopf', ''],
          ['<Wert>', 'zwei\nZeilen'],
        ],
      },
      { name: 'Leer', rows: [] },
    ]
    const bytes = writeXlsx(sheets)
    expect(Object.keys(unzipSync(bytes))).toContain('[Content_Types].xml')
    expect(readXlsx(bytes)).toEqual([
      { name: 'A & B', rows: [['Kopf'], ['<Wert>', 'zwei\nZeilen']] },
      { name: 'Leer', rows: [] },
    ])
  })
})
