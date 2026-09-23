import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication, makeSettings } from '@shared/testing/fixtures'
import type { Application } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { makeDocument } from '../../test/mockApi'
import { freezeToday, seedStore } from '../../test/utils'
import { ApplicationCard } from './ApplicationCard'

const settings = makeSettings({ followUpWeeks: 2 })
let today: Date

function renderCard(
  application: Application,
  props: { pinned?: boolean; onEdit?: () => void } = {},
) {
  seedStore({ applications: [application] })
  const onEdit = props.onEdit ?? vi.fn()
  render(
    <ApplicationCard
      application={application}
      settings={settings}
      today={today}
      pinned={props.pinned}
      onEdit={onEdit}
    />,
  )
  return {
    onEdit,
    card: screen.getByRole('article', { name: `Bewerbung bei ${application.company}` }),
  }
}

beforeEach(() => {
  today = freezeToday()
})

describe('ApplicationCard', () => {
  it('shows company, contact links and follow-up progress', () => {
    const { card } = renderCard(
      makeApplication({
        company: 'ACME',
        position: 'Entwickler',
        contactName: 'Frau Roth',
        contactPhone: '+49 30 123',
        contactEmail: 'roth@acme.de',
        sentAt: '2026-09-16',
        notes: 'Nett am Telefon',
        documents: [makeDocument()],
      }),
    )
    expect(within(card).getByRole('heading', { name: 'ACME' })).toBeInTheDocument()
    expect(within(card).getByText('Entwickler')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '+49 30 123' })).toHaveAttribute(
      'href',
      'tel:+4930123',
    )
    expect(within(card).getByRole('link', { name: 'roth@acme.de' })).toHaveAttribute(
      'href',
      'mailto:roth@acme.de',
    )
    expect(within(card).getByText('1 Dokument')).toBeInTheDocument()
    expect(within(card).getByText('Nett am Telefon')).toBeInTheDocument()
    expect(within(card).getByText(/vor 7 Tagen/)).toBeInTheDocument()
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(within(card).getByText('Beworben', { selector: 'header span' })).toBeInTheDocument()
  })

  it('marks pinned cards and follows up', async () => {
    const app = makeApplication({
      company: 'Due AG',
      sentAt: '2026-08-01',
      documents: [makeDocument('a'), makeDocument('b')],
    })
    const { card } = renderCard(app, { pinned: true })
    expect(within(card).getByText('Melden fällig')).toBeInTheDocument()
    expect(within(card).getByText('2 Dokumente')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Nachgefragt' }))
    expect(useAppStore.getState().data.applications[0].lastFollowUpAt).toBe('2026-09-23')
  })

  it('shows interview details with and without date', () => {
    renderCard(
      makeApplication({ company: 'Mit', stage: 'interview', appointmentAt: '2026-10-01T09:30' }),
    )
    expect(screen.getByText(/Termin am 01.10.2026 um 09:30 Uhr/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nachgefragt' })).not.toBeInTheDocument()
  })

  it('shows open interview date, offers and rejections', () => {
    renderCard(makeApplication({ company: 'Ohne', stage: 'interview' }))
    expect(screen.getByText(/Datum noch offen/)).toBeInTheDocument()
  })

  it('shows offers', () => {
    renderCard(makeApplication({ company: 'Top', stage: 'offer' }))
    expect(screen.getByText(/Angebot erhalten/)).toBeInTheDocument()
  })

  it('dims rejected applications', () => {
    const { card } = renderCard(makeApplication({ company: 'Nope', stage: 'rejected' }))
    expect(card.className).toContain('opacity-75')
  })

  it('calls onEdit', async () => {
    const app = makeApplication({ company: 'Edit' })
    const { onEdit } = renderCard(app)
    await userEvent.click(screen.getByRole('button', { name: 'Edit bearbeiten' }))
    expect(onEdit).toHaveBeenCalledWith(app)
  })

  it('asks before deleting', async () => {
    renderCard(makeApplication({ company: 'Weg' }))
    await userEvent.click(screen.getByRole('button', { name: 'Weg löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(useAppStore.getState().data.applications).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Weg löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }))
    expect(useAppStore.getState().data.applications).toHaveLength(0)
  })

  it('closes the delete dialog via its close button', async () => {
    renderCard(makeApplication({ company: 'Bleibt' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bleibt löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
