import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConsentDialog } from '../../../../../../src/renderer/src/features/cv-optimization/ConsentDialog'

describe('ConsentDialog', () => {
  it('explains what is sent and lets the user agree or cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConsentDialog open onConfirm={onConfirm} onCancel={onCancel} />)

    const dialog = screen.getByRole('dialog', { name: 'Daten werden an Anthropic gesendet' })
    expect(dialog).toHaveTextContent('Text deines Lebenslaufs')
    expect(dialog).toHaveTextContent('widerrufen')

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Zustimmen und senden' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    render(<ConsentDialog open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
