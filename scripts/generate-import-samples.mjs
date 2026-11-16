/**
 * Erzeugt die Beispieldateien für den Tabellen-Import unter tests/fixtures/import/.
 *
 * CSV-Dateien werden direkt geschrieben. Für .ods/.xlsx entsteht zuerst eine flache
 * OpenDocument-Datei (.fods), die LibreOffice headless in echte .ods/.xlsx umwandelt –
 * so testen wir gegen Dateien, wie sie ein Tabellenprogramm wirklich speichert.
 *
 * Aufruf: node scripts/generate-import-samples.mjs
 * LibreOffice-Pfad bei Bedarf über SOFFICE=<Pfad zu soffice> setzen.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = join(import.meta.dirname, '../tests/fixtures/import')
const SOFFICE =
  process.env.SOFFICE ??
  ['C:/Program Files/LibreOffice/program/soffice.exe', '/usr/bin/soffice'].find(existsSync) ??
  'soffice'

// ---------- Hilfen ----------

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function csv(rows, delimiter = ';') {
  return rows
    .map((row) =>
      row
        .map((v) => (v.includes(delimiter) || /["\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
        .join(delimiter),
    )
    .join('\r\n')
}

/** Windows-1252 für die Zeichen, die in den Beispielen vorkommen */
function toWindows1252(text) {
  const map = { '€': 0x80, '–': 0x96, '„': 0x84, '“': 0x93 }
  return Uint8Array.from([...text].map((c) => map[c] ?? c.charCodeAt(0)))
}

// Zelltypen für .fods
const s = (text, extra = '') => ({ kind: 's', text, extra })
const d = (iso, style = 'date') => ({ kind: 'd', iso, style })
const empty = { kind: 'e' }
const t = (text) => (text === '' ? empty : s(text))

function cellXml(cell) {
  if (cell.kind === 'e') return '<table:table-cell/>'
  if (cell.kind === 'd') {
    return `<table:table-cell table:style-name="${cell.style}" office:value-type="date" office:date-value="${cell.iso}"><text:p>${esc(cell.iso)}</text:p></table:table-cell>`
  }
  return `<table:table-cell office:value-type="string"${cell.extra}><text:p>${esc(cell.text)}</text:p></table:table-cell>`
}

function tableXml(name, rows) {
  const body = rows
    .map((row) =>
      row === 'blank'
        ? '<table:table-row><table:table-cell/></table:table-row>'
        : `<table:table-row>${row.map((c) => cellXml(typeof c === 'string' ? t(c) : c)).join('')}</table:table-row>`,
    )
    .join('\n')
  return `<table:table table:name="${esc(name)}">\n${body}\n</table:table>`
}

function fods(tables) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
<office:automatic-styles>
  <number:date-style style:name="N1"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/></number:date-style>
  <number:date-style style:name="N2"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>
  <number:date-style style:name="N3"><number:month number:style="long"/><number:text>/</number:text><number:day number:style="long"/><number:text>/</number:text><number:year number:style="long"/></number:date-style>
  <style:style style:name="date" style:family="table-cell" style:data-style-name="N1"/>
  <style:style style:name="datetime" style:family="table-cell" style:data-style-name="N2"/>
  <style:style style:name="usdate" style:family="table-cell" style:data-style-name="N3"/>
</office:automatic-styles>
<office:body><office:spreadsheet>
${tables.join('\n')}
</office:spreadsheet></office:body></office:document>`
}

async function convert(fodsText, name, formats) {
  const dir = await mkdtemp(join(tmpdir(), 'bewerbery-samples-'))
  try {
    const source = join(dir, `${name}.fods`)
    await writeFile(source, fodsText, 'utf8')
    for (const format of formats) {
      // Eigenes Profil, damit eine laufende LibreOffice-Instanz nicht stört
      execFileSync(SOFFICE, [
        `-env:UserInstallation=file:///${dir.replace(/\\/g, '/')}/profile`,
        '--headless',
        '--convert-to',
        format === 'xlsx' ? 'xlsx:Calc MS Excel 2007 XML' : 'ods',
        '--outdir',
        OUT,
        source,
      ])
      console.log(`  ${name}.${format}`)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// ---------- Beispieldateien ----------

const GERMAN_HEADER = [
  'Unternehmen',
  'Position',
  'Beworben am',
  'Status',
  'Letzte Nachfrage',
  'Melden nach (Wochen)',
  'Termin',
  'Ansprechpartner',
  'E-Mail',
  'Telefon',
  'Notizen',
]

