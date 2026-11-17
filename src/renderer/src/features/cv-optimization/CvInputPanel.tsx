import { useState, type DragEvent } from 'react'
import { FileText, KeyRound, Sparkles, Upload } from 'lucide-react'
import { MAX_JOB_DESCRIPTION_CHARS } from '@shared/constants'
import { AI_ERROR_MESSAGES } from '@shared/domain/cv/aiErrors'
import { jobDescriptionMessage } from '@shared/domain/cv/limits'
import { paragraphText } from '@shared/domain/cv/rewrite'
import { Button } from '../../components/ui/Button'
import { SelectField, TextArea } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../stores/appStore'
import type { CvOptimizationState } from './useCvOptimization'

export interface CvInputPanelProps {
  state: CvOptimizationState
  onOpenSettings(): void
}

/** Eingabe der CV-Optimierung: Lebenslauf, Bewerbung/Stellenanzeige und Start */
export function CvInputPanel({ state, onOpenSettings }: CvInputPanelProps) {
  const setJobDescription = useAppStore((s) => s.setJobDescription)
  const pushToast = useAppStore((s) => s.pushToast)
  const [dragging, setDragging] = useState(false)
  const { source, sourceError, application, jobCheck } = state

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void state.dropFile(file)
  }

  const counter = `${jobCheck.length.toLocaleString('de-DE')} / ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString('de-DE')} Zeichen`
  const jobError = jobCheck.length > 0 ? jobDescriptionMessage(jobCheck) : null
  const canSaveToApplication =
    application !== null &&
    jobCheck.ok &&
    state.jobDescription.trim() !== application.jobDescription.trim()

  function saveToApplication() {
    if (!application) return
    setJobDescription(application.id, state.jobDescription.trim())
    pushToast('info', 'Stellenanzeige in der Bewerbung gespeichert.')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="cv-source-heading" className="flex flex-col gap-3">
        <h2 id="cv-source-heading" className="font-display text-base font-semibold">
          1. Lebenslauf
        </h2>
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="cv-dropzone"
          className={cn(
            'flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-brand bg-brand/5' : 'border-line',
          )}
        >
          <Upload size={24} className="text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">
            Word- (.docx) oder LibreOffice-Datei (.odt) hierher ziehen. Das Design deiner Datei
            bleibt in allen Varianten erhalten.
          </p>
          <Button onClick={() => void state.pickFile()} disabled={state.loadingSource}>
            <FileText size={16} aria-hidden="true" />
            {state.loadingSource
              ? 'Wird gelesen …'
              : source
                ? 'Andere Datei wählen'
                : 'Lebenslauf wählen'}
          </Button>
        </div>

        {sourceError && (
          <div role="alert" className="rounded-xl border border-due/40 bg-due/10 p-3 text-sm">
            <p className="font-semibold text-due">{AI_ERROR_MESSAGES[sourceError].title}</p>
            <p className="text-muted">{AI_ERROR_MESSAGES[sourceError].hint}</p>
          </div>
        )}

        {source && (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              <span className="font-semibold">{source.fileName}</span>{' '}
              <span className="text-muted">
                · {source.format.toUpperCase()} · {source.paragraphs.length} Absätze
              </span>
            </p>
            <div
              aria-label="Vorschau des Lebenslaufs"
              tabIndex={0}
              className="max-h-80 overflow-y-auto rounded-xl border border-line bg-surface p-3 text-sm"
            >
              {source.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.id}
                  className={cn('whitespace-pre-wrap', !paragraph.editable && 'text-muted')}
                >
                  {paragraphText(paragraph)}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="cv-job-heading" className="flex flex-col gap-3">
        <h2 id="cv-job-heading" className="font-display text-base font-semibold">
          2. Stellenanzeige
        </h2>
        <SelectField
          label="Bewerbung (optional)"
          value={state.applicationId ?? ''}
          onChange={(event) => state.selectApplication(event.target.value || null)}
          hint="Übernimmt die gespeicherte Stellenanzeige und ermöglicht das Speichern an der Bewerbung."
        >
          <option value="">Keine Bewerbung</option>
          {state.applications.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {[candidate.company, candidate.position].filter(Boolean).join(' – ')}
            </option>
          ))}
        </SelectField>
        <TextArea
          label="Text der Stellenanzeige"
          value={state.jobDescription}
          onChange={(event) => state.setJobDescription(event.target.value)}
          rows={10}
          error={jobError ?? undefined}
          hint={counter}
          placeholder="Aufgaben, Anforderungen, Benefits … aus der Ausschreibung einfügen"
        />
        {canSaveToApplication && (
          <Button size="sm" variant="ghost" className="self-start" onClick={saveToApplication}>
            In Bewerbung speichern
          </Button>
        )}
      </section>

      <div className="flex flex-col items-start gap-3 lg:col-span-2">
        {state.keyConfigured === false && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
            <KeyRound size={16} className="text-brand" aria-hidden="true" />
            <span>Hinterlege zuerst deinen Anthropic-API-Key, um die Optimierung zu nutzen.</span>
            <Button size="sm" onClick={onOpenSettings}>
              Zu den Einstellungen
            </Button>
          </div>
        )}
        <Button variant="primary" onClick={state.start} disabled={!state.canStart}>
          <Sparkles size={16} aria-hidden="true" /> Optimieren
        </Button>
      </div>
    </div>
  )
}
