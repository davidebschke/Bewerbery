import { STAGE_LABELS } from '../constants'
import type { Application, Settings } from '../types'
import { daysBetween, formatDaysAgo, formatGermanDate, formatGermanDateTime } from './dates'
import { describeFollowUp, getFollowUpInfo } from './followUp'

export interface PdfDocumentSummary {
  name: string
  addedAt: string
}

export interface PdfApplicationSummary {
  company: string
  position: string
  stageLabel: string
  sentLine: string
  contactLines: string[]
  followUpLine: string
  appointmentLine: string | null
  notes: string
  documents: PdfDocumentSummary[]
}

/** Bereitet ausgewählte Bewerbungen als reine Textbausteine für den PDF-Export auf */
export function buildPdfSummary(
  applications: Application[],
  settings: Settings,
  today: Date,
): PdfApplicationSummary[] {
  return applications.map((application) => {
    const sentDays = daysBetween(application.sentAt, today)
    const followUpInfo = getFollowUpInfo(application, settings, today)

    const contactLines: string[] = []
    if (application.contactName) contactLines.push(`Ansprechpartner: ${application.contactName}`)
    if (application.contactPhone) contactLines.push(`Telefon: ${application.contactPhone}`)
    if (application.contactEmail) contactLines.push(`E-Mail: ${application.contactEmail}`)

    return {
      company: application.company,
      position: application.position,
      stageLabel: STAGE_LABELS[application.stage],
      sentLine: `Abgeschickt am ${formatGermanDate(application.sentAt)} (${formatDaysAgo(sentDays)})`,
      contactLines,
      followUpLine: describeFollowUp(followUpInfo),
      appointmentLine: application.appointmentAt
        ? `Termin am ${formatGermanDateTime(application.appointmentAt)}`
        : null,
      notes: application.notes,
      documents: application.documents.map((document) => ({
        name: document.name,
        addedAt: document.addedAt,
      })),
    }
  })
}

/** Bricht Text an Wortgrenzen auf Zeilen mit höchstens `maxChars` Zeichen um */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let current = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length > maxChars && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    lines.push(current)
  }
  return lines
}