// 01 – sauber, alle Felder gefüllt
const clean = [
  GERMAN_HEADER,
  [
    'Nordlicht Software GmbH',
    'Frontend-Entwickler:in',
    '02.09.2026',
    'Beworben',
    '16.09.2026',
    '2',
    '',
    'Frau Jansen',
    'karriere@nordlicht.example',
    '+49 40 1234567',
    'Über LinkedIn gefunden',
  ],
  [
    'Bergwerk Logistik AG',
    'Projektmanager:in IT',
    '20.08.2026',
    'Termin',
    '03.09.2026',
    '3',
    '24.09.2026 10:30',
    'Herr Albers',
    'bewerbung@bergwerk.example',
    '+49 231 765432',
    'Zweites Gespräch vor Ort',
  ],
  [
    'Café Kranich KG',
    'Backend-Entwickler:in',
    '05.08.2026',
    'Absage',
    '19.08.2026',
    '2',
    '',
    'Frau Öztürk',
    'jobs@kranich.example',
    '+49 30 998877',
    'Absage nach erstem Gespräch',
  ],
  [
    'Sonnenfeld Energie GmbH',
    'DevOps Engineer',
    '28.07.2026',
    'Angebot',
    '11.08.2026',
    '4',
    '10.08.2026 15:00',
    'Herr Weiß',
    'talent@sonnenfeld.example',
    '+49 89 445566',
    'Gehalt 62.000 €; Start 01.11.',
  ],
  [
    'Möwe & Partner',
    'UX-Designer:in',
    '10.09.2026',
    'Beworben',
    '',
    '',
    '',
    'Frau Brandt',
    'hallo@moewe.example',
    '+49 421 112233',
    '"Initiativbewerbung"\nmit Portfolio-Link',
  ],
]

// 02 – unsortiert: Titelzeilen, Spalten vertauscht, Leerzeilen, Summenzeile, zweites Blatt
const unsortedSheet = [
  [s('Meine Bewerbungsübersicht 2026', ' table:number-columns-spanned="4"'), empty, empty, empty],
  ['Stand: 01.11.2026'],
  'blank',
  [
    'Status',
    'Ansprechpartner',
    'Stelle',
    'Datum',
    'Firma',
    'Kontakt E-Mail',
    'Telefon',
    'Bemerkung',
  ],
  [
    'offen',
    'Frau Lange',
    'Data Analyst',
    d('2026-10-14'),
    'Datenwerk GmbH',
    'jobs@datenwerk.example',
    '0511 223344',
    'Remote',
  ],
  [
    'Vorstellungsgespräch',
    'Herr Kaya',
    'Scrum Master',
    d('2026-09-01'),
    'Agilo AG',
    'people@agilo.example',
    '+49 69 554433',
    '',
  ],
  'blank',
  [
    'abgelehnt',
    '',
    'Support Engineer',
    d('2026-10-30'),
    'Helpdesk24 GmbH',
    '',
    '',
    'Standardabsage',
  ],
  [
    'Zusage!',
    'Frau Petersen',
    'Softwareentwickler:in',
    d('2026-08-12'),
    'Küstenwerft Digital',
    'karriere@kuestenwerft.example',
    '0461 778899',
    'Vertrag unterschrieben',
  ],
  ['beworben', 'Herr Novak', 'QA Engineer', d('2026-10-02'), 'Prüfstand KG', '', '', ''],
  'blank',
  ['Summe', '5'],
]
const archiveSheet = [
  ['Firma', 'Position', 'Datum', 'Status'],
  ['Altbau GmbH', 'Werkstudent:in', d('2025-03-10'), 'Absage'],
  ['Vorjahr AG', 'Praktikum', d('2025-05-22'), 'Absage'],
]

// 03 – englisch: Spaltennamen, Statuswerte und US-Datumsformate
const englishSheet = [
  [
    'Company',
    'Job Title',
    'Date Applied',
    'Status',
    'Last Follow-up',
    'Interview',
    'Contact',
    'Email',
    'Phone',
    'Notes',
  ],
  [
    'Northwind Traders',
    'Software Engineer',
    d('2026-09-15', 'usdate'),
    'Applied',
    'September 29, 2026',
    empty,
    'Jane Miller',
    'jobs@northwind.example',
    '+1 206 555 0100',
    'Referral by a friend',
  ],
  [
    'Contoso Ltd.',
    'Frontend Developer',
    '10/23/2026',
    'Interview scheduled',
    '',
    d('2026-11-04T14:30:00', 'datetime'),
    'Tom Becker',
    'mailto:hr@contoso.example',
    '+44 20 7946 0000',
    'Video call',
  ],
  [
    'Fabrikam Inc.',
    'Data Engineer',
    '09/02/2026',
    'Rejected',
    'Sep 16, 2026',
    empty,
    'HR Team',
    'Fabrikam HR <careers@fabrikam.example>',
    '',
    '',
  ],
  [
    'Tailspin Toys',
    'Product Owner',
    '08/27/2026',
    'Offer',
    '',
    empty,
    'Sam Lee',
    'sam.lee@tailspin.example',
    '+1 425 555 0199',
    'Start in January',
  ],
  [
    'Adventure Works',
    'QA Analyst',
    '10/05/2026',
    'Pending',
    '',
    empty,
    '',
    '',
    '',
    'Applied via job board',
  ],
]

