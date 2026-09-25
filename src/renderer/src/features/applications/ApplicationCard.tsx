import { useState } from 'react'
import { motion } from 'motion/react'
import {
  CalendarClock,
  Check,
  FileText,
  Mail,
  Pencil,
  Phone,
  Pin,
  Trash2,
  User,
} from 'lucide-react'
import { STAGE_LABELS } from '@shared/constants'
import {
  daysBetween,
  formatDaysAgo,
  formatGermanDate,
  formatGermanDateTime,
} from '@shared/domain/dates'
import { getFollowUpInfo } from '@shared/domain/followUp'
import type { Application, Settings, Stage } from '@shared/types'
import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../stores/appStore'
import { FollowUpBar } from '../followup/FollowUpBar'
import { StageControl } from './StageControl'

const STAGE_TONES: Record<Stage, BadgeTone> = {
  applied: 'neutral',
  interview: 'brand',
  offer: 'ok',
  rejected: 'due',
}

export interface ApplicationCardProps {
  application: Application
  settings: Settings
  today: Date
  pinned?: boolean
  onEdit(application: Application): void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?(): void
}

export function ApplicationCard({
  application,
  settings,
  today,
  pinned,
  onEdit,
  selectionMode,
  selected,
  onToggleSelect,
}: ApplicationCardProps) {
  const markFollowedUp = useAppStore((s) => s.markFollowedUp)
  const deleteApplication = useAppStore((s) => s.deleteApplication)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const info = getFollowUpInfo(application, settings, today)
  const sentDays = daysBetween(application.sentAt, today)
  const { company, position, contactName, contactPhone, contactEmail } = application

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Bewerbung bei ${company}`}
      className={cn(
        'group flex flex-col gap-4 rounded-2xl border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        pinned ? 'border-due/50 ring-2 ring-due/20' : 'border-line',
        selected && 'ring-2 ring-brand/50',
        application.stage === 'rejected' && 'opacity-75',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={onToggleSelect}
              aria-label={`${company} auswählen`}
              className="mt-1 h-4 w-4 shrink-0 rounded border-line accent-brand"
            />
          )}
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold" title={company}>
              {company}
            </h3>
            {position && <p className="truncate text-sm text-muted">{position}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pinned && (
            <Badge tone="due">
              <Pin size={12} aria-hidden="true" /> Melden fällig
            </Badge>
          )}
          {!pinned && (
            <Badge tone={STAGE_TONES[application.stage]}>{STAGE_LABELS[application.stage]}</Badge>
          )}
        </div>
      </header>

      <dl className="grid gap-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted">
          <dt className="sr-only">Abgeschickt</dt>
          <CalendarClock size={14} aria-hidden="true" />
          <dd>
            Abgeschickt am {formatGermanDate(application.sentAt)}{' '}
            <span className="text-xs">({formatDaysAgo(sentDays)})</span>
          </dd>
        </div>
        {contactName && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Ansprechpartner</dt>
            <User size={14} aria-hidden="true" className="text-muted" />
            <dd className="truncate">{contactName}</dd>
          </div>
        )}
        {contactPhone && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Telefon</dt>
            <Phone size={14} aria-hidden="true" className="text-muted" />
            <dd>
              <a
                className="text-brand hover:underline"
                href={`tel:${contactPhone.replace(/\s+/g, '')}`}
              >
                {contactPhone}
              </a>
            </dd>
          </div>
        )}
        {contactEmail && (
          <div className="flex min-w-0 items-center gap-2">
            <dt className="sr-only">E-Mail</dt>
            <Mail size={14} aria-hidden="true" className="text-muted" />
            <dd className="truncate">
              <a className="text-brand hover:underline" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </dd>
          </div>
        )}
        {application.documents.length > 0 && (
          <div className="flex items-center gap-2 text-muted">
            <dt className="sr-only">Dokumente</dt>
            <FileText size={14} aria-hidden="true" />
            <dd>
              {application.documents.length}{' '}
              {application.documents.length === 1 ? 'Dokument' : 'Dokumente'}
            </dd>
          </div>
        )}
      </dl>

      {application.stage === 'interview' && (
        <div className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-medium text-brand">
          🎤{' '}
          {application.appointmentAt
            ? `Termin am ${formatGermanDateTime(application.appointmentAt)}`
            : 'Termin – Datum noch offen'}
        </div>
      )}
      {application.stage === 'offer' && (
        <div className="rounded-xl bg-ok/10 px-3 py-2 text-sm font-medium text-ok">
          🏆 Angebot erhalten!
        </div>
      )}

      <FollowUpBar application={application} settings={settings} today={today} />

      {application.notes && (
        <p
          className="line-clamp-2 text-sm whitespace-pre-line text-muted"
          title={application.notes}
        >
          {application.notes}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {info.status !== 'none' && (
          <Button
            size="sm"
            variant={info.status === 'due' ? 'primary' : 'secondary'}
            onClick={() => markFollowedUp(application.id)}
          >
            <Check size={14} aria-hidden="true" /> Nachgefragt
          </Button>
        )}
        <StageControl application={application} />
        <div className="ml-auto flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${company} bearbeiten`}
            onClick={() => onEdit(application)}
          >
            <Pencil size={16} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${company} löschen`}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </footer>

      <Dialog
        open={confirmDelete}
        title="Bewerbung löschen?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false)
                void deleteApplication(application.id)
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Die Bewerbung bei <strong className="text-fg">{company}</strong> und alle hinterlegten
          Dokumente werden entfernt. Deine XP bleiben erhalten.
        </p>
      </Dialog>
    </motion.article>
  )
}
