import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { applyRewrites } from '@shared/domain/cv/rewrite'
import { makeAssessment, makeCvSource } from '@shared/testing/cvFixtures'
import { VariantColumn } from '../../../../../../src/renderer/src/features/cv-optimization/VariantColumn'

const source = makeCvSource()
const rewrites = { p3: ['Frontend-Entwickler: ', 'Baute Webanwendungen mit React.'] }

describe('VariantColumn', () => {
  it('shows score, delta, keywords, changes and the highlighted text', () => {
    render(
      <VariantColumn
        title="ATS-optimiert"
        assessment={makeAssessment(83)}
        delta={29}
        best
        paragraphs={applyRewrites(source, rewrites)}
        changedIds={new Set(['p3'])}
        changes={['Begriffe der Stellenanzeige übernommen']}
      />,
    )
    const column = screen.getByRole('article', { name: 'ATS-optimiert' })
    expect(within(column).getByText('Beste Übereinstimmung')).toBeInTheDocument()
    expect(within(column).getByRole('img', { name: 'Übereinstimmung 83 von 100' })).toBeVisible()
    expect(within(column).getByLabelText('+29 Punkte gegenüber dem Original')).toBeVisible()
    expect(within(column).getByText('Abgedeckt').nextSibling).toHaveTextContent('React')
    expect(within(column).getByText('Fehlt').nextSibling).toHaveTextContent('Vitest')
    expect(within(column).getByText('Begriffe der Stellenanzeige übernommen')).toBeVisible()

    const text = within(column).getByLabelText('Text: ATS-optimiert')
    const changed = within(text).getByText('Frontend-Entwickler: Baute Webanwendungen mit React.')
    expect(changed).toHaveAttribute('data-changed', 'true')
    expect(within(text).getByText('2019 – 2023')).toHaveClass('text-muted')
    expect(within(column).queryByRole('button')).not.toBeInTheDocument()
  })

  it('warns about invented numbers and longer text', () => {
    render(
      <VariantColumn
        title="Wirkungsstark"
        assessment={makeAssessment(70, { coveredKeywords: [], missingKeywords: [] })}
        delta={-2}
        paragraphs={source.paragraphs}
        inventedNumbers={['12', '30 %']}
        lengthRatio={1.24}
      />,
    )
    expect(screen.getByText('Bitte prüfen: 12, 30 % steht nicht im Original.')).toBeVisible()
    expect(screen.getByText(/Text ist 24 % länger/)).toBeVisible()
    expect(screen.queryByText('Abgedeckt')).not.toBeInTheDocument()
    expect(screen.queryByText('Beste Übereinstimmung')).not.toBeInTheDocument()
  })

  it('offers save, attach and copy actions', async () => {
    const actions = { onSave: vi.fn(), onAttach: vi.fn(), onCopy: vi.fn() }
    const { rerender } = render(
      <VariantColumn
        title="Sachlich"
        assessment={makeAssessment(71)}
        delta={17}
        paragraphs={source.paragraphs}
        actions={actions}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Speichern unter …' }))
    await userEvent.click(screen.getByRole('button', { name: 'An Bewerbung speichern' }))
    await userEvent.click(screen.getByRole('button', { name: 'Text kopieren' }))
    expect(actions.onSave).toHaveBeenCalled()
    expect(actions.onAttach).toHaveBeenCalled()
    expect(actions.onCopy).toHaveBeenCalled()

    rerender(
      <VariantColumn
        title="Sachlich"
        assessment={makeAssessment(71)}
        delta={17}
        paragraphs={source.paragraphs}
        actions={{ onSave: vi.fn(), onCopy: vi.fn(), busy: true }}
      />,
    )
    expect(screen.queryByRole('button', { name: 'An Bewerbung speichern' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Speichern unter …' })).toBeDisabled()
  })
})
