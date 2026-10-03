import type { Application } from '../types'

export interface PdfDocumentSummary {
  name: string
  addedAt: string
}

export interface PdfApplicationSummary {
  company: string
  position: string
  contactName: string
  contactPhone: string
  contactEmail: string
  notes: string
  documents: PdfDocumentSummary[]
}

/** Bereitet ausgewählte Bewerbungen als reine Textbausteine für den PDF-Export auf */
export function buildPdfSummary(applications: Application[]): PdfApplicationSummary[] {
  return applications.map((application) => ({
    company: application.company,
    position: application.position,
    contactName: application.contactName,
    contactPhone: application.contactPhone,
    contactEmail: application.contactEmail,
    notes: application.notes,
    documents: application.documents.map((document) => ({
      name: document.name,
      addedAt: document.addedAt,
    })),
  }))
}

/** Bricht Text an Wortgrenzen um; `measure` liefert die Breite eines Textstücks */
export function wrapTextToWidth(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let current = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (measure(candidate) > maxWidth && current) {
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

/** Bricht Text an Wortgrenzen auf Zeilen mit höchstens `maxChars` Zeichen um */
export function wrapText(text: string, maxChars: number): string[] {
  return wrapTextToWidth(text, maxChars, (candidate) => candidate.length)
}
