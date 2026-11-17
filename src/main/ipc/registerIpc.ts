import { z } from 'zod'
import { IPC } from '@shared/ipc'
import { fail } from '@shared/domain/cv/aiErrors'
import { apiKeySchema, cvOptimizationRequestSchema } from '@shared/domain/cv/schemas'
import { TEMPLATE_FORMATS } from '@shared/domain/import/template'
import { applicationDocumentSchema } from '@shared/schemas'
import type { AppData } from '@shared/types'
import type { AiClient } from '../ai/claudeClient'
import type { SecretStore } from '../ai/secretStore'
import type { CvService } from '../cv/cvService'
import type { DocumentService } from '../documents/documentService'
import type { ImportService } from '../import/importService'
import type { PdfExportService } from '../pdf/pdfExportService'
import type { DataStore } from '../storage/dataStore'

type Handler = (event: unknown, ...args: unknown[]) => unknown

export interface IpcDeps {
  ipcMain: { handle(channel: string, handler: Handler): void }
  dataStore: DataStore
  documents: DocumentService
  pdfExport: PdfExportService
  importer: ImportService
  /** Verschlüsselt gespeicherter Anthropic-API-Key */
  secrets: SecretStore
  ai: AiClient
  cv: CvService
  /** Dateidialog für den Lebenslauf (DOCX/ODT); `null` = abgebrochen */
  pickCvFile(): Promise<string | null>
  /** Öffnet einen Dateiauswahldialog und liefert die gewählten Pfade */
  pickFiles(): Promise<string[]>
  /** Öffnet eine Datei mit dem Standardprogramm, liefert Fehlermeldung oder '' */
  openPath(path: string): Promise<string>
  /** Aktuelles Datum, z. B. für den Zeitstempel im PDF-Export */
  now(): Date
  onDataChanged?(data: AppData): void
}

const idSchema = z.string().min(1)
const pathsSchema = z.array(z.string().min(1))
const applicationIdsSchema = z.array(idSchema)
const templateFormatSchema = z.enum(TEMPLATE_FORMATS)
const filePathSchema = z.string().min(1)

export function registerIpc(deps: IpcDeps): void {
  const { ipcMain, dataStore, documents } = deps

  ipcMain.handle(IPC.loadData, async () => {
    const data = await dataStore.load()
    deps.onDataChanged?.(data)
    return data
  })

  ipcMain.handle(IPC.saveData, async (_event, data) => {
    const saved = await dataStore.save(data)
    deps.onDataChanged?.(saved)
  })

  ipcMain.handle(IPC.pickDocuments, async (_event, applicationId) => {
    const id = idSchema.parse(applicationId)
    const paths = await deps.pickFiles()
    return paths.length ? documents.importFiles(id, paths) : []
  })

  ipcMain.handle(IPC.importDocuments, async (_event, applicationId, filePaths) => {
    return documents.importFiles(idSchema.parse(applicationId), pathsSchema.parse(filePaths))
  })

  ipcMain.handle(IPC.openDocument, async (_event, applicationId, document) => {
    const path = documents.resolvePath(
      idSchema.parse(applicationId),
      applicationDocumentSchema.parse(document),
    )
    const error = await deps.openPath(path)
    if (error) throw new Error(`Dokument konnte nicht geöffnet werden: ${error}`)
  })

  ipcMain.handle(IPC.removeDocument, async (_event, applicationId, document) => {
    await documents.remove(idSchema.parse(applicationId), applicationDocumentSchema.parse(document))
  })

  ipcMain.handle(IPC.removeAllDocuments, async (_event, applicationId) => {
    await documents.removeAll(idSchema.parse(applicationId))
  })

  ipcMain.handle(IPC.exportApplicationsPdf, async (_event, applicationIds) => {
    const ids = new Set(applicationIdsSchema.parse(applicationIds))
    const data = await dataStore.load()
    const selected = data.applications.filter((application) => ids.has(application.id))
    return deps.pdfExport.exportApplications(selected, deps.now())
  })

  ipcMain.handle(IPC.pickImportFile, () => deps.importer.pickWorkbook())

  ipcMain.handle(IPC.saveImportTemplate, (_event, format) =>
    deps.importer.saveTemplate(templateFormatSchema.parse(format)),
  )

  // KI-Assistent: Kein Handler gibt den API-Key zurück
  ipcMain.handle(IPC.getAiKeyStatus, () => deps.secrets.status())

  ipcMain.handle(IPC.setAiKey, (_event, apiKey) => deps.secrets.set(apiKeySchema.parse(apiKey)))

  ipcMain.handle(IPC.testAiKey, async (_event, apiKey) => {
    const key = apiKey === undefined ? await deps.secrets.get() : apiKeySchema.parse(apiKey)
    if (!key) return fail('no-key')
    return deps.ai.testKey(key)
  })

  ipcMain.handle(IPC.removeAiKey, () => {
    // Ohne Key darf kein Lauf weiterlaufen
    deps.cv.cancel()
    return deps.secrets.remove()
  })

  // CV-Optimierung
  ipcMain.handle(IPC.pickCvFile, async () => {
    const path = await deps.pickCvFile()
    return path ? deps.cv.loadSource(path) : null
  })

  ipcMain.handle(IPC.readCvFile, (_event, filePath) =>
    deps.cv.loadSource(filePathSchema.parse(filePath)),
  )

  ipcMain.handle(IPC.optimizeCv, (_event, request) =>
    deps.cv.optimize(cvOptimizationRequestSchema.parse(request)),
  )

  ipcMain.handle(IPC.cancelCvOptimization, () => deps.cv.cancel())
}
