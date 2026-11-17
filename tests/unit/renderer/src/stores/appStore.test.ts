import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import {
  installMockApi,
  makeDocument,
  type MockApi,
} from '../../../../../src/renderer/src/test/mockApi'
import { useAppStore } from '../../../../../src/renderer/src/stores/appStore'

const store = () => useAppStore.getState()
const input = { company: 'ACME', position: 'Dev', sentAt: '2026-09-20' }

let api: MockApi

beforeEach(() => {
  api = installMockApi()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 12))
})

describe('appStore', () => {
  it('attaches a stored document to an existing application', () => {
    const existing = makeDocument('alt.pdf')
    const app = makeApplication({ id: 'a1', documents: [existing] })
    useAppStore.setState({ data: makeData({ applications: [app] }), status: 'ready' })

    const variant = makeDocument('Lebenslauf – ATS-optimiert.docx')
    store().attachDocument('a1', variant)
    expect(store().data.applications[0].documents).toEqual([existing, variant])
    expect(api.saveData).toHaveBeenCalledTimes(1)

    store().attachDocument('fehlt', variant)
    expect(api.saveData).toHaveBeenCalledTimes(1)
  })

  it('stores the job description of an existing application', () => {
    const app = makeApplication({ id: 'a1' })
    useAppStore.setState({ data: makeData({ applications: [app] }), status: 'ready' })

    store().setJobDescription('a1', 'React, TypeScript')
    expect(store().data.applications[0].jobDescription).toBe('React, TypeScript')
    expect(api.saveData).toHaveBeenCalledTimes(1)

    store().setJobDescription('a1', 'x'.repeat(15_010))
    expect(store().data.applications[0].jobDescription).toHaveLength(15_000)

    store().setJobDescription('fehlt', 'egal')
    expect(api.saveData).toHaveBeenCalledTimes(2)
  })

  it('hydrates from the api', async () => {
    const data = makeData({ applications: [makeApplication({ company: 'Loaded' })] })
    api.loadData.mockResolvedValueOnce(data)
    await store().hydrate()
    expect(store().status).toBe('ready')
    expect(store().data.applications[0].company).toBe('Loaded')
  })

  it('reports hydrate errors', async () => {
    api.loadData.mockRejectedValueOnce(new Error('kaputt'))
    await store().hydrate()
    expect(store().status).toBe('error')
    expect(store().error).toBe('kaputt')
  })

  it('adds applications, rewards XP and persists', () => {
    const doc = makeDocument()
    const app = store().addApplication(input, 'draft', [doc])
    expect(app.id).toBe('draft')
    expect(store().data.applications).toHaveLength(1)
    expect(store().data.applications[0].documents).toEqual([doc])
    expect(store().data.progress.xp).toBe(10)
    expect(store().toasts[0].message).toBe('+10 XP · Bewerbung angelegt')
    expect(api.saveData).toHaveBeenCalledWith(store().data)
  })

  it('shows an error toast when saving fails', async () => {
    api.saveData.mockRejectedValueOnce(new Error('disk full'))
    store().updateSettings({ followUpWeeks: 3 })
    await vi.waitFor(() => expect(store().toasts.some((t) => t.kind === 'error')).toBe(true))
  })

  it('updates applications and keeps documents unless given', () => {
    const app = store().addApplication(input, undefined, [makeDocument()])
    store().updateApplication(app.id, { ...input, company: 'Neu GmbH' })
    expect(store().data.applications[0].company).toBe('Neu GmbH')
    expect(store().data.applications[0].documents).toHaveLength(1)

    store().updateApplication(app.id, input, [])
    expect(store().data.applications[0].documents).toEqual([])
  })

  it('deletes applications including documents', async () => {
    const app = store().addApplication(input)
    api.removeAllDocuments.mockRejectedValueOnce(new Error('egal'))
    await store().deleteApplication(app.id)
    expect(store().data.applications).toEqual([])
    expect(api.removeAllDocuments).toHaveBeenCalledWith(app.id)
  })

  it('marks follow-ups with today and rewards XP', () => {
    const app = store().addApplication(input)
    store().markFollowedUp(app.id)
    const updated = store().data.applications[0]
    expect(updated.lastFollowUpAt).toBe('2026-09-23')
    expect(store().data.progress.followUps).toBe(1)
    expect(store().data.progress.xp).toBe(15)
  })

  it('ignores follow-ups and stage changes for unknown ids', () => {
    store().markFollowedUp('unknown')
    store().setStage('unknown', 'offer')
    expect(store().data.progress.xp).toBe(0)
  })

  it('sets stages, awards once and celebrates', () => {
    const app = store().addApplication(input)
    store().setStage(app.id, 'interview', '2026-10-01T10:00')
    expect(store().data.applications[0]).toMatchObject({
      stage: 'interview',
      appointmentAt: '2026-10-01T10:00',
      awardedStages: ['interview'],
    })
    expect(store().celebration?.kind).toBe('interview')
    expect(store().data.progress.xp).toBe(35)

    store().setStage(app.id, 'applied')
    store().setStage(app.id, 'interview', null)
    expect(store().data.progress.xp).toBe(35)

    store().setStage(app.id, 'offer')
    expect(store().celebration?.kind).toBe('offer')
    expect(store().data.applications[0].appointmentAt).toBeNull()
  })

  it('does not celebrate rejections but still rewards', () => {
    const app = store().addApplication(input)
    store().setStage(app.id, 'rejected')
    expect(store().celebration).toBeNull()
    expect(store().data.progress.rejections).toBe(1)
  })

  it('celebrates level ups', () => {
    useAppStore.setState({
      data: { ...store().data, progress: { ...store().data.progress, xp: 45 } },
    })
    store().addApplication(input)
    expect(store().celebration?.kind).toBe('level')
    expect(store().toasts.map((t) => t.kind)).toContain('level')
  })

  it('announces newly unlocked badges', () => {
    store().addApplication(input)
    expect(store().toasts.map((t) => [t.kind, t.message])).toEqual([
      ['xp', '+10 XP · Bewerbung angelegt'],
      ['badge', 'Abzeichen freigeschaltet: 🚀 Erster Schritt'],
    ])
  })

  it('does not repeat badge toasts for already unlocked tiers', () => {
    store().addApplication(input)
    useAppStore.setState({ toasts: [] })
    store().addApplication(input)
    expect(store().toasts.map((t) => t.kind)).toEqual(['xp'])
  })

  it('imports applications with one save, one summary and badge toasts', () => {
    useAppStore.setState({ toasts: [] })
    const imported = [
      makeApplication({ company: 'A', position: 'P', stage: 'offer', awardedStages: ['offer'] }),
      makeApplication({ company: 'B', position: 'P', lastFollowUpAt: '2026-09-10' }),
    ]
    store().importApplications(imported, { skipped: 2, duplicates: 1 })
    expect(store().data.applications.map((app) => app.company)).toEqual(['A', 'B'])
    expect(store().data.progress).toMatchObject({
      applicationsCreated: 2,
      offers: 1,
      followUps: 1,
      xp: 10 + 100 + 10 + 5,
    })
    expect(store().toasts.map((t) => [t.kind, t.message])).toEqual(
      expect.arrayContaining([
        ['xp', '2 Bewerbungen importiert · 2 übersprungen · 1 Duplikat · +125 XP'],
        ['badge', 'Abzeichen freigeschaltet: 🚀 Erster Schritt'],
        ['level', 'Level-Up! 🎉'],
      ]),
    )
    expect(store().celebration?.kind).toBe('level')
    expect(api.saveData).toHaveBeenCalledTimes(1)
  })

  it('reports an empty import as info without XP', () => {
    useAppStore.setState({ toasts: [] })
    store().importApplications([], { skipped: 3, duplicates: 2 })
    expect(store().toasts.map((t) => [t.kind, t.message])).toEqual([
      ['info', '0 Bewerbungen importiert · 3 übersprungen · 2 Duplikate'],
    ])
  })

  it('updates and validates settings', () => {
    store().updateSettings({ followUpWeeks: 4, theme: 'dark' })
    expect(store().data.settings).toMatchObject({ followUpWeeks: 4, theme: 'dark' })
    expect(() => store().updateSettings({ followUpWeeks: 99 })).toThrow()
  })

  it('pushes and dismisses toasts', () => {
    store().pushToast('info', 'Hallo')
    const [toast] = store().toasts
    store().dismissToast(toast.id)
    expect(store().toasts).toEqual([])
  })
})
