import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from '../../../../../../src/renderer/src/features/applications/Toolbar'

describe('Toolbar', () => {
  it('reports search input and filter changes', async () => {
    const onSearch = vi.fn()
    const onFilter = vi.fn()
    render(<Toolbar search="" onSearch={onSearch} filter="all" onFilter={onFilter} />)

    await userEvent.type(screen.getByLabelText('Bewerbungen durchsuchen'), 'a')
    expect(onSearch).toHaveBeenCalledWith('a')

    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Termin' }))
    expect(onFilter).toHaveBeenCalledWith('interview')
  })
})
