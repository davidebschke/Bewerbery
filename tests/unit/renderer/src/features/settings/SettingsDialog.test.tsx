import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'
import { SettingsDialog } from '../../../../../../src/renderer/src/features/settings/SettingsDialog'

const settings = () => useAppStore.getState().data.settings

describe('SettingsDialog', () => {
  it('changes follow-up weeks, notifications and theme', async () => {
    seedStore()
    render(<SettingsDialog open onClose={() => {}} />)
    expect(screen.getByText('2 Wochen')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Melden nach/), { target: { value: '1' } })
    expect(settings().followUpWeeks).toBe(1)
    expect(screen.getByText('1 Woche', { selector: 'span.text-brand' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Erinnerungen' }))
    expect(settings().notificationsEnabled).toBe(false)

    await userEvent.click(screen.getByLabelText('Dunkel'))
    expect(settings().theme).toBe('dark')
  })
})
