import { useState } from 'react'
import { STAGE_LABELS } from '@shared/constants'
import type { Application, Stage } from '@shared/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { TextField } from '../../components/ui/Field'
import { useAppStore } from '../../stores/appStore'

const STAGES = Object.keys(STAGE_LABELS) as Stage[]

/** Status-Auswahl; beim Wechsel auf „Termin“ wird nach Datum/Uhrzeit gefragt */
export function StageControl({ application }: { application: Application }) {
  const setStage = useAppStore((s) => s.setStage)
  const [askAppointment, setAskAppointment] = useState(false)
  const [appointment, setAppointment] = useState(application.appointmentAt ?? '')

  function onChange(stage: Stage) {
    if (stage === 'interview') setAskAppointment(true)
    else setStage(application.id, stage)
  }

  function confirmAppointment() {
    setStage(application.id, 'interview', appointment || null)
    setAskAppointment(false)
  }

  return (
    <>
      <select
        aria-label={`Status von ${application.company}`}
        value={application.stage}
        onChange={(event) => onChange(event.target.value as Stage)}
        className="h-8 rounded-lg border border-line bg-bg px-2 text-xs font-medium text-fg"
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABELS[stage]}
          </option>
        ))}
      </select>

      <Dialog
        open={askAppointment}
        title="Termin eintragen 🎤"
        onClose={() => setAskAppointment(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskAppointment(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={confirmAppointment}>
              Termin speichern
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">
          Glückwunsch zur Einladung bei <strong className="text-fg">{application.company}</strong>!
          Wann ist der Termin?
        </p>
        <TextField
          label="Datum & Uhrzeit"
          type="datetime-local"
          value={appointment}
          onChange={(event) => setAppointment(event.target.value)}
          hint="Optional – kann später ergänzt werden."
        />
      </Dialog>
    </>
  )
}
