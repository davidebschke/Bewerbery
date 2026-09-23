export const DATA_VERSION = 1
export const DATA_FILE_NAME = 'bewerbery-data.json'
export const DOCUMENTS_DIR_NAME = 'documents'

export const DEFAULT_FOLLOW_UP_WEEKS = 2
export const MIN_FOLLOW_UP_WEEKS = 1
export const MAX_FOLLOW_UP_WEEKS = 12

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
