import { ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'

export interface ConsentDialogProps {
  open: boolean
  onConfirm(): void
  onCancel(): void
}

/** Datenschutzhinweis vor dem ersten Senden an Anthropic (Constitution I, Opt-in) */
export function ConsentDialog({ open, onConfirm, onCancel }: ConsentDialogProps) {
  return (
    <Dialog
      open={open}
      title="Daten werden an Anthropic gesendet"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Zustimmen und senden
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            Für die Optimierung werden der <strong>Text deines Lebenslaufs</strong> und die{' '}
            <strong>Stellenanzeige</strong> mit deinem API-Key an Anthropic (Claude) übertragen.
          </span>
        </p>
        <ul className="list-disc space-y-1 pl-6 text-muted">
          <li>Gesendet wird nur, wenn du „Optimieren“ klickst – nie im Hintergrund.</li>
          <li>Deine Datei, Bilder und das Layout bleiben auf diesem Rechner.</li>
          <li>
            Die Anfragen laufen über dein eigenes Anthropic-Konto und können Kosten verursachen.
          </li>
        </ul>
        <p className="text-xs text-muted">
          Deine Zustimmung wird gespeichert und kann in den Einstellungen unter „KI-Assistent“
          widerrufen werden.
        </p>
      </div>
    </Dialog>
  )
}
