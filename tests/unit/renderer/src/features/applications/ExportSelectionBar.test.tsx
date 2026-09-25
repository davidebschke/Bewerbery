import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExportSelectionBar } from '../../../../../../src/renderer/src/features/applications/ExportSelectionBar'

describe('ExportSelectionBar', () => {
  it('shows the selection count and toggles select-all', async () => {
    const onToggleSelectAll = vi.fn()
    render(
      <ExportSelectionBar
        selectedCount={1}
        totalCount={3}
        exporting={false}
        onToggleSelectAll={onToggleSelectAll}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('(1 von 3 ausgewählt)')).toBeInTheDocument()
    const selectAll = screen.getByRole('checkbox', { name: /Alle auswählen/ })
    expect(selectAll).not.toBeChecked()
    expect(selectAll).toHaveProperty('indeterminate', true)

    await userEvent.click(selectAll)
    expect(onToggleSelectAll).toHaveBeenCalled()
  })

  it('marks the checkbox as fully checked once everything is selected', () => {
    render(
      <ExportSelectionBar
        selectedCount={2}
        totalCount={2}
        exporting={false}
        onToggleSelectAll={vi.fn()}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const selectAll = screen.getByRole('checkbox', { name: /Alle auswählen/ })
    expect(selectAll).toBeChecked()
    expect(selectAll).toHaveProperty('indeterminate', false)
  })

  it('disables select-all and export when there is nothing to select', () => {
    render(
      <ExportSelectionBar
        selectedCount={0}
        totalCount={0}
        exporting={false}
        onToggleSelectAll={vi.fn()}
        onExport={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: /Alle auswählen/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PDF erstellen' })).toBeDisabled()
  })

  it('shows a busy label while exporting and reports export/cancel clicks', async () => {
    const onExport = vi.fn()
    const onCancel = vi.fn()
    render(
      <ExportSelectionBar
        selectedCount={1}
        totalCount={1}
        exporting
        onToggleSelectAll={vi.fn()}
        onExport={onExport}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole('button', { name: 'Wird erstellt …' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
