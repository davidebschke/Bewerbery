import { describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'
import { makeData } from '@shared/testing/fixtures'
import type { ApplicationDocument } from '@shared/types'
import type { DocumentService } from '../documents/documentService'
import type { DataStore } from '../storage/dataStore'
import { registerIpc, type IpcDeps } from './registerIpc'

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
  const deps: IpcDeps = {
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    dataStore,
    documents,
    pickFiles: vi.fn(async () => ['C:/cv.pdf']),
    openPath: vi.fn(async () => ''),
    onDataChanged: vi.fn(),
    ...overrides,
  }
  registerIpc(deps)
  const invoke = (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
  return { deps, dataStore, documents, invoke, data, handlers }
}

describe('registerIpc', () => {
  it('registers all channels', () => {
    const { handlers } = setup()
    expect([...handlers.keys()].sort()).toEqual(Object.values(IPC).sort())
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
})
