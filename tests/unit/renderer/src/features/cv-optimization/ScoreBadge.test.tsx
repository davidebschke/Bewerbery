import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreBadge } from '../../../../../../src/renderer/src/features/cv-optimization/ScoreBadge'

describe('ScoreBadge', () => {
  it('shows the score as number with an accessible label', () => {
    render(<ScoreBadge score={78} delta={null} />)
    const badge = screen.getByRole('img', { name: 'Übereinstimmung 78 von 100' })
    expect(badge).toHaveTextContent('78')
    expect(badge).toHaveClass('text-ok')
    expect(screen.queryByLabelText(/gegenüber dem Original/)).not.toBeInTheDocument()
  })

  it.each([
    [18, '+18', 'text-ok'],
    [-3, '−3', 'text-due'],
    [0, '±0', 'text-muted'],
  ])('shows the delta %i as %s', (delta, text, tone) => {
    render(<ScoreBadge score={55} delta={delta} />)
    const label = screen.getByLabelText(`${text} Punkte gegenüber dem Original`)
    expect(label).toHaveTextContent(text)
    expect(label).toHaveClass(tone)
  })

  it('colours low and medium scores differently', () => {
    const { rerender } = render(<ScoreBadge score={40} delta={null} />)
    expect(screen.getByRole('img')).toHaveClass('text-due')
    rerender(<ScoreBadge score={60} delta={null} />)
    expect(screen.getByRole('img')).toHaveClass('text-warn')
  })
})
