import type { AppData, ApplicationDocument } from './types'

export const IPC = {
  loadData: 'data:load',
  saveData: 'data:save',
  pickDocuments: 'documents:pick',
  importDocuments: 'documents:import',
  openDocument: 'documents:open',
  removeDocument: 'documents:remove',
  removeAllDocuments: 'documents:remove-all',
  exportApplicationsPdf: 'pdf:export-applications',
} as const

export interface PdfExportOutcome {
  canceled: boolean
  filePath?: string
}

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
  getPathForFile(file: File): string
}
