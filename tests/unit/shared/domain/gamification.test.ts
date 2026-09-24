import { describe, expect, it } from 'vitest'
import { progressSchema } from '../../../../src/shared/schemas'
import { makeApplication } from '../../../../src/shared/testing/fixtures'
import { LEVELS, awardXp, getBadges, getLevelInfo, getStreak, stageEvent } from '../../../../src/shared/domain/gamification'

const today = new Date(2026, 8, 23) // KW 39
const empty = progressSchema.parse({})

describe('getLevelInfo', () => {
  it('starts at level 1', () => {
    expect(getLevelInfo(0)).toMatchObject({
      current: LEVELS[0],
      next: LEVELS[1],
      progress: 0,
      xpForNext: 50,
    })
  })

  it('computes progress within a level', () => {
    const info = getLevelInfo(85)
    expect(info.current.level).toBe(2)
    expect(info.xpIntoLevel).toBe(35)
    expect(info.progress).toBeCloseTo(0.5)
  })

  it('caps at the max level', () => {
    const info = getLevelInfo(5000)
    expect(info.current.title).toBe('Jobjäger-Legende')
    expect(info.next).toBeNull()
    expect(info.progress).toBe(1)
  })
})

describe('awardXp', () => {
  it('adds XP, increments counters and records the week', () => {
    const result = awardXp(empty, 'create', today)
    expect(result.gained).toBe(10)
    expect(result.progress.xp).toBe(10)
    expect(result.progress.applicationsCreated).toBe(1)
    expect(result.progress.activeWeeks).toEqual(['2026-W39'])
    expect(result.leveledUp).toBe(false)
  })

  it('does not duplicate the active week', () => {
    const once = awardXp(empty, 'followUp', today).progress
    expect(awardXp(once, 'followUp', today).progress.activeWeeks).toEqual(['2026-W39'])
  })

  it('detects level ups', () => {
    const result = awardXp({ ...empty, xp: 45 }, 'interview', today)
    expect(result.leveledUp).toBe(true)
    expect(result.progress.interviews).toBe(1)
  })

  it('counts offers and rejections', () => {
    expect(awardXp(empty, 'offer', today).progress.offers).toBe(1)
    expect(awardXp(empty, 'rejected', today).progress.rejections).toBe(1)
  })
})

describe('stageEvent', () => {
  it('awards a stage only once', () => {
    const app = makeApplication()
    expect(stageEvent(app, 'applied')).toBeNull()
    expect(stageEvent(app, 'interview')).toBe('interview')
    expect(stageEvent({ ...app, awardedStages: ['interview'] }, 'interview')).toBeNull()
  })
})

describe('getStreak', () => {
  it('counts consecutive weeks including the current one', () => {
    expect(getStreak(['2026-W37', '2026-W38', '2026-W39'], today)).toBe(3)
  })

  it('still counts when the current week has no activity yet', () => {
    expect(getStreak(['2026-W37', '2026-W38'], today)).toBe(2)
  })

  it('breaks on gaps', () => {
    expect(getStreak(['2026-W35', '2026-W39'], today)).toBe(1)
    expect(getStreak([], today)).toBe(0)
  })
})

describe('getBadges', () => {
  it('unlocks badges based on progress', () => {
    const badges = getBadges(
      {
        ...empty,
        applicationsCreated: 10,
        followUps: 1,
        interviews: 1,
        activeWeeks: ['2026-W37', '2026-W38', '2026-W39'],
      },
      today,
    )
    const unlocked = badges.filter((b) => b.unlocked).map((b) => b.id)
    expect(unlocked).toEqual([
      'first-application',
      'ten-applications',
      'first-follow-up',
      'first-interview',
      'streak-3',
    ])
    expect(badges[0]).not.toHaveProperty('check')
  })

  it('has everything locked initially', () => {
    expect(getBadges(empty, today).every((b) => !b.unlocked)).toBe(true)
  })
})
