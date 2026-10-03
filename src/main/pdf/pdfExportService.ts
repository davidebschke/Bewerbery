import { writeFile } from 'node:fs/promises'
import { buildPdfSummary } from '@shared/domain/pdfSummary'
import { formatGermanDate, toIsoDate } from '@shared/domain/dates'
import type { Application } from '@shared/types'
import { renderApplicationsPdf } from './pdfRenderer'

export interface PdfExportResult {
  canceled: boolean
  filePath?: string
}

export interface PdfExportService {
  exportApplications(applications: Application[], today: Date): Promise<PdfExportResult>
}

/** Fragt einen Speicherort ab; `null` bedeutet, der Dialog wurde abgebrochen */
export type SaveFileDialog = (suggestedName: string) => Promise<string | null>

/** Erstellt eine PDF-Zusammenfassung der ausgewählten Bewerbungen und speichert sie */
export function createPdfExportService(saveFile: SaveFileDialog): PdfExportService {
  async function exportApplications(
    applications: Application[],
    today: Date,
  ): Promise<PdfExportResult> {
    const suggestedName = `Bewerbungen-Zusammenfassung-${toIsoDate(today)}.pdf`
    const filePath = await saveFile(suggestedName)
    if (!filePath) return { canceled: true }

    const summaries = buildPdfSummary(applications)
    const bytes = await renderApplicationsPdf(summaries, formatGermanDate(toIsoDate(today)))
    await writeFile(filePath, bytes)
    return { canceled: false, filePath }
  }

  return { exportApplications }
}
