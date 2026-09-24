import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeApplication } from '@shared/testing/fixtures'
import { useAppStore } from '../../../../../../src/renderer/src/stores/appStore'
import { seedStore } from '../../../../../../src/renderer/src/test/utils'
import { StageControl } from '../../../../../../src/renderer/src/features/applications/StageControl'

const app = () => useAppStore.getState().data.applications[0]

function setup(overrides = {}) {
  const application = makeApplication({ company: 'ACME', ...overrides })
  seedStore({ applications: [application] })
  const view = render(<StageControl application={application} />)
  return { select: screen.getByLabelText('Status von ACME'), ...view }
}

describe('StageControl', () => {
  it('changes simple stages directly', async () => {
    const { select } = setup()
    await userEvent.selectOptions(select, 'offer')
    expect(app().stage).toBe('offer')
  })

  it('asks for an appointment when switching to interview', async () => {
    const { select } = setup()
    await userEvent.selectOptions(select, 'interview')
    expect(screen.getByRole('dialog', { name: /Termin eintragen/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Datum & Uhrzeit'), {
      target: { value: '2026-10-02T14:00' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Termin speichern' }))
    expect(app()).toMatchObject({ stage: 'interview', appointmentAt: '2026-10-02T14:00' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('allows an interview without date and cancelling', async () => {
    const { select } = setup()
    await userEvent.selectOptions(select, 'interview')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(app().stage).toBe('applied')

    await userEvent.selectOptions(select, 'interview')
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    await userEvent.selectOptions(select, 'interview')
    await userEvent.click(screen.getByRole('button', { name: 'Termin speichern' }))
    expect(app()).toMatchObject({ stage: 'interview', appointmentAt: null })
  })

  it('prefills an existing appointment', async () => {
    const { select } = setup({ stage: 'offer', appointmentAt: '2026-10-05T08:00' })
    await userEvent.selectOptions(select, 'interview')
    expect(screen.getByLabelText('Datum & Uhrzeit')).toHaveValue('2026-10-05T08:00')
  })
})
