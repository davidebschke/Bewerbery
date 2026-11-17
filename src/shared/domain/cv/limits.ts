import { MAX_JOB_DESCRIPTION_CHARS } from '../../constants'

export type JobDescriptionCheck =
  | { ok: true; length: number }
  | { ok: false; reason: 'empty'; length: 0 }
  | { ok: false; reason: 'too-long'; length: number; excess: number }

/** Prüft die Stellenanzeige vor dem Senden (getrimmt, 1–15 000 Zeichen) */
export function checkJobDescription(text: string): JobDescriptionCheck {
  const length = text.trim().length
  if (length === 0) return { ok: false, reason: 'empty', length: 0 }
  if (length > MAX_JOB_DESCRIPTION_CHARS) {
    return { ok: false, reason: 'too-long', length, excess: length - MAX_JOB_DESCRIPTION_CHARS }
  }
  return { ok: true, length }
}

/** Deutsche Meldung zur Prüfung oder `null`, wenn alles passt */
export function jobDescriptionMessage(check: JobDescriptionCheck): string | null {
  if (check.ok) return null
  if (check.reason === 'empty') return 'Füge die Stellenanzeige ein oder wähle eine Bewerbung.'
  return `Die Stellenanzeige ist ${check.excess.toLocaleString('de-DE')} Zeichen zu lang.`
}
