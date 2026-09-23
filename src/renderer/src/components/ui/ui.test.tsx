import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../stores/appStore'
import { Badge } from './Badge'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { EmptyState } from './EmptyState'
import { SelectField, TextArea, TextField } from './Field'
import { ProgressBar } from './ProgressBar'
import { TOAST_DURATION_MS, Toaster } from './Toaster'

describe('Button', () => {
  it('defaults to type=button and forwards props', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" size="sm" onClick={onClick}>
        Los
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Los' })
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} title="T" onClose={() => {}}>
        Inhalt
      </Dialog>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('focuses the first input and closes via escape, backdrop and button', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Titel" onClose={onClose} footer={<span>Fuß</span>} size="lg">
        <input aria-label="Feld" />
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'Titel' })).toBeInTheDocument()
    expect(screen.getByLabelText('Feld')).toHaveFocus()
    expect(screen.getByText('Fuß')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('dialog-backdrop'))
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('falls back to focusing a button and ignores other keys', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open title="Nur Text" onClose={onClose}>
        Text
      </Dialog>,
    )
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus()
    await userEvent.keyboard('a')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Fields', () => {
  it('links labels, errors and hints', () => {
    render(
      <>
        <TextField label="Name" error="Pflichtfeld" />
        <TextArea label="Notiz" hint="Optional" />
        <SelectField label="Wahl">
          <option>A</option>
        </SelectField>
      </>,
    )
    const name = screen.getByLabelText('Name')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Pflichtfeld')
    expect(screen.getByLabelText('Notiz')).toHaveAccessibleDescription('Optional')
    expect(screen.getByLabelText('Wahl')).not.toHaveAttribute('aria-describedby')
  })
})

describe('ProgressBar', () => {
  it('clamps values into 0..100', () => {
    const { rerender } = render(<ProgressBar value={1.7} label="P" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<ProgressBar value={-1} label="P" tone="due" pulse />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('Badge & EmptyState', () => {
  it('renders content', () => {
    render(
      <>
        <Badge tone="ok">Gut</Badge>
        <Badge>Neutral</Badge>
        <EmptyState icon="🚀" title="Leer">
          Hinweis
        </EmptyState>
        <EmptyState icon="🔍" title="Ohne Text" />
      </>,
    )
    expect(screen.getByText('Gut')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leer' })).toBeInTheDocument()
    expect(screen.getByText('Hinweis')).toBeInTheDocument()
  })
})

describe('Toaster', () => {
  it('shows toasts, dismisses on click and automatically', async () => {
    vi.useFakeTimers()
    render(<Toaster />)
    act(() => {
      useAppStore.getState().pushToast('xp', '+10 XP')
      useAppStore.getState().pushToast('error', 'Fehler')
      useAppStore.getState().pushToast('level', 'Level-Up')
      useAppStore.getState().pushToast('info', 'Info')
    })
    expect(screen.getByText('+10 XP')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Fehler'))
    expect(screen.queryByText('Fehler')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))
    expect(screen.queryByText('+10 XP')).not.toBeInTheDocument()
    expect(useAppStore.getState().toasts).toEqual([])
  })
})
