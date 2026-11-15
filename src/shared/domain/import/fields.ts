import { looksLikePhone, normalizeKey, parseDate, parseEmail, parseStage } from './values'

/** Felder einer Bewerbung, die aus einer Tabelle übernommen werden können */
export const IMPORT_FIELDS = [
  'company',
  'position',
  'sentAt',
  'stage',
  'lastFollowUpAt',
  'followUpWeeks',
  'appointmentAt',
  'contactName',
  'contactEmail',
  'contactPhone',
  'notes',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Ziel einer Spalte: ein Feld, „als Text in die Notizen“ oder ignorieren */
export type ColumnTarget = ImportField | 'appendNotes' | 'ignore'

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  company: 'Unternehmen',
  position: 'Position',
  sentAt: 'Beworben am',
  stage: 'Status',
  lastFollowUpAt: 'Letzte Nachfrage',
  followUpWeeks: 'Melden nach (Wochen)',
  appointmentAt: 'Termin',
  contactName: 'Ansprechpartner',
  contactEmail: 'E-Mail',
  contactPhone: 'Telefon',
  notes: 'Notizen',
}

export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ['company', 'position', 'sentAt']

/** Spaltennamen (deutsch und englisch), bereits mit `normalizeKey` vereinheitlicht */
const SYNONYMS: Record<ImportField, string[]> = {
  company: [
    'unternehmen',
    'firma',
    'firmenname',
    'arbeitgeber',
    'betrieb',
    'company',
    'companyname',
    'employer',
    'organisation',
    'organization',
  ],
  position: [
    'position',
    'stelle',
    'stellenbezeichnung',
    'stellentitel',
    'job',
    'jobtitel',
    'jobtitle',
    'titel',
    'title',
    'rolle',
    'role',
    'beruf',
  ],
  sentAt: [
    'beworbenam',
    'beworben',
    'bewerbungsdatum',
    'datum',
    'gesendet',
    'gesendetam',
    'abgeschickt',
    'abgeschicktam',
    'versendet',
    'applied',
    'appliedon',
    'applicationdate',
    'dateapplied',
    'date',
    'sent',
    'senton',
    'submitted',
  ],
  stage: ['status', 'stand', 'phase', 'stage', 'state', 'ergebnis', 'result', 'antwort'],
  lastFollowUpAt: [
    'letztenachfrage',
    'nachgefragt',
    'nachgefragtam',
    'nachfrage',
    'nachgefasst',
    'letzterkontakt',
    'followup',
    'followedup',
    'lastfollowup',
    'lastcontact',
  ],
  followUpWeeks: [
    'meldennach',
    'meldennachwochen',
    'erinnerung',
    'erinnerungwochen',
    'frist',
    'fristwochen',
    'wochen',
    'reminder',
    'reminderweeks',
    'followupweeks',
    'weeks',
  ],
  appointmentAt: [
    'termin',
    'gespraechstermin',
    'gespraech',
    'vorstellungsgespraech',
    'interviewtermin',
    'interview',
    'interviewdate',
    'appointment',
  ],
  contactName: [
    'ansprechpartner',
    'ansprechpartnerin',
    'kontakt',
    'kontaktperson',
    'name',
    'contact',
    'contactname',
    'contactperson',
    'recruiter',
    'personaler',
    'hiringmanager',
  ],
  contactEmail: ['email', 'mail', 'emailadresse', 'kontaktemail', 'contactemail', 'emailaddress'],
  contactPhone: [
    'telefon',
    'tel',
    'telefonnummer',
    'handy',
    'mobil',
    'mobile',
    'phone',
    'phonenumber',
    'kontakttelefon',
  ],
  notes: [
    'notizen',
    'notiz',
    'bemerkung',
    'bemerkungen',
    'kommentar',
    'kommentare',
    'anmerkung',
    'anmerkungen',
    'notes',
    'note',
    'comment',
    'comments',
    'remarks',
  ],
}

/** Felder, die mehreren Spalten zugeordnet werden dürfen (Inhalte werden zusammengeführt) */
const MULTI_FIELDS: readonly ImportField[] = ['notes']

interface HeaderMatch {
  field: ImportField
  exact: boolean
  /** Länge des passenden Synonyms – längere Treffer sind spezifischer */
  strength: number
}

