import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import type { ImportWorkbook } from '@shared/types'
import { ImportDialog } from '../../../../../../src/renderer/src/features/import/ImportDialog'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import type { MockApi } from '../../../../../../src/renderer/src/test/mockApi'
import { freezeToday, seedStore } from '../../../../../../src/renderer/src/test/utils'

const state = () => useAppStore.getState()
const api = () => window.api as MockApi

const workbook: ImportWorkbook = {
  fileName: 'bewerbungen.ods',
  sheets: [
    { name: 'Leer', rows: [] },
    {
      name: 'Bewerbungen',
      rows: [
        ['Meine Liste'],
        ['Firma', 'Stelle', 'Datum', 'Status', 'Gehalt'],
        ['ACME', 'Dev', '01.09.2026', 'Absage', '50k'],
        ['Beta', '', '02.09.2026', 'Termin', ''],
        ['Alt GmbH', 'Ops', '03.09.2026', 'offen', ''],
        ['Gamma', 'QA', '', 'unklar', ''],
      ],
    },
    {
      name: 'US',
      rows: [
        ['Company', 'Position', 'Date'],
        ['Delta', 'PM', '03/04/2026'],
      ],
    },
  ],
}

function renderDialog() {
  const onClose = vi.fn()
  render(<ImportDialog onClose={onClose} />)
  return { onClose }
}

beforeEach(() => {
  freezeToday()
  seedStore({
    applications: [makeApplication({ company: 'Alt GmbH', position: 'Ops', sentAt: '2026-09-03' })],
  })
  useAppStore.setState({ toasts: [] })
})

