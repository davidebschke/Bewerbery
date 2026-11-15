import confetti from 'canvas-confetti'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LEVEL, xpForLevel } from '@shared/domain/gamification'
import { progressSchema } from '@shared/schemas'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import { freezeToday } from '../../../../../../src/renderer/src/test/utils'
import { BadgesDialog } from '../../../../../../src/renderer/src/features/gamification/BadgesDialog'
import { celebrate } from '../../../../../../src/renderer/src/features/gamification/celebrate'
import { StatsBar } from '../../../../../../src/renderer/src/features/gamification/StatsBar'
import { XpBar } from '../../../../../../src/renderer/src/features/gamification/XpBar'

let today: Date
beforeEach(() => {
  today = freezeToday()
  vi.mocked(confetti).mockClear()
})

describe('XpBar', () => {
  it('shows level progress and opens badges', async () => {
    const onOpen = vi.fn()
    render(<XpBar xp={85} onOpenBadges={onOpen} />)
    expect(screen.getByText('Motivierter Starter')).toBeInTheDocument()
    expect(screen.getByText('35/70 XP')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Level 2/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('formats large XP values with thousands separators', () => {
    render(<XpBar xp={xpForLevel(100) + 1100} onOpenBadges={() => {}} />)
    expect(screen.getByRole('button', { name: /Level 100: Jobmarkt-Meister/ })).toBeInTheDocument()
    expect(screen.getByText('1.100/1.190 XP')).toBeInTheDocument()
  })

  it('shows total XP at max level', () => {
    render(<XpBar xp={xpForLevel(MAX_LEVEL)} onOpenBadges={() => {}} />)
    expect(screen.getByText('125.924.260 XP')).toBeInTheDocument()
  })
})

describe('StatsBar', () => {
  it('summarizes applications', () => {
    const data = makeData({
      applications: [
        makeApplication({ sentAt: '2026-08-01' }),
        makeApplication({ stage: 'interview' }),
        makeApplication({ sentAt: '2026-09-22' }),
      ],
      progress: progressSchema.parse({ activeWeeks: ['2026-W38', '2026-W39'] }),
    })
    render(<StatsBar data={data} today={today} />)
    const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent
    expect(value('Bewerbungen')).toBe('3')
    expect(value('Jetzt melden')).toBe('1')
    expect(value('Termine')).toBe('1')
    expect(value('Wochen-Serie')).toBe('2')
  })
})

describe('BadgesDialog', () => {
  it('lists locked and unlocked badges', () => {
    const progress = progressSchema.parse({ xp: 20, applicationsCreated: 1 })
    render(<BadgesDialog open onClose={() => {}} progress={progress} today={today} />)
    expect(screen.getByText(/1 von 9 Abzeichen/)).toBeInTheDocument()
    expect(screen.getByText(/Noch 30 XP bis Level 2/)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Erster Schritt' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Volltreffer (gesperrt)' })).toBeInTheDocument()
  })

  it('groups badges into category sections with progress', () => {
    const progress = progressSchema.parse({ applicationsCreated: 17 })
    render(<BadgesDialog open onClose={() => {}} progress={progress} today={today} />)
    const section = screen.getByRole('region', { name: /Bewerbungen/ })
    expect(within(section).getByText('2/3 freigeschaltet')).toBeInTheDocument()
    const marathon = within(section).getByRole('listitem', { name: 'Marathon (gesperrt)' })
    expect(within(marathon).getByText('17/25')).toBeInTheDocument()
    expect(
      within(marathon).getByRole('progressbar', { name: 'Fortschritt Marathon' }),
    ).toHaveAttribute('aria-valuenow', '68')
    const unlocked = within(section).getByRole('listitem', { name: 'Fleißig' })
    expect(within(unlocked).queryByRole('progressbar')).not.toBeInTheDocument()
    for (const title of ['Nachfragen', 'Termine', 'Angebote', 'Absagen', 'Serien']) {
      expect(screen.getByRole('region', { name: new RegExp(title) })).toBeInTheDocument()
    }
  })

  it('omits the next-level hint at max level', () => {
    render(
      <BadgesDialog
        open
        onClose={() => {}}
        progress={progressSchema.parse({ xp: xpForLevel(MAX_LEVEL) })}
        today={today}
      />,
    )
    expect(screen.getByText(/Level 5\.000 von 5\.000/)).toBeInTheDocument()
    expect(screen.queryByText(/Noch .* XP bis/)).not.toBeInTheDocument()
  })
})

describe('celebrate', () => {
  it('fires confetti with intensity per kind', () => {
    celebrate('interview')
    celebrate('offer')
    celebrate('level')
    const counts = vi.mocked(confetti).mock.calls.map(([options]) => options?.particleCount)
    expect(counts).toEqual([90, 180, 120])
  })

  it('respects reduced motion', () => {
    vi.mocked(window.matchMedia).mockReturnValueOnce({ matches: true } as MediaQueryList)
    celebrate('offer')
    expect(confetti).not.toHaveBeenCalled()
  })
})
