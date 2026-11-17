import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import { makeCvResult, makeCvSource } from '@shared/testing/cvFixtures'
import { useCvOptimization } from '../../../../../../src/renderer/src/features/cv-optimization/useCvOptimization'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { installMockApi, type MockApi } from '../../../../../../src/renderer/src/test/mockApi'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'

const configured = { configured: true, hint: 'abcd', encryptionAvailable: true }
const consented = {
  followUpWeeks: 2,
  notificationsEnabled: true,
  theme: 'system' as const,
  aiConsentAt: '2026-11-17T10:00:00.000Z',
}

let api: MockApi

beforeEach(() => {
  api = installMockApi()
  api.getAiKeyStatus.mockResolvedValue(configured)
})

async function ready(settings = consented) {
  const app = makeApplication({
    id: 'a1',
    company: 'Muster GmbH',
    position: 'Frontend-Entwickler',
    jobDescription: 'React, TypeScript',
  })
  seedStore({ applications: [app, makeApplication({ id: 'a2' })], settings })
  const hook = renderHook(() => useCvOptimization())
  await waitFor(() => expect(hook.result.current.keyConfigured).toBe(true))
  await act(() => hook.result.current.pickFile())
  act(() => hook.result.current.selectApplication('a1'))
  return hook
}

describe('useCvOptimization', () => {
  it('cannot start without key, source or job posting', async () => {
    api.getAiKeyStatus.mockResolvedValue({ ...configured, configured: false, hint: null })
    seedStore()
    const { result } = renderHook(() => useCvOptimization())
    await waitFor(() => expect(result.current.keyConfigured).toBe(false))
    expect(result.current.canStart).toBe(false)
    act(() => result.current.start())
    expect(result.current.phase).toBe('input')
    expect(result.current.jobCheck).toEqual({ ok: false, reason: 'empty', length: 0 })
  })

  it('treats a failing key status as missing key and can refresh it', async () => {
    api.getAiKeyStatus.mockRejectedValueOnce(new Error('ipc'))
    seedStore()
    const { result } = renderHook(() => useCvOptimization())
    await waitFor(() => expect(result.current.keyConfigured).toBe(false))
    await act(() => result.current.refreshKey())
    expect(result.current.keyConfigured).toBe(true)
  })

  it('loads a cv via dialog or drop and keeps errors', async () => {
    seedStore()
    const { result } = renderHook(() => useCvOptimization())
    await act(() => result.current.pickFile())
    expect(result.current.source).toEqual(makeCvSource())

    api.readCvFile.mockResolvedValueOnce({ ok: false, error: 'pdf-not-supported' })
    await act(() => result.current.dropFile(new File(['x'], 'cv.pdf')))
    expect(api.readCvFile).toHaveBeenCalledWith('C:/drop/cv.pdf')
    expect(result.current.sourceError).toBe('pdf-not-supported')
    expect(result.current.source).toEqual(makeCvSource())

    api.pickCvFile.mockResolvedValueOnce(null)
    await act(() => result.current.pickFile())
    expect(result.current.sourceError).toBe('pdf-not-supported')

    api.pickCvFile.mockRejectedValueOnce(new Error('ipc'))
    await act(() => result.current.pickFile())
    expect(result.current.sourceError).toBe('unreadable-file')
    expect(result.current.loadingSource).toBe(false)
  })

  it('takes the job posting from the selected application', async () => {
    const { result } = await ready()
    expect(result.current.jobDescription).toBe('React, TypeScript')
    act(() => result.current.selectApplication('a2'))
    expect(result.current.jobDescription).toBe('React, TypeScript')
    act(() => result.current.setJobDescription('Go'))
    expect(result.current.jobDescription).toBe('Go')
  })

  it('asks for consent first and remembers it', async () => {
    const { result } = await ready({ ...consented, aiConsentAt: null } as never)
    act(() => result.current.start())
    expect(result.current.phase).toBe('consent')
    act(() => result.current.declineConsent())
    expect(result.current.phase).toBe('input')
    expect(api.optimizeCv).not.toHaveBeenCalled()

    act(() => result.current.start())
    await act(async () => result.current.confirmConsent())
    expect(useAppStore.getState().data.settings.aiConsentAt).not.toBeNull()
    await waitFor(() => expect(result.current.phase).toBe('result'))
  })

  it('runs the optimization with title and trimmed posting', async () => {
    const { result } = await ready()
    act(() => result.current.setJobDescription('  React  '))
    await act(async () => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('result'))
    expect(api.optimizeCv).toHaveBeenCalledWith({
      jobDescription: 'React',
      applicationId: 'a1',
      jobTitle: 'Frontend-Entwickler · Muster GmbH',
    })
    expect(result.current.result).toEqual(makeCvResult())

    act(() => result.current.backToInput())
    expect(result.current.phase).toBe('input')
  })

  it('shows errors, retries and returns to the input when canceled', async () => {
    const { result } = await ready()
    api.optimizeCv.mockResolvedValueOnce({ ok: false, error: 'rate-limit' })
    await act(async () => result.current.start())
    await waitFor(() => expect(result.current.phase).toBe('error'))
    expect(result.current.error).toBe('rate-limit')

    api.optimizeCv.mockRejectedValueOnce(new Error('ipc'))
    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.error).toBe('server'))

    api.optimizeCv.mockResolvedValueOnce({ ok: false, error: 'canceled' })
    await act(async () => result.current.retry())
    await waitFor(() => expect(result.current.phase).toBe('input'))
  })

  it('cancels a running optimization and ignores double starts', async () => {
    let finish: () => void = () => undefined
    api.optimizeCv.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: false, error: 'canceled' })
        }),
    )
    const { result } = await ready()
    act(() => result.current.start())
    expect(result.current.phase).toBe('running')
    act(() => result.current.retry())
    expect(api.optimizeCv).toHaveBeenCalledTimes(1)

    api.cancelCvOptimization.mockRejectedValueOnce(new Error('ipc'))
    act(() => result.current.cancel())
    expect(api.cancelCvOptimization).toHaveBeenCalled()
    expect(result.current.phase).toBe('input')
    await act(async () => finish())
  })

  it('shows a stored result directly and can discard it', async () => {
    api.getLastCvResult.mockResolvedValueOnce(makeCvResult({ id: 'alt' }))
    seedStore()
    const { result } = renderHook(() => useCvOptimization())
    await waitFor(() => expect(result.current.phase).toBe('result'))
    expect(result.current.result?.id).toBe('alt')

    await act(() => result.current.discard())
    expect(api.clearLastCvResult).toHaveBeenCalled()
    expect(result.current.result).toBeNull()
    expect(result.current.phase).toBe('input')
  })

  it('ignores a failing request for the stored result', async () => {
    api.getLastCvResult.mockRejectedValueOnce(new Error('ipc'))
    seedStore()
    const { result } = renderHook(() => useCvOptimization())
    await waitFor(() => expect(result.current.keyConfigured).toBe(true))
    expect(result.current.phase).toBe('input')
  })

  it('does not replace a running optimization with the stored result', async () => {
    let resolveLast: (value: null | ReturnType<typeof makeCvResult>) => void = () => undefined
    api.getLastCvResult.mockImplementationOnce(
      () => new Promise((resolve) => (resolveLast = resolve)),
    )
    api.optimizeCv.mockImplementationOnce(() => new Promise(() => undefined))
    const { result } = await ready()
    act(() => result.current.start())
    expect(result.current.phase).toBe('running')
    await act(async () => resolveLast(makeCvResult({ id: 'alt' })))
    expect(result.current.phase).toBe('running')
    expect(result.current.result).toBeNull()
  })
})