/** Erkennt das Feld anhand eines Spaltennamens; `null` = nicht erkannt */
export function matchHeader(header: string): HeaderMatch | null {
  const key = normalizeKey(header)
  if (!key) return null
  for (const field of IMPORT_FIELDS) {
    if (SYNONYMS[field].includes(key)) return { field, exact: true, strength: key.length }
  }
  // Teiltreffer, z. B. „Name des Unternehmens“ oder „E-Mail Ansprechpartner“.
  // Kontaktwege schlagen den Namen: „Telefon Ansprechpartner“ ist eine Telefonnummer.
  let best: HeaderMatch | null = null
  for (const field of IMPORT_FIELDS) {
    const bonus = field === 'contactEmail' || field === 'contactPhone' ? 100 : 0
    for (const synonym of SYNONYMS[field]) {
      if (synonym.length >= 4 && key.includes(synonym)) {
        const strength = synonym.length + bonus
        if (!best || strength > best.strength) best = { field, exact: false, strength }
      }
    }
  }
  return best
}

/**
 * Sucht in den ersten Zeilen die Kopfzeile – die Zeile mit den meisten erkannten Spaltennamen.
 * `null`, wenn keine Zeile mindestens zwei erkannte Spalten hat.
 */
export function detectHeaderRow(rows: string[][], scanLimit = 20): number | null {
  let bestIndex: number | null = null
  let bestCount = 1
  rows.slice(0, scanLimit).forEach((row, index) => {
    const fields = new Set(
      row.map((cell) => matchHeader(cell)?.field).filter((field) => field !== undefined),
    )
    if (fields.size > bestCount) {
      bestIndex = index
      bestCount = fields.size
    }
  })
  return bestIndex
}

/** Spaltenbuchstabe wie in Tabellenprogrammen (0 → A, 26 → AA) */
export function columnLetter(index: number): string {
  let letter = ''
  let n = index + 1
  while (n > 0) {
    const rest = (n - 1) % 26
    letter = String.fromCharCode(65 + rest) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

/** Anzeigename einer Spalte: Kopfzeilen-Text oder „Spalte C“ */
export function columnLabel(header: string[] | null, index: number): string {
  const text = header?.[index]?.trim()
  return text || `Spalte ${columnLetter(index)}`
}

function share(values: string[], test: (value: string) => boolean): number {
  return values.length ? values.filter(test).length / values.length : 0
}

/** Rät das Feld einer Spalte anhand ihrer Werte (E-Mail, Datum, Status, Telefon) */
function guessFromContent(values: string[], taken: Set<ImportField>): ImportField | null {
  const candidates: [ImportField, (value: string) => boolean][] = [
    ['contactEmail', (value) => !!parseEmail(value)],
    ['sentAt', (value) => parseDate(value) !== null],
    ['lastFollowUpAt', (value) => parseDate(value) !== null],
    ['stage', (value) => parseStage(value) !== null],
    ['contactPhone', looksLikePhone],
  ]
  for (const [field, test] of candidates) {
    if (!taken.has(field) && share(values, test) >= 0.6) return field
  }
  return null
}

/**
 * Ordnet jeder Spalte ein Ziel zu: zuerst exakte, dann ungefähre Spaltennamen, danach
 * inhaltsbasiert. Nicht erkannte Spalten mit Inhalt landen in den Notizen.
 */
export function matchColumns(header: string[] | null, dataRows: string[][]): ColumnTarget[] {
  const columnCount = Math.max(header?.length ?? 0, ...dataRows.map((row) => row.length), 0)
  const targets: ColumnTarget[] = Array.from({ length: columnCount }, () => 'ignore')
  const assigned = new Array<boolean>(columnCount).fill(false)
  const taken = new Set<ImportField>()

  const assign = (index: number, field: ImportField) => {
    targets[index] = field
    assigned[index] = true
    if (!MULTI_FIELDS.includes(field)) taken.add(field)
  }

  const matches = Array.from({ length: columnCount }, (_, index) =>
    header ? matchHeader(header[index] ?? '') : null,
  )
  for (const exact of [true, false]) {
    // Spezifischere Treffer zuerst, damit z. B. „Firmenname“ vor „Name“ zum Zug kommt
    const order = matches
      .map((match, index) => ({ match, index }))
      .filter(({ match }) => match && match.exact === exact)
      .sort((a, b) => b.match!.strength - a.match!.strength)
    for (const { match, index } of order) {
      if (!assigned[index] && !taken.has(match!.field)) assign(index, match!.field)
    }
  }

  for (let index = 0; index < columnCount; index++) {
    if (assigned[index]) continue
    const values = dataRows.map((row) => (row[index] ?? '').trim()).filter(Boolean)
    if (!values.length) continue
    const guess = guessFromContent(values, taken)
    if (guess) assign(index, guess)
    else targets[index] = 'appendNotes'
  }
  return targets
}
