import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ImportWorkbook } from '@shared/types'
import {
  MappingStep,
  type MappingStepProps,
} from '../../../../../../src/renderer/src/features/import/MappingStep'

const workbook: ImportWorkbook = {
  fileName: 'liste.ods',
  sheets: [
    {
      name: 'Bewerbungen',
      rows: [
        ['Firma', 'Datum'],
        ['A', '03/04/2026'],
      ],
    },
    { name: '', rows: [] },
  ],
}

function renderStep(overrides: Partial<MappingStepProps> = {}) {
  const props: MappingStepProps = {
    workbook,
    sheetIndex: 0,
    onSheet: vi.fn(),
    headerRow: 0,
    onHeaderRow: vi.fn(),
    mapping: ['company', 'sentAt'],
    onTarget: vi.fn(),
    dateInfo: { order: 'dmy', ambiguous: true },
    dateOrder: 'dmy',
    onDateOrder: vi.fn(),
    dataRowCount: 1,
    ...overrides,
  }
  render(<MappingStep {...props} />)
  return props
}

describe('MappingStep', () => {
  it('shows file info, sheets, header choice, date order and missing fields', async () => {
    const props = renderStep()
    expect(screen.getByText('liste.ods')).toBeInTheDocument()
    expect(screen.getByText(/1 Datenzeile gefunden/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Pflichtfeld nicht zugeordnet: Position')

    await userEvent.selectOptions(screen.getByLabelText('Tabellenblatt'), '1')
    expect(props.onSheet).toHaveBeenCalledWith(1)
    expect(screen.getByRole('option', { name: 'Tabelle 2 (0 Zeilen)' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Kopfzeile'), 'none')
    expect(props.onHeaderRow).toHaveBeenCalledWith(null)
    await userEvent.selectOptions(screen.getByLabelText('Kopfzeile'), '1')
    expect(props.onHeaderRow).toHaveBeenCalledWith(1)

    await userEvent.selectOptions(screen.getByLabelText('Datumsformat'), 'mdy')
    expect(props.onDateOrder).toHaveBeenCalledWith('mdy')

    await userEvent.selectOptions(screen.getByLabelText('Ziel für Spalte Firma'), 'position')
    expect(props.onTarget).toHaveBeenCalledWith(0, 'position')
    expect(screen.getByText('03/04/2026')).toBeInTheDocument()
  })

  it('hides optional controls and handles empty columns', () => {
    renderStep({
      workbook: { ...workbook, sheets: [workbook.sheets[0]] },
      headerRow: null,
      mapping: ['company', 'position', 'sentAt', 'ignore'],
      dateInfo: { order: 'dmy', ambiguous: false },
      dataRowCount: 2,
    })
    expect(screen.queryByLabelText('Tabellenblatt')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Datumsformat')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText(/2 Datenzeilen gefunden/)).toBeInTheDocument()
    expect(screen.getAllByText('keine Werte')).toHaveLength(2)
    expect(screen.getByLabelText('Ziel für Spalte Spalte D')).toHaveValue('ignore')
  })

  it('reports tables without columns', () => {
    renderStep({ mapping: [], dataRowCount: 0 })
    expect(screen.getByText('Diese Tabelle enthält keine Spalten.')).toBeInTheDocument()
  })
})
