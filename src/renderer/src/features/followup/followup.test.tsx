import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeApplication, makeSettings } from '@shared/testing/fixtures'
import { freezeToday, seedStore } from '../../test/utils'
import { FollowUpBar } from './FollowUpBar'
import { PinnedSection } from './PinnedSection'

let today: Date
beforeEach(() => {
  today = freezeToday()
})

describe('FollowUpBar', () => {
  it('renders fresh, soon and due states', () => {
    const settings = makeSettings({ followUpWeeks: 2 })
    const { rerender } = render(
      <FollowUpBar
        application={makeApplication({ sentAt: '2026-09-20' })}
        settings={settings}
        today={today}
      />,
    )
    expect(screen.getByText('Noch 11 Tage')).toHaveClass('text-ok')
    expect(screen.getByText(/Fällig am 04.10.2026 · Frist 2 Wochen/)).toBeInTheDocument()

    rerender(
      <FollowUpBar
        application={makeApplication({ sentAt: '2026-09-12' })}
        settings={settings}
        today={today}
      />,
    )
    expect(screen.getByText('Noch 3 Tage')).toHaveClass('text-warn')

    rerender(
      <FollowUpBar
        application={makeApplication({ sentAt: '2026-09-01' })}
        settings={settings}
        today={today}
      />,
    )
    expect(screen.getByText('Seit 8 Tagen überfällig')).toHaveClass('text-due')
  })

  it('uses singular week and hides for non-applied stages', () => {
    const settings = makeSettings({ followUpWeeks: 1 })
    const { container, rerender } = render(
      <FollowUpBar
        application={makeApplication({ sentAt: '2026-09-20' })}
        settings={settings}
        today={today}
      />,
    )
    expect(screen.getByText(/Frist 1 Woche$/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /1 Woche\)/ })).toBeInTheDocument()

    rerender(
      <FollowUpBar
        application={makeApplication({ stage: 'offer' })}
        settings={settings}
        today={today}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PinnedSection', () => {
  it('renders nothing without due applications', () => {
    const { container } = render(
      <PinnedSection applications={[]} settings={makeSettings()} today={today} onEdit={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows pinned cards with counter', () => {
    const apps = [
      makeApplication({ company: 'A', sentAt: '2026-08-01' }),
      makeApplication({ company: 'B', sentAt: '2026-08-02' }),
    ]
    seedStore({ applications: apps })
    render(
      <PinnedSection
        applications={apps}
        settings={makeSettings()}
        today={today}
        onEdit={() => {}}
      />,
    )
    const region = screen.getByRole('region', { name: /Jetzt melden/ })
    expect(region).toHaveTextContent('2')
    expect(screen.getAllByText('Melden fällig')).toHaveLength(2)
  })
})
