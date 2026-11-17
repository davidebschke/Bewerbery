import { vi } from 'vitest'
import type { AiKeyStatus } from '@shared/domain/cv/schemas'
import { createEmptyData } from '@shared/domain/factory'
import type { BewerberyApi } from '@shared/ipc'
import { makeCvResult, makeCvSource } from '@shared/testing/cvFixtures'
import type { AppData, ApplicationDocument } from '@shared/types'

const noKey: AiKeyStatus = { configured: false, hint: null, encryptionAvailable: true }

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
    exportApplicationsPdf: vi.fn(async () => ({ canceled: false, filePath: 'C:/export.pdf' })),
    pickImportFile: vi.fn(async () => null),
    saveImportTemplate: vi.fn(async () => ({ canceled: false, filePath: 'C:/vorlage.xlsx' })),
    getPathForFile: vi.fn((file: File) => `C:/drop/${file.name}`),
    getAiKeyStatus: vi.fn(async () => noKey),
    setAiKey: vi.fn(async () => ({
      ok: true,
      value: { configured: true, hint: 'abcd', encryptionAvailable: true },
    })),
    testAiKey: vi.fn(async () => ({ ok: true, value: true })),
    removeAiKey: vi.fn(async () => noKey),
    pickCvFile: vi.fn(async () => ({ ok: true, value: makeCvSource() })),
    readCvFile: vi.fn(async () => ({ ok: true, value: makeCvSource() })),
    optimizeCv: vi.fn(async () => ({ ok: true, value: makeCvResult() })),
    cancelCvOptimization: vi.fn(async () => undefined),
  } as unknown as MockApi
  window.api = api
  return api
}
