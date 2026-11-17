import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, KeyRound } from 'lucide-react'
import { AI_ERROR_MESSAGES, type AiErrorCode } from '@shared/domain/cv/aiErrors'
import { apiKeySchema, type AiKeyStatus } from '@shared/domain/cv/schemas'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { getApi } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../stores/appStore'

const CONSOLE_URL = 'https://console.anthropic.com/settings/keys'

type Feedback = { kind: 'ok' | 'error'; text: string } | null
type Busy = 'save' | 'test' | 'remove' | null

function errorText(code: AiErrorCode): string {
  const message = AI_ERROR_MESSAGES[code]
  return `${message.title}. ${message.hint}`
}

/** Einstellungen des KI-Assistenten: Anthropic-API-Key und Datenschutz-Zustimmung */
export function AiKeySection() {
  const consentAt = useAppStore((s) => s.data.settings.aiConsentAt)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [status, setStatus] = useState<AiKeyStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    let active = true
    void getApi()
      .getAiKeyStatus()
      .then((next) => active && setStatus(next))
      .catch(
        () => active && setFeedback({ kind: 'error', text: 'Status konnte nicht geladen werden.' }),
      )
    return () => {
      active = false
    }
  }, [])

  const encryptionAvailable = status?.encryptionAvailable ?? true

  async function save(event: FormEvent) {
    event.preventDefault()
    const parsed = apiKeySchema.safeParse(apiKey)
    if (!parsed.success) {
      setFeedback({ kind: 'error', text: parsed.error.issues[0].message })
      return
    }
    setBusy('save')
    try {
      const result = await getApi().setAiKey(parsed.data)
      if (result.ok) {
        setStatus(result.value)
        setApiKey('')
        setFeedback({ kind: 'ok', text: 'API-Key gespeichert.' })
      } else {
        setFeedback({ kind: 'error', text: errorText(result.error) })
      }
    } catch {
      setFeedback({ kind: 'error', text: 'API-Key konnte nicht gespeichert werden.' })
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    const entered = apiKey.trim()
    if (entered) {
      const parsed = apiKeySchema.safeParse(entered)
      if (!parsed.success) {
        setFeedback({ kind: 'error', text: parsed.error.issues[0].message })
        return
      }
    }
    setBusy('test')
    try {
      const result = await getApi().testAiKey(entered || undefined)
      setFeedback(
        result.ok
          ? { kind: 'ok', text: 'Verbindung erfolgreich – der API-Key ist gültig.' }
          : { kind: 'error', text: errorText(result.error) },
      )
    } catch {
      setFeedback({ kind: 'error', text: errorText('server') })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('remove')
    try {
      setStatus(await getApi().removeAiKey())
      setFeedback({ kind: 'ok', text: 'API-Key entfernt.' })
    } catch {
      setFeedback({ kind: 'error', text: 'API-Key konnte nicht entfernt werden.' })
    } finally {
      setBusy(null)
      setConfirmRemove(false)
    }
  }

  return (
    <section aria-labelledby="ai-heading" className="flex flex-col gap-3">
      <div>
        <h3 id="ai-heading" className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound size={16} aria-hidden="true" /> KI-Assistent
        </h3>
        <p className="text-xs text-muted">
          Für die CV-Optimierung nutzt Bewerbery deinen eigenen Anthropic-API-Key. Er wird
          verschlüsselt auf diesem Rechner gespeichert. Anfragen werden nur gesendet, wenn du sie
          ausdrücklich startest.
        </p>
      </div>

      <p className="text-sm" data-testid="ai-key-status">
        {status === null
          ? 'Status wird geladen …'
          : status.configured
            ? `Key hinterlegt (…${status.hint})`
            : 'Kein Key hinterlegt'}
      </p>

      {!encryptionAvailable && (
        <p className="rounded-xl border border-due/40 bg-due/10 p-3 text-xs text-due">
          {errorText('encryption-unavailable')}
        </p>
      )}

      <form onSubmit={save} className="flex flex-col gap-2">
        <TextField
          label={status?.configured ? 'Neuer API-Key' : 'API-Key'}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-ant-…"
          disabled={!encryptionAvailable}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!encryptionAvailable || !apiKey.trim() || busy !== null}
          >
            {busy === 'save' ? 'Speichert …' : 'Speichern'}
          </Button>
          <Button
            size="sm"
            onClick={() => void test()}
            disabled={(!apiKey.trim() && !status?.configured) || busy !== null}
          >
            {busy === 'test' ? 'Prüft …' : 'Verbindung prüfen'}
          </Button>
          {status?.configured && !confirmRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(true)}
              disabled={busy !== null}
            >
              Key entfernen
            </Button>
          )}
        </div>
      </form>

      {confirmRemove && (
        <div
          role="group"
          aria-label="Key entfernen bestätigen"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm"
        >
          <span>Key wirklich entfernen? Die CV-Optimierung ist danach deaktiviert.</span>
          <Button variant="danger" size="sm" onClick={() => void remove()}>
            Entfernen
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
            Abbrechen
          </Button>
        </div>
      )}

      <p
        role="status"
        aria-live="polite"
        className={cn('min-h-4 text-xs', feedback?.kind === 'error' ? 'text-due' : 'text-ok')}
      >
        {feedback?.text}
      </p>

      <a
        href={CONSOLE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs text-brand hover:underline"
      >
        API-Key in der Anthropic-Konsole erstellen <ExternalLink size={12} aria-hidden="true" />
      </a>

      {consentAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            Datenschutz-Zustimmung erteilt am {new Date(consentAt).toLocaleDateString('de-DE')}
          </span>
          <Button variant="ghost" size="sm" onClick={() => updateSettings({ aiConsentAt: null })}>
            Zustimmung widerrufen
          </Button>
        </div>
      )}
    </section>
  )
}
