import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import { CvInputPanel } from '../../../../../../src/renderer/src/features/cv-optimization/CvInputPanel'
import { useCvOptimization } from '../../../../../../src/renderer/src/features/cv-optimization/useCvOptimization'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { installMockApi, type MockApi } from '../../../../../../src/renderer/src/test/mockApi'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'

let api: MockApi
const configured = { configured: true, hint: 'abcd', encryptionAvailable: true }

beforeEach(() => {
  api = installMockApi()
})

function Harness({ onOpenSettings = vi.fn() }: { onOpenSettings?: () => void }) {
  const state = useCvOptimization()
  return (
    <>
      <CvInputPanel state={state} onOpenSettings={onOpenSettings} />
      <span data-testid="phase">{state.phase}</span>
    </>
  )
}

function seed() {
  seedStore({
    applications: [
      makeApplication({
        id: 'a1',
        company: 'Muster GmbH',
        position: 'Frontend-Entwickler',
        jobDescription: 'React',
      }),
    ],
  })
}

describe('CvInputPanel', () => {
  it('guides to the settings when no key is stored', async () => {
    seed()
    const onOpenSettings = vi.fn()
    render(<Harness onOpenSettings={onOpenSettings} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Zu den Einstellungen' }))
    expect(onOpenSettings).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Optimieren' })).toBeDisabled()
  })

  it('shows a read-only preview of the selected cv', async () => {
    seed()
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
    expect(screen.getByText('Lebenslauf.docx')).toBeInTheDocument()
    expect(screen.getByText(/DOCX · 5 Absätze/)).toBeInTheDocument()
    const preview = screen.getByLabelText('Vorschau des Lebenslaufs')
    expect(preview).toHaveTextContent(
      'Frontend-Entwickler: Entwicklung von Webanwendungen mit React.',
    )
    expect(screen.getByRole('button', { name: 'Andere Datei wählen' })).toBeInTheDocument()
  })

  it('explains why a pdf is rejected', async () => {
    seed()
    api.readCvFile.mockResolvedValueOnce({ ok: false, error: 'pdf-not-supported' })
    render(<Harness />)
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' })
    const zone = screen.getByTestId('cv-dropzone')
    fireEvent.dragOver(zone)
    fireEvent.dragLeave(zone)
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('PDF kann nicht mit Design bearbeitet werden')
    expect(alert).toHaveTextContent('als .docx')
    fireEvent.drop(zone, { dataTransfer: { files: [] } })
    expect(api.readCvFile).toHaveBeenCalledTimes(1)
  })

  it('takes over the job posting of an application and can save edits to it', async () => {
    seed()
    render(<Harness />)
    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
    const text = screen.getByLabelText('Text der Stellenanzeige')
    expect(text).toHaveValue('React')
    expect(screen.getByText('5 / 15.000 Zeichen')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'In Bewerbung speichern' })).not.toBeInTheDocument()

    await userEvent.type(text, ', TypeScript')
    await userEvent.click(screen.getByRole('button', { name: 'In Bewerbung speichern' }))
    expect(useAppStore.getState().data.applications[0].jobDescription).toBe('React, TypeScript')
    expect(useAppStore.getState().toasts.at(-1)?.message).toBe(
      'Stellenanzeige in der Bewerbung gespeichert.',
    )

    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), '')
    expect(screen.queryByRole('button', { name: 'In Bewerbung speichern' })).not.toBeInTheDocument()
  })

  it('reports an overly long job posting', async () => {
    seed()
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Text der Stellenanzeige'), {
      target: { value: 'x'.repeat(15_100) },
    })
    expect(screen.getByText('Die Stellenanzeige ist 100 Zeichen zu lang.')).toBeInTheDocument()
  })

  it('starts the optimization once everything is ready', async () => {
    seed()
    api.getAiKeyStatus.mockResolvedValue(configured)
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Lebenslauf wählen' }))
    await userEvent.selectOptions(screen.getByLabelText('Bewerbung (optional)'), 'a1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Optimieren' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Optimieren' }))
    expect(screen.getByTestId('phase')).toHaveTextContent('consent')
  })
})
