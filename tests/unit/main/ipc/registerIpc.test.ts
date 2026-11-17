import { describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import type { ApplicationDocument } from '@shared/types'
import type { AiClient } from '../../../../src/main/ai/claudeClient'
import type { SecretStore } from '../../../../src/main/ai/secretStore'
import type { CvService } from '../../../../src/main/cv/cvService'
import type { DocumentService } from '../../../../src/main/documents/documentService'
import { makeCvResult, makeCvSource } from '../../../../src/shared/testing/cvFixtures'
import type { ImportService } from '../../../../src/main/import/importService'
import type { PdfExportService } from '../../../../src/main/pdf/pdfExportService'
import type { DataStore } from '../../../../src/main/storage/dataStore'
import { registerIpc, type IpcDeps } from '../../../../src/main/ipc/registerIpc'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const doc: ApplicationDocument = {
  id: 'd1',
  name: 'cv.pdf',
  storedName: 'd1-cv.pdf',
  size: 1,
  addedAt: '2026-09-23T00:00:00.000Z',
}

function setup(overrides: Partial<IpcDeps> = {}) {
  const handlers = new Map<string, Handler>()
  const data = makeData()
  const dataStore: DataStore = {
    filePath: 'x',
    load: vi.fn(async () => data),
    save: vi.fn(async (d) => d as typeof data),
  }
  const documents: DocumentService = {
    rootDir: 'root',
    importFiles: vi.fn(async () => [doc]),
    resolvePath: vi.fn(() => 'root/app/d1-cv.pdf'),
    remove: vi.fn(async () => undefined),
    removeAll: vi.fn(async () => undefined),
  }
  const pdfExport: PdfExportService = {
    exportApplications: vi.fn(async () => ({ canceled: false, filePath: 'C:/export.pdf' })),
  }
  const importer: ImportService = {
    readWorkbook: vi.fn(),
    pickWorkbook: vi.fn(async () => ({ fileName: 'a.csv', sheets: [] })),
    saveTemplate: vi.fn(async () => ({ canceled: false, filePath: 'C:/vorlage.ods' })),
  }
  const secrets: SecretStore = {
    status: vi.fn(async () => keyStatus),
    set: vi.fn(async () => ({ ok: true as const, value: keyStatus })),
    get: vi.fn(async () => STORED_KEY),
    remove: vi.fn(async () => ({ ...keyStatus, configured: false, hint: null })),
  }
  const ai: AiClient = {
    testKey: vi.fn(async () => ({ ok: true as const, value: true as const })),
    generateVariant: vi.fn(),
    assessAll: vi.fn(),
  }
  const cv: CvService = {
    loadSource: vi.fn(async () => ({ ok: true as const, value: makeCvSource() })),
    optimize: vi.fn(async () => ({ ok: true as const, value: makeCvResult() })),
    cancel: vi.fn(),
    isRunning: vi.fn(() => false),
  }
  const deps: IpcDeps = {
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    dataStore,
    documents,
    pdfExport,
    importer,
    secrets,
    ai,
    cv,
    pickCvFile: vi.fn(async () => 'C:/Lebenslauf.docx'),
    pickFiles: vi.fn(async () => ['C:/cv.pdf']),
    openPath: vi.fn(async () => ''),
    now: () => new Date('2026-09-23T00:00:00.000Z'),
    onDataChanged: vi.fn(),
    ...overrides,
  }
  registerIpc(deps)
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
  return {
    deps,
    dataStore,
    documents,
    pdfExport,
    importer,
    secrets,
    ai,
    cv,
    invoke,
    data,
    handlers,
  }
}

const STORED_KEY = 'sk-ant-api03-gespeicherter-schluessel-wxyz'
const NEW_KEY = 'sk-ant-api03-neuer-schluessel-abcd'
const keyStatus = { configured: true, hint: 'wxyz', encryptionAvailable: true }

describe('registerIpc', () => {
  it('registers all channels', () => {
    const { handlers } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC).sort())
  })

  it('picks import files and saves validated template formats', async () => {
    const { invoke, importer } = setup()
    expect(await invoke(IPC.pickImportFile)).toEqual({ fileName: 'a.csv', sheets: [] })
    expect(await invoke(IPC.saveImportTemplate, 'ods')).toEqual({
      canceled: false,
      filePath: 'C:/vorlage.ods',
    })
    expect(importer.saveTemplate).toHaveBeenCalledWith('ods')
    expect(() => invoke(IPC.saveImportTemplate, 'exe')).toThrow()
  })

  it('loads and saves data and notifies about changes', async () => {
    const { invoke, data, deps, dataStore } = setup()
    expect(await invoke(IPC.loadData)).toBe(data)
    await invoke(IPC.saveData, data)
    expect(dataStore.save).toHaveBeenCalledWith(data)
    expect(deps.onDataChanged).toHaveBeenCalledTimes(2)
  })

  it('works without change listener', async () => {
    const { invoke, data } = setup({ onDataChanged: undefined })
    await expect(invoke(IPC.saveData, data)).resolves.toBeUndefined()
    await expect(invoke(IPC.loadData)).resolves.toBe(data)
  })

  it('picks and imports documents', async () => {
    const { invoke, documents } = setup()
    expect(await invoke(IPC.pickDocuments, 'app')).toEqual([doc])
    expect(documents.importFiles).toHaveBeenCalledWith('app', ['C:/cv.pdf'])
  })

  it('returns nothing when the dialog is cancelled', async () => {
    const { invoke, documents } = setup({ pickFiles: vi.fn(async () => []) })
    expect(await invoke(IPC.pickDocuments, 'app')).toEqual([])
    expect(documents.importFiles).not.toHaveBeenCalled()
  })

  it('imports dropped files and validates payloads', async () => {
    const { invoke } = setup()
    expect(await invoke(IPC.importDocuments, 'app', ['C:/a.pdf'])).toEqual([doc])
    await expect(invoke(IPC.importDocuments, 'app', 'C:/a.pdf')).rejects.toThrow()
    await expect(invoke(IPC.pickDocuments, '')).rejects.toThrow()
  })

  it('opens documents and surfaces errors', async () => {
    const { invoke, deps } = setup()
    await invoke(IPC.openDocument, 'app', doc)
    expect(deps.openPath).toHaveBeenCalledWith('root/app/d1-cv.pdf')

    const failing = setup({ openPath: vi.fn(async () => 'nicht gefunden') })
    await expect(failing.invoke(IPC.openDocument, 'app', doc)).rejects.toThrow('nicht gefunden')
    await expect(failing.invoke(IPC.openDocument, 'app', { id: 1 })).rejects.toThrow()
  })

  it('removes documents', async () => {
    const { invoke, documents } = setup()
    await invoke(IPC.removeDocument, 'app', doc)
    await invoke(IPC.removeAllDocuments, 'app')
    expect(documents.remove).toHaveBeenCalledWith('app', doc)
    expect(documents.removeAll).toHaveBeenCalledWith('app')
  })

  it('exports the selected applications as pdf', async () => {
    const app1 = makeApplication({ id: 'a1' })
    const app2 = makeApplication({ id: 'a2' })
    const exportData = makeData({ applications: [app1, app2] })
    const today = new Date('2026-09-23T00:00:00.000Z')
    const { invoke, pdfExport } = setup({
      dataStore: {
        filePath: 'x',
        load: vi.fn(async () => exportData),
        save: vi.fn(async (d) => d as typeof exportData),
      },
      now: () => today,
    })

    const result = await invoke(IPC.exportApplicationsPdf, ['a1'])

    expect(result).toEqual({ canceled: false, filePath: 'C:/export.pdf' })
    expect(pdfExport.exportApplications).toHaveBeenCalledWith([app1], today)
  })

  it('validates the application ids for the pdf export', async () => {
    const { invoke } = setup()
    await expect(invoke(IPC.exportApplicationsPdf, 'not-an-array')).rejects.toThrow()
  })

  describe('ai key', () => {
    it('returns the key status without the key itself', async () => {
      const { invoke } = setup()
      const status = await invoke(IPC.getAiKeyStatus)
      expect(status).toEqual(keyStatus)
      expect(JSON.stringify(status)).not.toContain(STORED_KEY)
    })

    it('stores a validated, trimmed key', async () => {
      const { invoke, secrets } = setup()
      expect(await invoke(IPC.setAiKey, `  ${NEW_KEY}  `)).toEqual({ ok: true, value: keyStatus })
      expect(secrets.set).toHaveBeenCalledWith(NEW_KEY)
      expect(() => invoke(IPC.setAiKey, 'kurz')).toThrow()
      expect(() => invoke(IPC.setAiKey, 42)).toThrow()
    })

    it('tests a given key or falls back to the stored key', async () => {
      const { invoke, ai } = setup()
      expect(await invoke(IPC.testAiKey, NEW_KEY)).toEqual({ ok: true, value: true })
      expect(ai.testKey).toHaveBeenLastCalledWith(NEW_KEY)
      await invoke(IPC.testAiKey)
      expect(ai.testKey).toHaveBeenLastCalledWith(STORED_KEY)
      await expect(invoke(IPC.testAiKey, 'kurz')).rejects.toThrow()
    })

    it('reports a missing key when testing without a stored key', async () => {
      const { invoke, secrets, ai } = setup()
      vi.mocked(secrets.get).mockResolvedValueOnce(null)
      expect(await invoke(IPC.testAiKey)).toEqual({ ok: false, error: 'no-key' })
      expect(ai.testKey).not.toHaveBeenCalled()
    })

    it('removes the key and cancels a running optimization', async () => {
      const { invoke, secrets, cv } = setup()
      expect(await invoke(IPC.removeAiKey)).toMatchObject({ configured: false, hint: null })
      expect(secrets.remove).toHaveBeenCalled()
      expect(cv.cancel).toHaveBeenCalled()
    })
  })

  describe('cv optimization', () => {
    it('picks and reads a cv file', async () => {
      const { invoke, cv } = setup()
      expect(await invoke(IPC.pickCvFile)).toEqual({ ok: true, value: makeCvSource() })
      expect(cv.loadSource).toHaveBeenCalledWith('C:/Lebenslauf.docx')

      await invoke(IPC.readCvFile, 'C:/drop/cv.odt')
      expect(cv.loadSource).toHaveBeenLastCalledWith('C:/drop/cv.odt')
      expect(() => invoke(IPC.readCvFile, '')).toThrow()
    })

    it('returns null when the cv dialog is cancelled', async () => {
      const { invoke, cv } = setup({ pickCvFile: vi.fn(async () => null) })
      expect(await invoke(IPC.pickCvFile)).toBeNull()
      expect(cv.loadSource).not.toHaveBeenCalled()
    })

    it('optimizes with a validated request and cancels on demand', async () => {
      const { invoke, cv } = setup()
      const request = { jobDescription: '  React  ', applicationId: null, jobTitle: 'Dev' }
      expect(await invoke(IPC.optimizeCv, request)).toEqual({ ok: true, value: makeCvResult() })
      expect(cv.optimize).toHaveBeenCalledWith({ ...request, jobDescription: 'React' })
      expect(() => invoke(IPC.optimizeCv, { ...request, jobDescription: ' ' })).toThrow()

      invoke(IPC.cancelCvOptimization)
      expect(cv.cancel).toHaveBeenCalled()
    })
  })
})
