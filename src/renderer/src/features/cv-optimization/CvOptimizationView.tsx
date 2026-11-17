import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { AI_ERROR_MESSAGES } from '@shared/domain/cv/aiErrors'
import { variantText } from '@shared/domain/cv/rewrite'
import type { VariantStyle } from '@shared/domain/cv/styles'
import { Button } from '../../components/ui/Button'
import { getApi } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'
import { ComparisonView } from './ComparisonView'
import { ConsentDialog } from './ConsentDialog'
import { CvInputPanel } from './CvInputPanel'
import { useCvOptimization } from './useCvOptimization'

export interface CvOptimizationViewProps {
  /** Ist der Einstellungsdialog offen? Nach dem Schließen wird der Key-Status neu geladen. */
  settingsOpen: boolean
  onOpenSettings(): void
}

/** Eigene Ansicht „CV-Optimierung“ */
export function CvOptimizationView({ settingsOpen, onOpenSettings }: CvOptimizationViewProps) {
  const state = useCvOptimization()
  const applications = useAppStore((s) => s.data.applications)
  const attachDocument = useAppStore((s) => s.attachDocument)
  const pushToast = useAppStore((s) => s.pushToast)
  const [busy, setBusy] = useState<VariantStyle | null>(null)
  const settingsWereOpen = useRef(settingsOpen)
  const { refreshKey, result } = state

  useEffect(() => {
    if (settingsWereOpen.current && !settingsOpen) void refreshKey()
    settingsWereOpen.current = settingsOpen
  }, [settingsOpen, refreshKey])

  const canAttach = Boolean(
    result?.applicationId && applications.some((app) => app.id === result.applicationId),
  )

  async function save(style: VariantStyle) {
    setBusy(style)
    try {
      const outcome = await getApi().saveCvVariant(style)
      if (!outcome.ok) pushToast('error', AI_ERROR_MESSAGES[outcome.error].title)
      else if (!outcome.value.canceled) pushToast('info', 'Variante gespeichert.')
    } catch {
      pushToast('error', AI_ERROR_MESSAGES['save-failed'].title)
    } finally {
      setBusy(null)
    }
  }

  async function attach(style: VariantStyle) {
    if (!result?.applicationId) return
    setBusy(style)
    try {
      const outcome = await getApi().attachCvVariant(style, result.applicationId)
      if (outcome.ok) {
        attachDocument(result.applicationId, outcome.value)
        pushToast('info', 'Variante an der Bewerbung gespeichert.')
      } else {
        pushToast('error', AI_ERROR_MESSAGES[outcome.error].title)
      }
    } catch {
      pushToast('error', AI_ERROR_MESSAGES['save-failed'].title)
    } finally {
      setBusy(null)
    }
  }

  async function copy(style: VariantStyle) {
    const variant = result?.variants.find((candidate) => candidate.style === style)
    if (!result || !variant) return
    try {
      await navigator.clipboard.writeText(variantText(result.source, variant.rewrites))
      pushToast('info', 'Text in die Zwischenablage kopiert.')
    } catch {
      pushToast('error', 'Text konnte nicht kopiert werden.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <Sparkles size={20} className="text-brand" aria-hidden="true" /> CV-Optimierung
          </h2>
          <p className="text-sm text-muted">
            Drei Varianten deines Lebenslaufs – zugeschnitten auf die Stelle, im Design deiner
            Datei.
          </p>
        </div>
        {state.phase === 'result' && (
          <Button onClick={state.backToInput}>
            <ArrowLeft size={16} aria-hidden="true" /> Neue Optimierung
          </Button>
        )}
      </div>

      {(state.phase === 'input' || state.phase === 'consent') && (
        <CvInputPanel state={state} onOpenSettings={onOpenSettings} />
      )}

      {state.phase === 'running' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center"
        >
          <Loader2 size={32} className="text-brand motion-safe:animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">Varianten werden erstellt und bewertet …</p>
            <p className="text-sm text-muted">Das dauert meist unter einer Minute.</p>
          </div>
          <Button variant="ghost" onClick={state.cancel}>
            Abbrechen
          </Button>
        </div>
      )}

      {state.phase === 'error' && state.error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-due/40 bg-due/10 p-5"
        >
          <div>
            <p className="font-semibold text-due">{AI_ERROR_MESSAGES[state.error].title}</p>
            <p className="text-sm">{AI_ERROR_MESSAGES[state.error].hint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={state.retry}>
              <RotateCcw size={16} aria-hidden="true" /> Erneut versuchen
            </Button>
            <Button onClick={state.backToInput}>Zurück zur Eingabe</Button>
            {(state.error === 'invalid-key' || state.error === 'no-key') && (
              <Button variant="ghost" onClick={onOpenSettings}>
                Zu den Einstellungen
              </Button>
            )}
          </div>
        </div>
      )}

      {state.phase === 'result' && result && (
        <ComparisonView
          result={result}
          canAttach={canAttach}
          busy={busy}
          onSave={(style) => void save(style)}
          onAttach={(style) => void attach(style)}
          onCopy={(style) => void copy(style)}
        />
      )}

      <ConsentDialog
        open={state.phase === 'consent'}
        onConfirm={state.confirmConsent}
        onCancel={state.declineConsent}
      />
    </div>
  )
}
