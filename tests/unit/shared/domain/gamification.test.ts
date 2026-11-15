import { describe, expect, it } from 'vitest'
import { progressSchema } from '../../../../src/shared/schemas'
import { makeApplication } from '../../../../src/shared/testing/fixtures'
import {
  MAX_LEVEL,
  awardXp,
  getBadges,
  getLevel,
  getLevelInfo,
  getStreak,
  levelForXp,
  stageEvent,
  xpForLevel,
} from '../../../../src/shared/domain/gamification'

const today = new Date(2026, 8, 23) // KW 39
const empty = progressSchema.parse({})

describe('xpForLevel', () => {
  it('keeps the hand-picked thresholds of the first levels', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(xpForLevel)).toEqual([0, 50, 120, 220, 360, 550, 800])
  })

  it('grows each step by 10 XP after level 7', () => {
    expect(xpForLevel(8) - xpForLevel(7)).toBe(260)
    expect(xpForLevel(9) - xpForLevel(8)).toBe(270)
    expect(xpForLevel(100) - xpForLevel(99)).toBe(250 + 10 * 93)
  })

  it('reaches level 5000 at about 125 million XP', () => {
    expect(xpForLevel(MAX_LEVEL)).toBe(125_924_260)
  })

  it('clamps out-of-range levels', () => {
    expect(xpForLevel(0)).toBe(0)
    expect(xpForLevel(MAX_LEVEL + 10)).toBe(xpForLevel(MAX_LEVEL))
  })
})

describe('levelForXp', () => {
  it('is the inverse of xpForLevel at every threshold', () => {
    for (const level of [1, 2, 7, 8, 9, 46, 100, 999, 1000, 4999, MAX_LEVEL]) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
      if (level > 1) expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1)
    }
  })

  it('never exceeds the max level', () => {
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL)
  })

  it('stays on level 1 for negative values', () => {
    expect(levelForXp(-5)).toBe(1)
  })
})

describe('getLevelInfo', () => {
  it('starts at level 1', () => {
    expect(getLevelInfo(0)).toMatchObject({
      current: getLevel(1),
      next: getLevel(2),
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

  it('continues beyond the former max level', () => {
    const info = getLevelInfo(5000)
    expect(info.current.level).toBe(20)
    expect(info.next?.level).toBe(21)
  })

  it('caps at the max level', () => {
    const info = getLevelInfo(xpForLevel(MAX_LEVEL) + 1000)
    expect(info.current.level).toBe(MAX_LEVEL)
    expect(info.next).toBeNull()
    expect(info.progress).toBe(1)
    expect(info.xpIntoLevel).toBe(1000)
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
