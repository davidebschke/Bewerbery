import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import { makeCvResult } from '@shared/testing/cvFixtures'
import { CvOptimizationView } from '../../../../../../src/renderer/src/features/cv-optimization/CvOptimizationView'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import {
  installMockApi,
  makeDocument,
  type MockApi,
} from '../../../../../../src/renderer/src/test/mockApi'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'

const configured = { configured: true, hint: 'abcd', encryptionAvailable: true }
let api: MockApi

beforeEach(() => {
  api = installMockApi()
  api.getAiKeyStatus.mockResolvedValue(configured)
  api.optimizeCv.mockResolvedValue({ ok: true, value: makeCvResult({ applicationId: 'a1' }) })
  seedStore({
    applications: [makeApplication({ id: 'a1', company: 'Muster GmbH', jobDescription: 'React' })],
    settings: {
      followUpWeeks: 2,
      notificationsEnabled: true,
      theme: 'system',
      aiConsentAt: '2026-11-17T10:00:00.000Z',
    },
  })
})

const lastToast = () => useAppStore.getState().toasts.at(-1)

async function optimize() {
  const onOpenSettings = vi.fn()
  const view = render(<CvOptimizationView settingsOpen={false} onOpenSettings={onOpenSettings} />)
  await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
  await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled())
  await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))
  await screen.findByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' })
  return { ...view, onOpenSettings }
}

const atsColumn = () => screen.getAllByRole('article')[3]

describe('CvOptimizationView', () => {
  it('runs an optimization and shows the comparison', async () => {
    await optimize()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: 'Neue Optimierung' }))
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeInTheDocument()
  })

  it('shows a progress state that can be canceled', async () => {
    api.optimizeCv.mockImplementationOnce(() => new Promise(() => undefined))
    render(<CvOptimizationView settingsOpen={false} onOpenSettings={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))

    expect(screen.getByRole('status')).toHaveTextContent('Varianten werden erstellt und bewertet')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(api.cancelCvOptimization).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeInTheDocument()
  })

  it('shows errors with retry and a shortcut to the settings', async () => {
    api.optimizeCv.mockResolvedValueOnce({ ok: false, error: 'invalid-key' })
    const onOpenSettings = vi.fn()
    render(<CvOptimizationView settingsOpen={false} onOpenSettings={onOpenSettings} />)
    await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Der API-Key ist ungültig')
    await userEvent.click(within(alert).getByRole('button', { name: 'Zu den Einstellungen' }))
    expect(onOpenSettings).toHaveBeenCalled()
    await userEvent.click(within(alert).getByRole('button', { name: 'Zurück zur Eingabe' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    api.optimizeCv.mockResolvedValueOnce({ ok: false, error: 'network' })
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))
    const second = await screen.findByRole('alert')
    expect(within(second).queryByRole('button', { name: 'Zu den Einstellungen' })).toBeNull()
    await userEvent.click(within(second).getByRole('button', { name: 'Erneut versuchen' }))
    await screen.findByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' })
  })

  it('opens the consent dialog before the first run', async () => {
    useAppStore.getState().updateSettings({ aiConsentAt: null })
    render(<CvOptimizationView settingsOpen={false} onOpenSettings={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Zustimmen und senden' }))
    await screen.findByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' })
    expect(useAppStore.getState().data.settings.aiConsentAt).not.toBeNull()
  })

  it('saves a variant via dialog and reports errors', async () => {
    await optimize()
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Speichern unter …' }))
    expect(api.saveCvVariant).toHaveBeenCalledWith('ats')
    expect(lastToast()?.message).toBe('Variante gespeichert.')

    const toasts = useAppStore.getState().toasts.length
    api.saveCvVariant.mockResolvedValueOnce({ ok: true, value: { canceled: true } })
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Speichern unter …' }))
    expect(useAppStore.getState().toasts).toHaveLength(toasts)

    api.saveCvVariant.mockResolvedValueOnce({ ok: false, error: 'save-failed' })
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Speichern unter …' }))
    expect(lastToast()).toMatchObject({
      kind: 'error',
      message: 'Datei konnte nicht gespeichert werden',
    })

    api.saveCvVariant.mockRejectedValueOnce(new Error('ipc'))
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Speichern unter …' }))
    expect(lastToast()?.kind).toBe('error')
  })

  it('attaches a variant to the application', async () => {
    await optimize()
    await userEvent.click(
      within(atsColumn()).getByRole('button', { name: 'An Bewerbung speichern' }),
    )
    expect(api.attachCvVariant).toHaveBeenCalledWith('ats', 'a1')
    expect(useAppStore.getState().data.applications[0].documents).toEqual([
      makeDocument('Lebenslauf – ATS-optimiert.docx'),
    ])
    expect(lastToast()?.message).toBe('Variante an der Bewerbung gespeichert.')

    api.attachCvVariant.mockResolvedValueOnce({ ok: false, error: 'no-source' })
    await userEvent.click(
      within(atsColumn()).getByRole('button', { name: 'An Bewerbung speichern' }),
    )
    expect(lastToast()).toMatchObject({ kind: 'error', message: 'Kein Lebenslauf gewählt' })

    api.attachCvVariant.mockRejectedValueOnce(new Error('ipc'))
    await userEvent.click(
      within(atsColumn()).getByRole('button', { name: 'An Bewerbung speichern' }),
    )
    expect(lastToast()?.kind).toBe('error')
  })

  it('hides attaching when the application no longer exists', async () => {
    api.optimizeCv.mockResolvedValue({ ok: true, value: makeCvResult({ applicationId: 'weg' }) })
    await optimize()
    expect(
      within(atsColumn()).queryByRole('button', { name: 'An Bewerbung speichern' }),
    ).not.toBeInTheDocument()
  })

  it('copies the plain text of a variant', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await optimize()
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Text kopieren' }))
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Skills: TypeScript, React, Teamfähigkeit'),
    )
    expect(lastToast()?.message).toBe('Text in die Zwischenablage kopiert.')

    writeText.mockRejectedValueOnce(new Error('denied'))
    await userEvent.click(within(atsColumn()).getByRole('button', { name: 'Text kopieren' }))
    expect(lastToast()?.message).toBe('Text konnte nicht kopiert werden.')
  })

  it('shows the stored result on opening and discards it after confirmation', async () => {
    api.getLastCvResult.mockResolvedValueOnce(makeCvResult({ applicationId: 'a1' }))
    render(<CvOptimizationView settingsOpen={false} onOpenSettings={vi.fn()} />)
    await screen.findByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' })

    await userEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    const confirm = screen.getByRole('group', { name: 'Ergebnis verwerfen bestätigen' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Abbrechen' }))
    expect(api.clearLastCvResult).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Verwerfen' }))
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Ergebnis verwerfen bestätigen' })).getByRole(
        'button',
        { name: 'Verwerfen' },
      ),
    )
    expect(api.clearLastCvResult).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Optimieren' })).toBeInTheDocument()
  })

  it('reloads the key status after the settings were closed', async () => {
    const { rerender } = render(<CvOptimizationView settingsOpen onOpenSettings={vi.fn()} />)
    await waitFor(() => expect(api.getAiKeyStatus).toHaveBeenCalledTimes(1))
    rerender(<CvOptimizationView settingsOpen={false} onOpenSettings={vi.fn()} />)
    await waitFor(() => expect(api.getAiKeyStatus).toHaveBeenCalledTimes(2))
  })
})
