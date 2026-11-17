export const DATA_VERSION = 1
export const DATA_FILE_NAME = 'bewerbery-data.json'
export const DOCUMENTS_DIR_NAME = 'documents'

export const DEFAULT_FOLLOW_UP_WEEKS = 2
export const MIN_FOLLOW_UP_WEEKS = 1
export const MAX_FOLLOW_UP_WEEKS = 12

/** Grenzen für den Tabellen-Import */
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5000
export const MAX_IMPORT_COLUMNS = 200

/** Maximale Länge der Stellenanzeige an einer Bewerbung (Zeichen) */
export const MAX_JOB_DESCRIPTION_CHARS = 15_000

/** Ab diesem Anteil der Frist gilt eine Bewerbung als „bald fällig“ */
export const SOON_THRESHOLD = 0.6

export const XP_REWARDS = {
  create: 10,
  followUp: 5,
  interview: 25,
  offer: 100,
  rejected: 5,
} as const

export const STAGE_LABELS = {
  applied: 'Beworben',
  interview: 'Termin',
  offer: 'Angebot',
  rejected: 'Absage',
} as const
