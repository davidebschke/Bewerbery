import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeAssessment, makeCvResult } from '@shared/testing/cvFixtures'
import { ComparisonView } from '../../../../../../src/renderer/src/features/cv-optimization/ComparisonView'

function renderView(result = makeCvResult(), canAttach = true) {
  const handlers = { onSave: vi.fn(), onAttach: vi.fn(), onCopy: vi.fn() }
  render(<ComparisonView result={result} canAttach={canAttach} {...handlers} />)
  return handlers
}

describe('ComparisonView', () => {
  it('shows original and all three variants with title and date', () => {
    renderView()
    expect(
      screen.getByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Optimiert am 17\.11\.2026.*Lebenslauf\.docx/)).toBeInTheDocument()
    const columns = screen.getAllByRole('article')
    const titles = columns.map(
      (column) => within(column).getByRole('heading', { level: 3 }).textContent,
    )
    expect(titles).toEqual(['Original', 'Sachlich', 'Wirkungsstark', 'ATS-optimiert'])
    expect(within(columns[0]).queryByRole('button')).not.toBeInTheDocument()
    expect(within(columns[3]).getByText('Beste Übereinstimmung')).toBeInTheDocument()
    expect(within(columns[3]).getByLabelText('+29 Punkte gegenüber dem Original')).toBeVisible()
  })

  it('switches versions via tabs and arrow keys on narrow windows', async () => {
    renderView()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ])
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels[3]).toHaveClass('flex')
    expect(panels[0]).toHaveClass('hidden', 'md:flex')

    await userEvent.click(tabs[0])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(panels[0]).toHaveClass('flex')

    tabs[0].focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[3]).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(tabs[0]).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('passes the variant style to the actions', async () => {
    const handlers = renderView()
    const ats = screen.getAllByRole('article')[3]
    await userEvent.click(within(ats).getByRole('button', { name: 'Speichern unter …' }))
    await userEvent.click(within(ats).getByRole('button', { name: 'An Bewerbung speichern' }))
    await userEvent.click(within(ats).getByRole('button', { name: 'Text kopieren' }))
    expect(handlers.onSave).toHaveBeenCalledWith('ats')
    expect(handlers.onAttach).toHaveBeenCalledWith('ats')
    expect(handlers.onCopy).toHaveBeenCalledWith('ats')
  })

  it('hides attaching without application and explains when no variant is better', () => {
    renderView(makeCvResult({ originalAssessment: makeAssessment(95), jobTitle: '' }), false)
    expect(screen.getByRole('heading', { name: 'Ergebnis der Optimierung' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Keine Variante übertrifft das Original')
    expect(screen.queryByText('Beste Übereinstimmung')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'An Bewerbung speichern' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
  })
})
