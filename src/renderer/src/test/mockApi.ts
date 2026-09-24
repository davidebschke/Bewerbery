import { vi } from 'vitest'
import { createEmptyData } from '@shared/domain/factory'
import type { BewerberyApi } from '@shared/ipc'
import type { AppData, ApplicationDocument } from '@shared/types'

export type MockApi = { [K in keyof BewerberyApi]: ReturnType<typeof vi.fn> } & BewerberyApi

export function makeDocument(name = 'Lebenslauf.pdf'): ApplicationDocument {
  return {
    id: `doc-${name}`,
    name,
    storedName: `doc-${name}`,
    size: 2048,
    addedAt: '2026-09-23T10:00:00.000Z',
  }
}

export function installMockApi(data: AppData = createEmptyData()): MockApi {
  const api = {
    loadData: vi.fn(async () => data),
    saveData: vi.fn(async () => undefined),
    pickDocuments: vi.fn(async () => [makeDocument()]),
    importDocuments: vi.fn(async (_id: string, paths: string[]) =>
      paths.map((p) => makeDocument(p.split(/[\\/]/).pop())),
    ),
    openDocument: vi.fn(async () => undefined),
    removeDocument: vi.fn(async () => undefined),
    removeAllDocuments: vi.fn(async () => undefined),
    getPathForFile: vi.fn((file: File) => `C:/drop/${file.name}`),
  } as unknown as MockApi
  window.api = api
  return api
}