describe('ImportDialog', () => {
  it('imports a spreadsheet through mapping and preview', async () => {
    api().pickImportFile.mockResolvedValueOnce(workbook)
    const { onClose } = renderDialog()
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    expect(await screen.findByText('Schritt 2 von 3')).toBeInTheDocument()
    // Erstes Blatt ist leer → das erste Blatt mit Daten wird gewählt, Kopfzeile = Zeile 2
    expect(screen.getByLabelText('Tabellenblatt')).toHaveValue('1')
    expect(screen.getByLabelText('Kopfzeile')).toHaveValue('1')
    expect(screen.getByLabelText('Ziel für Spalte Gehalt')).toHaveValue('appendNotes')

    await userEvent.click(screen.getByRole('button', { name: 'Weiter zur Vorschau' }))
    expect(screen.getByText('Schritt 3 von 3')).toBeInTheDocument()
    const summary = screen.getByLabelText('Zusammenfassung')
    expect(summary).toHaveTextContent('1 werden importiert')
    expect(summary).toHaveTextContent('2 mit Fehler')
    expect(summary).toHaveTextContent('1 Duplikate')

    // Fehlende Position ergänzen, Ersatzdatum setzen, Duplikat bewusst nicht importieren
    const beta = screen.getByRole('listitem', { name: 'Zeile 4' })
    await userEvent.type(within(beta).getByLabelText('Position *'), 'Design')
    await userEvent.type(screen.getByLabelText('Fehlendes Datum ersetzen durch'), '2026-09-10')
    expect(summary).toHaveTextContent('3 werden importiert')

    // Zeile abwählen und wieder anwählen
    const acme = within(screen.getByRole('listitem', { name: 'Zeile 3' })).getByRole('checkbox')
    await userEvent.click(acme)
    expect(summary).toHaveTextContent('2 werden importiert')
    await userEvent.click(acme)

    await userEvent.click(screen.getByRole('button', { name: '3 Bewerbungen importieren' }))
    expect(onClose).toHaveBeenCalled()
    const imported = state().data.applications.slice(1)
    expect(imported.map((app) => [app.company, app.position, app.sentAt, app.stage])).toEqual([
      ['ACME', 'Dev', '2026-09-01', 'rejected'],
      ['Beta', 'Design', '2026-09-02', 'interview'],
      ['Gamma', 'QA', '2026-09-10', 'applied'],
    ])
    expect(imported[0].notes).toBe('Gehalt: 50k')
    expect(imported[2].notes).toBe('Status: unklar')
    expect(state().toasts.map((toast) => toast.message)).toContain(
      '3 Bewerbungen importiert · 0 übersprungen · 1 Duplikat · +60 XP',
    )
    expect(api().saveData).toHaveBeenCalledTimes(1)
  })

  it('lets the user change sheet, header, date order and mapping', async () => {
    api().pickImportFile.mockResolvedValueOnce(workbook)
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))

    await userEvent.selectOptions(await screen.findByLabelText('Tabellenblatt'), '2')
    expect(screen.getByLabelText('Datumsformat')).toHaveValue('dmy')
    await userEvent.selectOptions(screen.getByLabelText('Datumsformat'), 'mdy')
    await userEvent.selectOptions(screen.getByLabelText('Ziel für Spalte Position'), 'notes')
    expect(screen.getByRole('alert')).toHaveTextContent('Position')
    await userEvent.selectOptions(screen.getByLabelText('Ziel für Spalte Position'), 'position')
    await userEvent.click(screen.getByRole('button', { name: 'Weiter zur Vorschau' }))
    expect(screen.getByLabelText('Beworben am *')).toHaveValue('2026-03-04')

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zur Zuordnung' }))
    await userEvent.selectOptions(screen.getByLabelText('Kopfzeile'), 'none')
    expect(screen.getByText(/2 Datenzeilen gefunden/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Andere Datei' }))
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument()
  })

  it('disables the next step without data rows and the import without valid rows', async () => {
    api().pickImportFile.mockResolvedValueOnce({
      fileName: 'a.csv',
      sheets: [{ name: 'Tabelle', rows: [['Firma', 'Stelle'], ['Nur Firma']] }],
    })
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Weiter zur Vorschau' }))
    expect(screen.getByRole('button', { name: '0 Bewerbungen importieren' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Zurück zur Zuordnung' }))
    await userEvent.selectOptions(screen.getByLabelText('Kopfzeile'), '1')
    expect(screen.getByRole('button', { name: 'Weiter zur Vorschau' })).toBeDisabled()
  })

  it('imports a single row with singular wording', async () => {
    api().pickImportFile.mockResolvedValueOnce({
      fileName: 'a.csv',
      sheets: [
        {
          name: 'Tabelle',
          rows: [
            ['Firma', 'Stelle', 'Datum'],
            ['Neu', 'Dev', '2026-09-01'],
          ],
        },
      ],
    })
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Weiter zur Vorschau' }))
    await userEvent.click(screen.getByRole('button', { name: '1 Bewerbung importieren' }))
    expect(state().toasts.map((toast) => toast.message)).toContain(
      '1 Bewerbung importiert · 0 übersprungen · 0 Duplikate · +10 XP',
    )
  })

  it('stays on the start step when the file dialog is cancelled or fails', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument()

    api().pickImportFile.mockRejectedValueOnce(
      new Error("Error invoking remote method 'import:pick-file': Error: Datei kaputt."),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Datei kaputt.')

    api().pickImportFile.mockRejectedValueOnce(new Error(''))
    await userEvent.click(screen.getByRole('button', { name: 'Datei auswählen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Datei konnte nicht gelesen werden.',
    )
  })

  it('downloads the template in the chosen format', async () => {
    const { onClose } = renderDialog()
    await userEvent.selectOptions(screen.getByLabelText('Format'), 'ods')
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage herunterladen' }))
    expect(api().saveImportTemplate).toHaveBeenCalledWith('ods')
    expect(state().toasts.at(-1)?.message).toBe('Vorlage gespeichert.')

    api().saveImportTemplate.mockResolvedValueOnce({ canceled: true })
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage herunterladen' }))
    expect(state().toasts).toHaveLength(1)

    api().saveImportTemplate.mockRejectedValueOnce(new Error('x'))
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage herunterladen' }))
    expect(state().toasts.at(-1)?.message).toBe('Vorlage konnte nicht gespeichert werden.')

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onClose).toHaveBeenCalled()
  })
})
