import { MAX_FOLLOW_UP_WEEKS, MIN_FOLLOW_UP_WEEKS, STAGE_LABELS } from '../../constants'
import { IMPORT_FIELD_LABELS, IMPORT_FIELDS } from './fields'

/** Dateiformate, die importiert und als Vorlage gespeichert werden können */
export const TEMPLATE_FORMATS = ['xlsx', 'ods', 'csv'] as const
export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number]

export const TEMPLATE_FORMAT_LABELS: Record<TemplateFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  ods: 'LibreOffice (.ods)',
  csv: 'CSV (.csv)',
}

export const TEMPLATE_SHEET_NAME = 'Bewerbungen'
export const TEMPLATE_HINT_SHEET_NAME = 'Hinweise'

/** Kopfzeile der Vorlage in Bewerbery-Reihenfolge */
export const TEMPLATE_HEADER: string[] = IMPORT_FIELDS.map((field) => IMPORT_FIELD_LABELS[field])

/** Beispielzeilen – müssen ohne Warnungen importierbar sein */
export const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    'Muster GmbH',
    'Frontend-Entwickler:in',
    '01.10.2026',
    STAGE_LABELS.applied,
    '15.10.2026',
    '2',
    '',
    'Frau Beispiel',
    'jobs@muster.example',
    '+49 30 1234567',
    'Über eine Jobbörse gefunden',
  ],
  [
    'Beispiel AG',
    'UX-Designer:in',
    '15.09.2026',
    STAGE_LABELS.interview,
    '',
    '',
    '20.10.2026 14:00',
    'Herr Muster',
    'personal@beispiel.example',
    '+49 89 7654321',
    'Remote möglich',
  ],
]

const STAGE_LIST = Object.values(STAGE_LABELS).join(', ')

/** Inhalt des Hinweis-Blatts (nur .xlsx/.ods; CSV kennt keine Blätter) */
export const TEMPLATE_HINT_ROWS: string[][] = [
  ['Spalte', 'Pflicht', 'Erlaubte Werte'],
  ['Unternehmen', 'ja', 'Freitext'],
  ['Position', 'ja', 'Freitext'],
  ['Beworben am', 'ja', 'Datum, z. B. 01.10.2026'],
  ['Status', 'nein', `${STAGE_LIST} (leer = ${STAGE_LABELS.applied})`],
  ['Letzte Nachfrage', 'nein', 'Datum, z. B. 15.10.2026'],
  [
    'Melden nach (Wochen)',
    'nein',
    `Zahl von ${MIN_FOLLOW_UP_WEEKS} bis ${MAX_FOLLOW_UP_WEEKS} (leer = Standard aus den Einstellungen)`,
  ],
  ['Termin', 'nein', 'Datum mit Uhrzeit, z. B. 20.10.2026 14:00'],
  ['Ansprechpartner', 'nein', 'Freitext'],
  ['E-Mail', 'nein', 'E-Mail-Adresse'],
  ['Telefon', 'nein', 'Telefonnummer'],
  ['Notizen', 'nein', 'Freitext'],
  [],
  ['Die Beispielzeilen im Blatt „Bewerbungen“ dürfen gelöscht oder überschrieben werden.'],
]

export interface TemplateSheet {
  name: string
  rows: string[][]
}

/** Blätter der Vorlage; CSV verwendet nur das erste */
export function templateSheets(): TemplateSheet[] {
  return [
    { name: TEMPLATE_SHEET_NAME, rows: [TEMPLATE_HEADER, ...TEMPLATE_EXAMPLE_ROWS] },
    { name: TEMPLATE_HINT_SHEET_NAME, rows: TEMPLATE_HINT_ROWS },
  ]
}