// 04 – nicht erkannte Felder und Werte, Komma-getrennt, Windows-1252
const unknownFields = [
  [
    'Unternehmen',
    'Position',
    'Beworben am',
    'Gehaltsvorstellung',
    'Quelle',
    'Status',
    'E-Mail',
    'Bewerbungsweg',
    'Melden nach',
  ],
  [
    'Müller & Söhne GmbH',
    'Buchhalter:in',
    '01.10.2026',
    '48.000 €',
    'StepStone',
    'wartet auf Rückmeldung',
    'personal@mueller.example',
    'Online-Formular',
    '3 Wochen',
  ],
  [
    'Bäckerei Groß',
    'Filialleitung',
    '07.10.2026',
    '42.000 €',
    'Zeitung',
    'keine Ahnung',
    'kein Kontakt',
    'Post',
    '20',
  ],
  [
    'Straßenbau Süd',
    'Bauleiter:in',
    '12.10.2026',
    '',
    'Empfehlung',
    'Absage per Mail',
    'info@strassenbau.example',
    'E-Mail',
    'bald',
  ],
]

// 05 – fehlende Pflichtwerte und Duplikate
const missingSheet = [
  GERMAN_HEADER,
  ['', 'Lagerist:in', '05.10.2026', 'Beworben', '', '', '', '', '', '', 'Unternehmen fehlt'],
  ['Ohne Stelle GmbH', '', '06.10.2026', 'Beworben', '', '', '', '', '', '', 'Position fehlt'],
  ['Ohne Datum AG', 'Kaufmann/-frau', '', 'Beworben', '', '', '', '', '', '', 'Datum fehlt'],
  [
    'Falsches Datum KG',
    'Assistenz',
    '31.02.2026',
    'Beworben',
    '',
    '',
    '',
    '',
    '',
    '',
    'Datum ungültig',
  ],
  ['Doppelt GmbH', 'Entwickler:in', '08.10.2026', 'Beworben', '', '', '', '', '', '', 'Original'],
  ['doppelt gmbh', 'Entwickler:in', '08.10.2026', 'Beworben', '', '', '', '', '', '', 'Duplikat'],
  [
    'Nordlicht Software GmbH',
    'Frontend-Entwickler:in',
    '02.09.2026',
    'Beworben',
    '',
    '',
    '',
    '',
    '',
    '',
    'Duplikat aus 01-sauber.csv',
  ],
  ['Alles gut GmbH', 'Teamleitung', '09.10.2026', 'Beworben', '', '', '', '', '', '', 'Gültig'],
]

// 06 – ohne Kopfzeile, Tab-getrennt
const headerless = [
  [
    'Seeblick Hotels',
    'Rezeption',
    '14.10.2026',
    'rezeption@seeblick.example',
    '+49 381 556677',
    'Beworben',
  ],
  ['Wolkig IT', 'Cloud Engineer', '16.10.2026', 'jobs@wolkig.example', '+49 351 443322', 'Termin'],
  ['Gartenbau Grün', 'Gärtner:in', '20.10.2026', 'info@gruen.example', '+49 761 998811', 'Absage'],
]

// 07 – mehrdeutige Datumswerte (03/04/2026 = 3. April oder 4. März?)
const ambiguous = [
  ['Firma', 'Position', 'Datum'],
  ['Alpha GmbH', 'Entwickler:in', '03/04/2026'],
  ['Beta AG', 'Tester:in', '05/06/2026'],
  ['Gamma KG', 'Designer:in', '07/08/2026'],
]

console.log(`Schreibe Beispieldateien nach ${OUT}`)
await writeFile(join(OUT, '01-sauber.csv'), `\uFEFF${csv(clean)}\r\n`, 'utf8')
console.log('  01-sauber.csv')
await convert(
  fods([tableXml('Bewerbungen 2026', unsortedSheet), tableXml('Archiv 2025', archiveSheet)]),
  '02-unsortiert',
  ['ods', 'xlsx'],
)
await convert(fods([tableXml('Applications', englishSheet)]), '03-englisch', ['xlsx', 'ods'])
await writeFile(
  join(OUT, '04-unbekannte-felder.csv'),
  toWindows1252(`${csv(unknownFields, ',')}\r\n`),
)
console.log('  04-unbekannte-felder.csv')
await convert(fods([tableXml('Bewerbungen', missingSheet)]), '05-fehlende-pflichtwerte', ['xlsx'])
await writeFile(join(OUT, '06-ohne-kopfzeile.csv'), `${csv(headerless, '\t')}\r\n`, 'utf8')
console.log('  06-ohne-kopfzeile.csv')
await writeFile(join(OUT, '07-mehrdeutige-daten.csv'), `${csv(ambiguous)}\r\n`, 'utf8')
console.log('  07-mehrdeutige-daten.csv')
