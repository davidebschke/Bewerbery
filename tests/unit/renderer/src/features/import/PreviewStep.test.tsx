import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ImportDraft } from '@shared/domain/import/rows'
import { PreviewStep } from '../../../../../../src/renderer/src/features/import/PreviewStep'
import { previewState } from '../../../../../../src/renderer/src/features/import/wizard'

function draft(rowNumber: number, overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    rowNumber,
    company: 'ACME',
    position: 'Dev',
    sentAt: '2026-09-01',
    stage: 'applied',
    lastFollowUpAt: null,
    followUpWeeks: null,
    appointmentAt: null,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
    warnings: [],
    ...overrides,
  }
}

const drafts = [
  draft(2, {
    contactName: 'Frau A',
    contactEmail: 'a@acme.de',
    contactPhone: '030',
    lastFollowUpAt: '2026-09-10',
    followUpWeeks: 1,
    appointmentAt: '2026-09-20T14:30',
    notes: 'Zeile 1\nZeile 2',
  }),
  draft(3, { warnings: ['Status: „x“ nicht erkannt'], followUpWeeks: 3 }),
  draft(4, { company: '', position: '', sentAt: '' }),
  draft(5),
]

function renderPreview(fallback = '') {
  const handlers = { onFallbackSentAt: vi.fn(), onToggle: vi.fn(), onEdit: vi.fn() }
  const preview = previewState(drafts, new Set([5]), new Set([5]), fallback)
  render(<PreviewStep preview={preview} fallbackSentAt={fallback} {...handlers} />)
  return handlers
}

describe('PreviewStep', () => {
  it('summarises and shows every row with status and details', () => {
    renderPreview()
    const summary = screen.getByLabelText('Zusammenfassung')
    expect(summary).toHaveTextContent('2 werden importiert')
    expect(summary).toHaveTextContent('1 mit Fehler')
    expect(summary).toHaveTextContent('1 mit Hinweis')
    expect(summary).toHaveTextContent('1 Duplikate')

    const first = screen.getByRole('listitem', { name: 'Zeile 2' })
    expect(within(first).getByText('✅ Bereit')).toBeInTheDocument()
    expect(within(first).getByText('10.09.2026')).toBeInTheDocument()
    expect(within(first).getByText('1 Woche')).toBeInTheDocument()
    expect(within(first).getByText('20.09.2026 um 14:30 Uhr')).toBeInTheDocument()

    const warning = screen.getByRole('listitem', { name: 'Zeile 3' })
    expect(within(warning).getByText('⚠️ Hinweis')).toBeInTheDocument()
    expect(within(warning).getByText('3 Wochen')).toBeInTheDocument()
    expect(within(warning).getByText(/Status: „x“ nicht erkannt/)).toBeInTheDocument()

    const error = screen.getByRole('listitem', { name: 'Zeile 4' })
    expect(within(error).getByText('❌ Fehler')).toBeInTheDocument()
    expect(within(error).getByText('Unternehmen fehlt')).toBeInTheDocument()
    expect(within(error).getByText('Position fehlt')).toBeInTheDocument()
    expect(within(error).getByText('Datum fehlt')).toBeInTheDocument()
    expect(within(error).getByRole('checkbox')).toBeDisabled()

    const duplicate = screen.getByRole('listitem', { name: 'Zeile 5' })
    expect(within(duplicate).getByText('⧉ Duplikat')).toBeInTheDocument()
    expect(within(duplicate).getByRole('checkbox')).not.toBeChecked()
  })

  it('forwards edits, toggles and the fallback date', async () => {
    const handlers = renderPreview()
    const error = screen.getByRole('listitem', { name: 'Zeile 4' })
    await userEvent.type(within(error).getByLabelText('Unternehmen *'), 'N')
    expect(handlers.onEdit).toHaveBeenCalledWith(4, { company: 'N' })
    await userEvent.type(within(error).getByLabelText('Position *'), 'P')
    expect(handlers.onEdit).toHaveBeenCalledWith(4, { position: 'P' })
    await userEvent.type(within(error).getByLabelText('Beworben am *'), '2026-09-05')
    expect(handlers.onEdit).toHaveBeenCalledWith(4, { sentAt: '2026-09-05' })
    await userEvent.selectOptions(within(error).getByLabelText('Status'), 'offer')
    expect(handlers.onEdit).toHaveBeenCalledWith(4, { stage: 'offer' })

    await userEvent.click(
      within(screen.getByRole('listitem', { name: 'Zeile 5' })).getByRole('checkbox'),
    )
    expect(handlers.onToggle).toHaveBeenCalledWith(5)

    const fallback = screen.getByLabelText('Fehlendes Datum ersetzen durch')
    expect(screen.getByText('Gilt für 1 Zeile ohne gültiges Datum.')).toBeInTheDocument()
    await userEvent.type(fallback, '2026-09-01')
    expect(handlers.onFallbackSentAt).toHaveBeenCalledWith('2026-09-01')
  })

  it('filters to problem rows', async () => {
    renderPreview()
    await userEvent.click(
      screen.getByLabelText('Nur Zeilen mit Fehlern, Hinweisen oder Duplikaten'),
    )
    expect(screen.queryByRole('listitem', { name: 'Zeile 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Zeile 3' })).toBeInTheDocument()
  })

  it('shows a message when no problem rows exist and hides the fallback field', async () => {
    const preview = previewState([draft(2), draft(3)], new Set(), new Set(), '')
    render(
      <PreviewStep
        preview={preview}
        fallbackSentAt=""
        onFallbackSentAt={vi.fn()}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('Fehlendes Datum ersetzen durch')).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByLabelText('Nur Zeilen mit Fehlern, Hinweisen oder Duplikaten'),
    )
    expect(
      screen.getByText('Keine Zeilen mit Fehlern, Hinweisen oder Duplikaten.'),
    ).toBeInTheDocument()
  })

  it('uses plural wording for several rows without date', () => {
    const preview = previewState(
      [draft(2, { sentAt: '' }), draft(3, { sentAt: '' })],
      new Set(),
      new Set(),
      '',
    )
    render(
      <PreviewStep
        preview={preview}
        fallbackSentAt=""
        onFallbackSentAt={vi.fn()}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
      />,
    )
    expect(screen.getByText('Gilt für 2 Zeilen ohne gültiges Datum.')).toBeInTheDocument()
  })
})
