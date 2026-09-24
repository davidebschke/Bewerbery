import { z } from 'zod'
import { IPC } from '@shared/ipc'
import { applicationDocumentSchema } from '@shared/schemas'
import type { AppData } from '@shared/types'
import type { DocumentService } from '../documents/documentService'
import type { PdfExportService } from '../pdf/pdfExportService'
import type { DataStore } from '../storage/dataStore'

type Handler = (event: unknown, ...args: unknown[]) => unknown

export interface IpcDeps {
  ipcMain: { handle(channel: string, handler: Handler): void }
  dataStore: DataStore
  documents: DocumentService
  pdfExport: PdfExportService
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
    return deps.pdfExport.exportApplications(selected, data.settings, deps.now())
  })
}
