import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from '../../../../../../src/renderer/src/features/applications/Toolbar'

describe('Toolbar', () => {
  it('reports search input and filter changes', async () => {
    const onSearch = vi.fn()
    const onFilter = vi.fn()
    render(
      <Toolbar
        search=""
        onSearch={onSearch}
        filter="all"
        onFilter={onFilter}
        selectionMode={false}
        onStartExport={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText('Bewerbungen durchsuchen'), 'a')
    expect(onSearch).toHaveBeenCalledWith('a')

    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Termin' }))
    expect(onFilter).toHaveBeenCalledWith('interview')
  })

  it('starts the export selection and hides the button while selecting', async () => {
    const onStartExport = vi.fn()
    const { rerender } = render(
      <Toolbar
        search=""
        onSearch={vi.fn()}
        filter="all"
        onFilter={vi.fn()}
        selectionMode={false}
        onStartExport={onStartExport}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Als PDF exportieren' }))
    expect(onStartExport).toHaveBeenCalled()

    rerender(
      <Toolbar
        search=""
        onSearch={vi.fn()}
        filter="all"
        onFilter={vi.fn()}
        selectionMode
        onStartExport={onStartExport}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Als PDF exportieren' })).not.toBeInTheDocument()
  })
})
