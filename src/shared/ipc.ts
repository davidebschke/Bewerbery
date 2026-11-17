import type { AiResult } from './domain/cv/aiErrors'
import type { AiKeyStatus } from './domain/cv/schemas'
import type { TemplateFormat } from './domain/import/template'
import type { AppData, ApplicationDocument, ImportWorkbook } from './types'

export const IPC = {
  loadData: 'data:load',
  saveData: 'data:save',
  pickDocuments: 'documents:pick',
  importDocuments: 'documents:import',
  openDocument: 'documents:open',
  removeDocument: 'documents:remove',
  removeAllDocuments: 'documents:remove-all',
  exportApplicationsPdf: 'pdf:export-applications',
  pickImportFile: 'import:pick-file',
  saveImportTemplate: 'import:save-template',
  getAiKeyStatus: 'ai:key-status',
  setAiKey: 'ai:set-key',
  testAiKey: 'ai:test-key',
  removeAiKey: 'ai:remove-key',
} as const

export interface PdfExportOutcome {
  canceled: boolean
  filePath?: string
}

/** Ergebnis eines Speichern-Dialogs */
export type FileSaveOutcome = PdfExportOutcome

/** Typisierte API, die das Preload-Skript als `window.api` bereitstellt */
export interface BewerberyApi {
  loadData(): Promise<AppData>
  saveData(data: AppData): Promise<void>
  pickDocuments(applicationId: string): Promise<ApplicationDocument[]>
  importDocuments(applicationId: string, filePaths: string[]): Promise<ApplicationDocument[]>
  openDocument(applicationId: string, document: ApplicationDocument): Promise<void>
  removeDocument(applicationId: string, document: ApplicationDocument): Promise<void>
  removeAllDocuments(applicationId: string): Promise<void>
  exportApplicationsPdf(applicationIds: string[]): Promise<PdfExportOutcome>
  /** Tabellendatei auswählen und lesen; `null` = Dialog abgebrochen */
  pickImportFile(): Promise<ImportWorkbook | null>
  saveImportTemplate(format: TemplateFormat): Promise<FileSaveOutcome>
  getPathForFile(file: File): string

  // KI-Assistent – der API-Key selbst wird nie zurückgegeben
  getAiKeyStatus(): Promise<AiKeyStatus>
  setAiKey(apiKey: string): Promise<AiResult<AiKeyStatus>>
  /** Ohne Argument wird der gespeicherte Key geprüft */
  testAiKey(apiKey?: string): Promise<AiResult<true>>
  removeAiKey(): Promise<AiKeyStatus>
}
