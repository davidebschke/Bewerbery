/**
 * Lesbare Fehlermeldung aus einem IPC-Fehler. Electron stellt Meldungen aus dem Hauptprozess
 * „Error invoking remote method '…': Error: “ voran – das wird entfernt.
 */
export function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const cleaned = message.replace(/^Error invoking remote method '[^']*':\s*(?:\w*Error:\s*)?/, '')
  return cleaned.trim() || fallback
}
