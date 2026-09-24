import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { installMockApi, makeDocument, type MockApi } from '../../../../../../src/renderer/src/test/mockApi'
import { freezeToday, seedStore } from '../../../../../../src/renderer/src/test/utils'
import { ApplicationForm } from '../../../../../../src/renderer/src/features/applications/ApplicationForm'

let api: MockApi
const state = () => useAppStore.getState()

beforeEach(() => {
  api = installMockApi()
  freezeToday()
})

function renderForm(application = undefined as ReturnType<typeof makeApplication> | undefined) {
  const onClose = vi.fn()
  render(<ApplicationForm application={application} onClose={onClose} />)
  return { onClose }
}

describe('ApplicationForm', () => {
  it('validates required fields and email', async () => {
    seedStore()
    renderForm()
    await userEvent.type(screen.getByLabelText('E-Mail'), 'falsch')
    await userEvent.click(screen.getByRole('button', { name: 'Bewerbung anlegen (+10 XP)' }))
    expect(screen.getByText('Unternehmen ist erforderlich')).toBeInTheDocument()
    expect(screen.getByText('Ungültige E-Mail-Adresse')).toBeInTheDocument()
    expect(state().data.applications).toHaveLength(0)
  })

  it('creates a new application with defaults and custom follow-up', async () => {
    seedStore()
    const { onClose } = renderForm()
    expect(screen.getByLabelText('Abgeschickt am *')).toHaveValue('2026-09-23')
    expect(screen.getByRole('option', { name: 'Standard (2 Wochen)' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Unternehmen *'), 'Neu GmbH')
    await userEvent.type(screen.getByLabelText('Position'), 'Designer')
    await userEvent.type(screen.getByLabelText('Ansprechpartner'), 'Herr Blau')
    await userEvent.type(screen.getByLabelText('Telefon'), '0301234')
    await userEvent.type(screen.getByLabelText('E-Mail'), 'blau@neu.de')
    await userEvent.type(screen.getByLabelText('Notizen'), 'Remote möglich')
    await userEvent.selectOptions(screen.getByLabelText('Melden nach'), '3')
    await userEvent.click(screen.getByRole('button', { name: 'Bewerbung anlegen (+10 XP)' }))

    expect(state().data.applications[0]).toMatchObject({
      company: 'Neu GmbH',
      position: 'Designer',
      contactName: 'Herr Blau',
      contactPhone: '0301234',
      contactEmail: 'blau@neu.de',
      notes: 'Remote möglich',
      followUpWeeks: 3,
      sentAt: '2026-09-23',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows singular week label for a 1-week default', () => {
    seedStore({ settings: { followUpWeeks: 1, notificationsEnabled: true, theme: 'system' } })
    renderForm()
    expect(screen.getByRole('option', { name: 'Standard (1 Woche)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '1 Woche' })).toBeInTheDocument()
  })

  it('edits an existing application and removes documents on save', async () => {
    const doc = makeDocument('alt.pdf')
    const app = makeApplication({ company: 'Alt', followUpWeeks: 4, documents: [doc] })
    seedStore({ applications: [app] })
    renderForm(app)

    expect(screen.getByRole('dialog', { name: 'Bewerbung bearbeiten' })).toBeInTheDocument()
    expect(screen.getByLabelText('Melden nach')).toHaveValue('4')
    await userEvent.click(screen.getByRole('button', { name: 'alt.pdf entfernen' }))
    const company = screen.getByLabelText('Unternehmen *')
    await userEvent.clear(company)
    await userEvent.type(company, 'Neu')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(state().data.applications[0]).toMatchObject({ company: 'Neu', documents: [] })
    expect(api.removeDocument).toHaveBeenCalledWith(app.id, doc)
  })

  it('adds documents via picker and drag & drop', async () => {
    seedStore()
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }))
    expect(await screen.findByRole('button', { name: 'Lebenslauf.pdf öffnen' })).toBeInTheDocument()

    const zone = screen.getByTestId('document-dropzone')
    fireEvent.dragOver(zone)
    fireEvent.dragLeave(zone)
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'Zeugnis.pdf')] } })
    expect(await screen.findByText('Zeugnis.pdf')).toBeInTheDocument()
    expect(api.importDocuments).toHaveBeenCalledWith(expect.any(String), ['C:/drop/Zeugnis.pdf'])

    await userEvent.type(screen.getByLabelText('Unternehmen *'), 'Docs AG')
    await userEvent.click(screen.getByRole('button', { name: 'Bewerbung anlegen (+10 XP)' }))
    expect(state().data.applications[0].documents.map((d) => d.name)).toEqual([
      'Lebenslauf.pdf',
      'Zeugnis.pdf',
    ])
  })

  it('ignores empty drops and cancelled pickers', async () => {
    seedStore()
    api.pickDocuments.mockResolvedValueOnce([])
    renderForm()
    fireEvent.drop(screen.getByTestId('document-dropzone'), { dataTransfer: { files: [] } })
    await userEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }))
    expect(api.importDocuments).not.toHaveBeenCalled()
    expect(screen.queryByRole('list', { name: 'Dokumente' })).not.toBeInTheDocument()
  })

  it('opens documents and reports errors', async () => {
    const doc = makeDocument('cv.pdf')
    const app = makeApplication({ documents: [doc] })
    seedStore({ applications: [app] })
    renderForm(app)

    await userEvent.click(screen.getByRole('button', { name: 'cv.pdf öffnen' }))
    expect(api.openDocument).toHaveBeenCalledWith(app.id, doc)

    api.openDocument.mockRejectedValueOnce(new Error('weg'))
    await userEvent.click(screen.getByRole('button', { name: 'cv.pdf öffnen' }))
    await waitFor(() => expect(state().toasts.at(-1)?.message).toContain('konnte nicht geöffnet'))

    api.pickDocuments.mockRejectedValueOnce(new Error('kaputt'))
    await userEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }))
    await waitFor(() => expect(state().toasts.at(-1)?.message).toContain('nicht hinzugefügt'))
  })

  it('cleans up added documents when a new application is cancelled', async () => {
    seedStore()
    const { onClose } = renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }))
    await screen.findByText('Lebenslauf.pdf')
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    )
    expect(api.removeAllDocuments).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('cancels a new application without documents quietly', async () => {
    seedStore()
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(api.removeAllDocuments).not.toHaveBeenCalled()
  })

  it('removes only newly added documents when editing is cancelled', async () => {
    const app = makeApplication({ documents: [makeDocument('alt.pdf')] })
    seedStore({ applications: [app] })
    renderForm(app)
    await userEvent.click(screen.getByRole('button', { name: 'Dateien auswählen' }))
    await screen.findByText('Lebenslauf.pdf')
    await userEvent.keyboard('{Escape}')
    expect(api.removeDocument).toHaveBeenCalledTimes(1)
    expect(api.removeDocument.mock.calls[0][1].name).toBe('Lebenslauf.pdf')
    expect(state().data.applications[0].documents.map((d) => d.name)).toEqual(['alt.pdf'])
  })
})
