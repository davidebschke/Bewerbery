/**
 * Fachliche Fehler des KI-Assistenten und der CV-Optimierung.
 * Über IPC werden nur die Codes übertragen; die deutschen Texte liegen hier zentral.
 */
export const AI_ERROR_CODES = [
  'no-key',
  'encryption-unavailable',
  'invalid-key',
  'network',
  'rate-limit',
  'too-long',
  'bad-response',
  'refused',
  'server',
  'canceled',
  'busy',
  'no-source',
  'unsupported-file',
  'pdf-not-supported',
  'file-too-large',
  'unreadable-file',
  'tracked-changes',
  'no-text',
  'save-failed',
] as const

export type AiErrorCode = (typeof AI_ERROR_CODES)[number]

export interface AiErrorMessage {
  title: string
  hint: string
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, AiErrorMessage> = {
  'no-key': {
    title: 'Kein API-Key hinterlegt',
    hint: 'Hinterlege deinen Anthropic-API-Key in den Einstellungen unter „KI-Assistent“.',
  },
  'encryption-unavailable': {
    title: 'Sichere Speicherung nicht verfügbar',
    hint: 'Dein System bietet keine Verschlüsselung für den Key an. Er wird deshalb nicht gespeichert.',
  },
  'invalid-key': {
    title: 'Der API-Key ist ungültig',
    hint: 'Prüfe den Key in der Anthropic-Konsole und hinterlege ihn erneut.',
  },
  network: {
    title: 'Keine Verbindung',
    hint: 'Prüfe deine Internetverbindung und versuche es erneut.',
  },
  'rate-limit': {
    title: 'Zu viele Anfragen',
    hint: 'Das Anfragelimit deines Anthropic-Kontos ist erreicht. Warte kurz und versuche es erneut.',
  },
  'too-long': {
    title: 'Text ist zu lang',
    hint: 'Kürze den Lebenslauf oder die Stellenanzeige und versuche es erneut.',
  },
  'bad-response': {
    title: 'Antwort konnte nicht verarbeitet werden',
    hint: 'Die KI hat keine verwertbare Antwort geliefert. Versuche es erneut.',
  },
  refused: {
    title: 'Anfrage wurde abgelehnt',
    hint: 'Die KI hat die Anfrage aus Sicherheitsgründen nicht bearbeitet. Prüfe die Inhalte.',
  },
  server: {
    title: 'Fehler beim KI-Anbieter',
    hint: 'Der Dienst ist gerade nicht erreichbar. Versuche es in ein paar Minuten erneut.',
  },
  canceled: {
    title: 'Abgebrochen',
    hint: 'Die Optimierung wurde abgebrochen.',
  },
  busy: {
    title: 'Optimierung läuft bereits',
    hint: 'Warte, bis die laufende Optimierung fertig ist, oder brich sie ab.',
  },
  'no-source': {
    title: 'Kein Lebenslauf gewählt',
    hint: 'Wähle zuerst deinen Lebenslauf als Word- (.docx) oder LibreOffice-Datei (.odt).',
  },
  'unsupported-file': {
    title: 'Dateiformat wird nicht unterstützt',
    hint: 'Wähle deinen Lebenslauf als Word- (.docx) oder LibreOffice-Datei (.odt).',
  },
  'pdf-not-supported': {
    title: 'PDF kann nicht mit Design bearbeitet werden',
    hint: 'Wähle die Word-Datei deines Lebenslaufs oder öffne die PDF in Word und speichere sie als .docx.',
  },
  'file-too-large': {
    title: 'Datei ist zu groß',
    hint: 'Der Lebenslauf darf höchstens 10 MB groß sein.',
  },
  'unreadable-file': {
    title: 'Datei konnte nicht gelesen werden',
    hint: 'Die Datei ist beschädigt oder passwortgeschützt. Speichere sie in Word ohne Kennwort neu.',
  },
  'tracked-changes': {
    title: 'Dokument enthält nachverfolgte Änderungen',
    hint: 'Nimm in Word alle Änderungen an oder lehne sie ab („Überprüfen“) und speichere die Datei.',
  },
  'no-text': {
    title: 'Kein Text gefunden',
    hint: 'Die Datei enthält keinen bearbeitbaren Text, z. B. weil der Lebenslauf nur als Bild eingefügt ist.',
  },
  'save-failed': {
    title: 'Datei konnte nicht gespeichert werden',
    hint: 'Ist die Datei noch in Word geöffnet oder der Ordner schreibgeschützt? Schließe sie und versuche es erneut.',
  },
}

/** Ergebnis eines KI-Aufrufs – Fehler kommen als Code statt als Exception über IPC */
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }

export function ok<T>(value: T): AiResult<T> {
  return { ok: true, value }
}

export function fail<T = never>(error: AiErrorCode): AiResult<T> {
  return { ok: false, error }
}

export function isAiErrorCode(value: unknown): value is AiErrorCode {
  return typeof value === 'string' && (AI_ERROR_CODES as readonly string[]).includes(value)
}
