import confetti from 'canvas-confetti'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { progressSchema } from '@shared/schemas'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import { freezeToday } from '../../test/utils'
import { BadgesDialog } from './BadgesDialog'
import { celebrate } from './celebrate'
import { StatsBar } from './StatsBar'
import { XpBar } from './XpBar'

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

  it('shows total XP at max level', () => {
    render(<XpBar xp={999} onOpenBadges={() => {}} />)
    expect(screen.getByText('999 XP')).toBeInTheDocument()
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
    expect(screen.getByText(/Noch 30 XP bis „Motivierter Starter“/)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Erster Schritt' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Volltreffer (gesperrt)' })).toBeInTheDocument()
  })

  it('omits the next-level hint at max level', () => {
    render(
      <BadgesDialog
        open
        onClose={() => {}}
        progress={progressSchema.parse({ xp: 5000 })}
        today={today}
      />,
    )
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
