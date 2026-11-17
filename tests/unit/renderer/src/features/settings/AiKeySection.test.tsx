import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AiKeySection } from '../../../../../../src/renderer/src/features/settings/AiKeySection'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { installMockApi, type MockApi } from '../../../../../../src/renderer/src/test/mockApi'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'

const KEY = 'sk-ant-api03-testschluessel-abcd'
const configured = { configured: true, hint: 'abcd', encryptionAvailable: true }

let api: MockApi

beforeEach(() => {
  api = installMockApi()
  seedStore()
})

const status = () => screen.getByTestId('ai-key-status')
const feedback = () => screen.getByRole('status')

describe('AiKeySection', () => {
  it('shows that no key is stored', async () => {
    render(<AiKeySection />)
    expect(status()).toHaveTextContent('Status wird geladen')
    await waitFor(() => expect(status()).toHaveTextContent('Kein Key hinterlegt'))
    expect(screen.getByLabelText('API-Key')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verbindung prüfen' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Key entfernen' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Anthropic-Konsole/ })).toHaveAttribute(
      'href',
      'https://console.anthropic.com/settings/keys',
    )
  })

  it('saves a key, clears the field and shows only the last 4 characters', async () => {
    render(<AiKeySection />)
    await userEvent.type(screen.getByLabelText('API-Key'), KEY)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(api.setAiKey).toHaveBeenCalledWith(KEY)
    expect(status()).toHaveTextContent('Key hinterlegt (…abcd)')
    expect(screen.getByLabelText('Neuer API-Key')).toHaveValue('')
    expect(feedback()).toHaveTextContent('API-Key gespeichert.')
    expect(document.body.textContent).not.toContain(KEY)
  })

  it('validates the key before sending it', async () => {
    render(<AiKeySection />)
    await userEvent.type(screen.getByLabelText('API-Key'), 'zu-kurz')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(feedback()).toHaveTextContent('Der API-Key ist zu kurz')
    expect(api.setAiKey).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }))
    expect(api.testAiKey).not.toHaveBeenCalled()
  })

  it('shows german errors when saving fails', async () => {
    api.setAiKey.mockResolvedValueOnce({ ok: false, error: 'encryption-unavailable' })
    api.setAiKey.mockRejectedValueOnce(new Error('ipc'))
    render(<AiKeySection />)
    const field = screen.getByLabelText('API-Key')
    await userEvent.type(field, KEY)
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(feedback()).toHaveTextContent('Sichere Speicherung nicht verfügbar')

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(feedback()).toHaveTextContent('API-Key konnte nicht gespeichert werden.')
  })

  it('tests an entered key or the stored key', async () => {
    api.getAiKeyStatus.mockResolvedValue(configured)
    render(<AiKeySection />)
    await waitFor(() => expect(status()).toHaveTextContent('Key hinterlegt (…abcd)'))

    await userEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }))
    expect(api.testAiKey).toHaveBeenLastCalledWith(undefined)
    expect(feedback()).toHaveTextContent('der API-Key ist gültig')

    api.testAiKey.mockResolvedValueOnce({ ok: false, error: 'invalid-key' })
    await userEvent.type(screen.getByLabelText('Neuer API-Key'), KEY)
    await userEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }))
    expect(api.testAiKey).toHaveBeenLastCalledWith(KEY)
    expect(feedback()).toHaveTextContent('Der API-Key ist ungültig')

    api.testAiKey.mockRejectedValueOnce(new Error('ipc'))
    await userEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }))
    expect(feedback()).toHaveTextContent('Fehler beim KI-Anbieter')
  })

  it('removes the key after confirmation', async () => {
    api.getAiKeyStatus.mockResolvedValue(configured)
    render(<AiKeySection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Key entfernen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(api.removeAiKey).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Key entfernen' }))
    const confirm = screen.getByRole('group', { name: 'Key entfernen bestätigen' })
    expect(confirm).toHaveTextContent('Key wirklich entfernen?')
    await userEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
    expect(api.removeAiKey).toHaveBeenCalled()
    expect(status()).toHaveTextContent('Kein Key hinterlegt')
    expect(feedback()).toHaveTextContent('API-Key entfernt.')
  })

  it('reports errors while removing or loading', async () => {
    api.getAiKeyStatus.mockResolvedValueOnce(configured)
    api.removeAiKey.mockRejectedValueOnce(new Error('ipc'))
    render(<AiKeySection />)
    await userEvent.click(await screen.findByRole('button', { name: 'Key entfernen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
    expect(feedback()).toHaveTextContent('API-Key konnte nicht entfernt werden.')
  })

  it('reports a failing status request', async () => {
    api.getAiKeyStatus.mockRejectedValueOnce(new Error('ipc'))
    render(<AiKeySection />)
    await waitFor(() => expect(feedback()).toHaveTextContent('Status konnte nicht geladen werden.'))
  })

  it('disables storing when the os offers no encryption', async () => {
    api.getAiKeyStatus.mockResolvedValue({
      ...configured,
      configured: false,
      hint: null,
      encryptionAvailable: false,
    })
    render(<AiKeySection />)
    expect(await screen.findByText(/Sichere Speicherung nicht verfügbar/)).toBeInTheDocument()
    expect(screen.getByLabelText('API-Key')).toBeDisabled()
  })

  it('lets the user withdraw the privacy consent', async () => {
    seedStore({
      settings: {
        followUpWeeks: 2,
        notificationsEnabled: true,
        theme: 'system',
        aiConsentAt: '2026-11-17T10:00:00.000Z',
      },
    })
    render(<AiKeySection />)
    expect(screen.getByText(/Zustimmung erteilt am 17\.11\.2026/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zustimmung widerrufen' }))
    expect(useAppStore.getState().data.settings.aiConsentAt).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zustimmung widerrufen' })).not.toBeInTheDocument()
  })
})
