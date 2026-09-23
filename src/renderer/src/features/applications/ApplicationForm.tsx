import { useState, type FormEvent } from 'react'
import { MAX_FOLLOW_UP_WEEKS, MIN_FOLLOW_UP_WEEKS } from '@shared/constants'
import { toIsoDate } from '@shared/domain/dates'
import { createId } from '@shared/domain/factory'
import { applicationInputSchema } from '@shared/schemas'
import type { Application, ApplicationDocument, ApplicationInput } from '@shared/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField, TextArea, TextField } from '../../components/ui/Field'
import { getApi } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'
import { DocumentList } from './DocumentList'

type FormValues = Required<Omit<ApplicationInput, 'followUpWeeks'>> & { followUpWeeks: string }
type FormErrors = Partial<Record<keyof FormValues, string>>

const WEEK_OPTIONS = Array.from(
  { length: MAX_FOLLOW_UP_WEEKS - MIN_FOLLOW_UP_WEEKS + 1 },
  (_, i) => i + MIN_FOLLOW_UP_WEEKS,
)

function initialValues(application?: Application): FormValues {
  return {
    company: application?.company ?? '',
    position: application?.position ?? '',
    contactName: application?.contactName ?? '',
    contactPhone: application?.contactPhone ?? '',
    contactEmail: application?.contactEmail ?? '',
    sentAt: application?.sentAt ?? toIsoDate(new Date()),
    followUpWeeks: application?.followUpWeeks ? String(application.followUpWeeks) : '',
    notes: application?.notes ?? '',
  }
}

export interface ApplicationFormProps {
  /** Vorhandene Bewerbung zum Bearbeiten – sonst wird eine neue angelegt */
  application?: Application
  onClose(): void
}

export function ApplicationForm({ application, onClose }: ApplicationFormProps) {
  const addApplication = useAppStore((s) => s.addApplication)
  const updateApplication = useAppStore((s) => s.updateApplication)
  const globalWeeks = useAppStore((s) => s.data.settings.followUpWeeks)

  // Neue Bewerbungen bekommen sofort eine ID, damit Dokumente schon zugeordnet werden können
  const [id] = useState(() => application?.id ?? createId())
  const [values, setValues] = useState(() => initialValues(application))
  const [errors, setErrors] = useState<FormErrors>({})
  const [documents, setDocuments] = useState<ApplicationDocument[]>(application?.documents ?? [])
  const [added, setAdded] = useState<ApplicationDocument[]>([])
  const [removed, setRemoved] = useState<ApplicationDocument[]>([])

  const set = (key: keyof FormValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  function cancel() {
    // Während des Bearbeitens hinzugefügte Dateien wieder entfernen
    const api = getApi()
    if (!application) {
      if (added.length) void api.removeAllDocuments(id).catch(() => undefined)
    } else {
      added.forEach((doc) => void api.removeDocument(id, doc).catch(() => undefined))
    }
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const input: ApplicationInput = {
      ...values,
      followUpWeeks: values.followUpWeeks ? Number(values.followUpWeeks) : null,
    }
    const result = applicationInputSchema.safeParse(input)
    if (!result.success) {
      const next: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormValues
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }

    if (application) updateApplication(id, result.data, documents)
    else addApplication(result.data, id, documents)

    const api = getApi()
    removed.forEach((doc) => void api.removeDocument(id, doc).catch(() => undefined))
    onClose()
  }

  return (
    <Dialog
      open
      size="lg"
      title={application ? 'Bewerbung bearbeiten' : 'Neue Bewerbung'}
      onClose={cancel}
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" form="application-form">
            {application ? 'Speichern' : 'Bewerbung anlegen (+10 XP)'}
          </Button>
        </>
      }
    >
      <form
        id="application-form"
        noValidate
        onSubmit={submit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label="Unternehmen *"
          value={values.company}
          onChange={set('company')}
          error={errors.company}
          placeholder="z. B. Muster GmbH"
        />
        <TextField
          label="Position"
          value={values.position}
          onChange={set('position')}
          placeholder="z. B. Frontend-Entwickler:in"
        />
        <TextField
          label="Ansprechpartner"
          value={values.contactName}
          onChange={set('contactName')}
          placeholder="Name"
        />
        <TextField
          label="Telefon"
          type="tel"
          value={values.contactPhone}
          onChange={set('contactPhone')}
          placeholder="+49 …"
        />
        <TextField
          label="E-Mail"
          type="email"
          value={values.contactEmail}
          onChange={set('contactEmail')}
          error={errors.contactEmail}
          placeholder="name@firma.de"
        />
        <TextField
          label="Abgeschickt am *"
          type="date"
          value={values.sentAt}
          onChange={set('sentAt')}
          error={errors.sentAt}
        />
        <SelectField
          label="Melden nach"
          value={values.followUpWeeks}
          onChange={set('followUpWeeks')}
          hint="Überschreibt die Standard-Frist nur für diese Bewerbung."
          className="sm:col-span-2"
        >
          <option value="">
            Standard ({globalWeeks} {globalWeeks === 1 ? 'Woche' : 'Wochen'})
          </option>
          {WEEK_OPTIONS.map((weeks) => (
            <option key={weeks} value={weeks}>
              {weeks} {weeks === 1 ? 'Woche' : 'Wochen'}
            </option>
          ))}
        </SelectField>
        <div className="sm:col-span-2">
          <DocumentList
            applicationId={id}
            documents={documents}
            onAdd={(docs) => {
              setDocuments((current) => [...current, ...docs])
              setAdded((current) => [...current, ...docs])
            }}
            onRemove={(doc) => {
              setDocuments((current) => current.filter((d) => d.id !== doc.id))
              setRemoved((current) => [...current, doc])
            }}
          />
        </div>
        <TextArea
          label="Notizen"
          value={values.notes}
          onChange={set('notes')}
          className="sm:col-span-2"
          placeholder="Gehaltsvorstellung, Eindrücke, nächste Schritte …"
        />
      </form>
    </Dialog>
  )
}
