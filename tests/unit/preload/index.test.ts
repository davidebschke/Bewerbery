import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'

const invoke = vi.fn(async () => 'ok')
const exposeInMainWorld = vi.fn()
const getPathForFile = vi.fn(() => 'C:/file.pdf')

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke },
  webUtils: { getPathForFile },
}))

describe('preload api', () => {
  beforeEach(() => invoke.mockClear())

  it('exposes the api on window', async () => {
    const { api } = await import('../../../src/preload/index')
    expect(exposeInMainWorld).toHaveBeenCalledWith('api', api)
  })

  it('forwards every call to the matching IPC channel', async () => {
    const { api } = await import('../../../src/preload/index')
    const data = { version: 1 } as never
    const doc = { id: 'd' } as never

    await api.loadData()
    await api.saveData(data)
    await api.pickDocuments('a')
    await api.importDocuments('a', ['p'])
    await api.openDocument('a', doc)
    await api.removeDocument('a', doc)
    await api.removeAllDocuments('a')
    await api.exportApplicationsPdf(['a'])
    await api.pickImportFile()
    await api.saveImportTemplate('csv')

    expect(invoke.mock.calls).toEqual([
      [IPC.loadData],
      [IPC.saveData, data],
      [IPC.pickDocuments, 'a'],
      [IPC.importDocuments, 'a', ['p']],
      [IPC.openDocument, 'a', doc],
      [IPC.removeDocument, 'a', doc],
      [IPC.removeAllDocuments, 'a'],
      [IPC.exportApplicationsPdf, ['a']],
      [IPC.pickImportFile],
      [IPC.saveImportTemplate, 'csv'],
    ])
    expect(api.getPathForFile({} as File)).toBe('C:/file.pdf')
  })

  it('forwards ai key calls to their IPC channels', async () => {
    const { api } = await import('../../../src/preload/index')

    await api.getAiKeyStatus()
    await api.setAiKey('key')
    await api.testAiKey()
    await api.testAiKey('key')
    await api.removeAiKey()

    expect(invoke.mock.calls).toEqual([
      [IPC.getAiKeyStatus],
      [IPC.setAiKey, 'key'],
      [IPC.testAiKey, undefined],
      [IPC.testAiKey, 'key'],
      [IPC.removeAiKey],
    ])
  })
})
