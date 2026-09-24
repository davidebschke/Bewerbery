import confetti from 'canvas-confetti'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import { App } from '../../../../src/renderer/src/App'
import { useAppStore } from '../../../../src/renderer/src/stores/appStore'
import { installMockApi, type MockApi } from '../../../../src/renderer/src/test/mockApi'
import { freezeToday } from '../../../../src/renderer/src/test/utils'

let api: MockApi

beforeEach(() => {
  freezeToday()
  useAppStore.setState({ status: 'loading' })
})

function renderWith(data = makeData()) {
  api = installMockApi(data)
  return render(<App />)
}

describe('App', () => {
  it('shows a loading state, then the empty state', async () => {
    renderWith()
    expect(screen.getByRole('status')).toHaveTextContent('wird geladen')
    expect(await screen.findByText('Deine Jobsuche startet hier')).toBeInTheDocument()
  })

  it('shows load errors and retries', async () => {
    api = installMockApi()
    api.loadData.mockRejectedValueOnce(new Error('Datei gesperrt'))
    render(<App />)
    expect(await screen.findByText('Datei gesperrt')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    expect(await screen.findByText('Deine Jobsuche startet hier')).toBeInTheDocument()
  })

  it('creates the first application from the empty state', async () => {
    renderWith()
    await userEvent.click(await screen.findByRole('button', { name: /Erste Bewerbung anlegen/ }))
    await userEvent.type(screen.getByLabelText('Unternehmen *'), 'Start AG')
    await userEvent.click(screen.getByRole('button', { name: 'Bewerbung anlegen (+10 XP)' }))
    expect(screen.getByRole('article', { name: 'Bewerbung bei Start AG' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Deine Bewerbungen' })).toBeInTheDocument()
    expect(api.saveData).toHaveBeenCalled()
  })

  it('pins due applications above the others', async () => {
    renderWith(
      makeData({
        applications: [
          makeApplication({ company: 'Frisch', sentAt: '2026-09-22' }),
          makeApplication({ company: 'Fällig', sentAt: '2026-08-01' }),
        ],
      }),
    )
    const pinned = await screen.findByRole('region', { name: /Jetzt melden/ })
    expect(
      within(pinned).getByRole('article', { name: 'Bewerbung bei Fällig' }),
    ).toBeInTheDocument()
    const others = screen.getByRole('region', { name: 'Weitere Bewerbungen' })
    expect(
      within(others).getByRole('article', { name: 'Bewerbung bei Frisch' }),
    ).toBeInTheDocument()
    // Gepinnter Bereich steht im Dokument vor der restlichen Liste
    expect(pinned.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('filters, searches and shows an empty result', async () => {
    renderWith(
      makeData({
        applications: [
          makeApplication({ company: 'Alpha' }),
          makeApplication({ company: 'Beta', stage: 'offer' }),
        ],
      }),
    )
    await screen.findByRole('article', { name: 'Bewerbung bei Alpha' })

    await userEvent.click(screen.getByRole('button', { name: 'Angebot' }))
    expect(screen.queryByRole('article', { name: 'Bewerbung bei Alpha' })).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Bewerbung bei Beta' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Bewerbungen durchsuchen'), 'zzz')
    expect(screen.getByText('Nichts gefunden')).toBeInTheDocument()
  })

  it('opens edit form, settings and badges', async () => {
    renderWith(makeData({ applications: [makeApplication({ company: 'Edit AG' })] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit AG bearbeiten' }))
    expect(screen.getByRole('dialog', { name: 'Bewerbung bearbeiten' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    await userEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))
    expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))

    await userEvent.click(screen.getByRole('button', { name: /Erfolge anzeigen/ }))
    expect(screen.getByRole('dialog', { name: /Deine Erfolge/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Neue Bewerbung/ }))
    expect(screen.getByRole('dialog', { name: 'Neue Bewerbung' })).toBeInTheDocument()
  })

  it('celebrates interviews with confetti', async () => {
    renderWith(makeData({ applications: [makeApplication({ company: 'Party' })] }))
    await screen.findByRole('article', { name: 'Bewerbung bei Party' })
    const id = useAppStore.getState().data.applications[0].id
    act(() => useAppStore.getState().setStage(id, 'offer'))
    expect(vi.mocked(confetti)).toHaveBeenCalled()
  })

  it('exports selected applications as pdf', async () => {
    renderWith(
      makeData({
        applications: [
          makeApplication({ company: 'Erste GmbH' }),
          makeApplication({ company: 'Zweite GmbH' }),
        ],
      }),
    )
    await screen.findByRole('article', { name: 'Bewerbung bei Erste GmbH' })
    const ids = useAppStore.getState().data.applications.map((application) => application.id)

    await userEvent.click(screen.getByRole('button', { name: 'Als PDF exportieren' }))
    expect(screen.queryByRole('button', { name: 'Als PDF exportieren' })).not.toBeInTheDocument()

    const firstCheckbox = screen.getByRole('checkbox', { name: 'Erste GmbH auswählen' })
    await userEvent.click(firstCheckbox)
    expect(screen.getByText('(1 von 2 ausgewählt)')).toBeInTheDocument()

    // Erneutes Klicken hebt die Auswahl der Karte wieder auf
    await userEvent.click(firstCheckbox)
    expect(screen.getByText('(0 von 2 ausgewählt)')).toBeInTheDocument()
    await userEvent.click(firstCheckbox)

    await userEvent.click(screen.getByRole('button', { name: 'PDF erstellen' }))
    expect(api.exportApplicationsPdf).toHaveBeenCalledWith([ids[0]])
    expect(await screen.findByText('PDF wurde erstellt.')).toBeInTheDocument()
    // Auswahlmodus wird nach erfolgreichem Export beendet
    expect(await screen.findByRole('button', { name: 'Als PDF exportieren' })).toBeInTheDocument()
  })

  it('selects all visible applications and cancels the selection', async () => {
    renderWith(
      makeData({
        applications: [
          makeApplication({ company: 'Alpha AG' }),
          makeApplication({ company: 'Beta AG' }),
        ],
      }),
    )
    await screen.findByRole('article', { name: 'Bewerbung bei Alpha AG' })

    await userEvent.click(screen.getByRole('button', { name: 'Als PDF exportieren' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Alle auswählen/ }))
    expect(screen.getByText('(2 von 2 ausgewählt)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.getByRole('button', { name: 'Als PDF exportieren' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('keeps the selection open and shows no toast when the save dialog is cancelled', async () => {
    renderWith(makeData({ applications: [makeApplication({ company: 'Abbruch AG' })] }))
    await screen.findByRole('article', { name: 'Bewerbung bei Abbruch AG' })
    api.exportApplicationsPdf.mockResolvedValueOnce({ canceled: true })

    await userEvent.click(screen.getByRole('button', { name: 'Als PDF exportieren' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Alle auswählen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'PDF erstellen' }))

    await screen.findByRole('button', { name: 'PDF erstellen' })
    expect(screen.queryByText('PDF wurde erstellt.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument()
  })

  it('shows an error toast and keeps the selection when the export fails', async () => {
    renderWith(makeData({ applications: [makeApplication({ company: 'Fehler AG' })] }))
    await screen.findByRole('article', { name: 'Bewerbung bei Fehler AG' })
    api.exportApplicationsPdf.mockRejectedValueOnce(new Error('kaputt'))

    await userEvent.click(screen.getByRole('button', { name: 'Als PDF exportieren' }))
    await userEvent.click(screen.getByRole('checkbox', { name: /Alle auswählen/ }))
    await userEvent.click(screen.getByRole('button', { name: 'PDF erstellen' }))

    expect(await screen.findByText('PDF konnte nicht erstellt werden.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument()
  })
})
