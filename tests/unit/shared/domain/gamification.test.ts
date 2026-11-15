import { describe, expect, it } from 'vitest'
import { progressSchema } from '../../../../src/shared/schemas'
import { makeApplication } from '../../../../src/shared/testing/fixtures'
import {
  MAX_LEVEL,
  awardXp,
  type BadgeCategory,
  getBadgeGroups,
  getBadges,
  getLevel,
  getLevelInfo,
  getStreak,
  levelForXp,
  rankTitle,
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

describe('rankTitle', () => {
  it('keeps one title per early level', () => {
    expect(rankTitle(1)).toBe('Bewerbungs-Rookie')
    expect(rankTitle(7)).toBe('Jobjäger-Legende')
  })

  it('shares a title within growing level blocks', () => {
    expect([8, 9].map(rankTitle)).toEqual(['Bewerbungs-Veteran', 'Bewerbungs-Veteran'])
    expect([10, 14].map(rankTitle)).toEqual(['Lebenslauf-Virtuose', 'Lebenslauf-Virtuose'])
    expect(rankTitle(15)).toBe('Gesprächs-Diplomat')
    expect(rankTitle(49)).toBe('Personaler-Flüsterer')
    expect(rankTitle(99)).toBe('Karriere-Architekt')
    expect(rankTitle(249)).toBe('Jobmarkt-Meister')
    expect(rankTitle(499)).toBe('Bewerbungs-Großmeister')
    expect(rankTitle(999)).toBe('Branchen-Ikone')
    expect(rankTitle(2499)).toBe('Karriere-Titan')
    expect(rankTitle(4999)).toBe('Mythos des Arbeitsmarkts')
  })

  it('reserves a unique title for the max level', () => {
    expect(rankTitle(MAX_LEVEL)).toBe('Unsterbliche Bewerbungs-Legende')
    expect(getLevel(MAX_LEVEL).title).toBe('Unsterbliche Bewerbungs-Legende')
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
      'applications-1',
      'applications-10',
      'followUps-1',
      'interviews-1',
      'streak-3',
    ])
    expect(badges[0]).not.toHaveProperty('metric')
  })

  it('has everything locked initially', () => {
    expect(getBadges(empty, today).every((b) => !b.unlocked)).toBe(true)
  })

  it('reports progress capped at the target', () => {
    const badges = getBadges({ ...empty, applicationsCreated: 17 }, today)
    const byId = (id: string) => badges.find((b) => b.id === id)
    expect(byId('applications-10')).toMatchObject({ current: 10, target: 10, unlocked: true })
    expect(byId('applications-25')).toMatchObject({ current: 17, target: 25, unlocked: false })
  })

  it('describes thresholds in German', () => {
    const badges = getBadges(empty, today)
    const description = (id: string) => badges.find((b) => b.id === id)?.description
    expect(description('applications-1')).toBe('Erste Bewerbung angelegt')
    expect(description('applications-10')).toBe('10 Bewerbungen angelegt')
    expect(description('followUps-1')).toBe('Zum ersten Mal nachgefasst')
    expect(description('interviews-1')).toBe('Ersten Termin erhalten')
    expect(description('offers-1')).toBe('Erstes Angebot erhalten')
    expect(description('rejections-1')).toBe('Absage weggesteckt – weiter geht’s')
    expect(description('streak-3')).toBe('3 Wochen in Folge aktiv')
  })
})

describe('getBadgeGroups', () => {
  it('groups badges by category in a fixed order', () => {
    const groups = getBadgeGroups({ ...empty, applicationsCreated: 1 }, today)
    expect(groups.map((g) => g.title)).toEqual([
      'Bewerbungen',
      'Nachfragen',
      'Termine',
      'Angebote',
      'Absagen',
      'Serien',
    ])
    expect(groups[0].unlockedCount).toBe(1)
    expect(groups.every((g) => g.badges.every((b) => b.category === g.category))).toBe(true)
  })
})

/** Abzeichen einer Kategorie für einen Fortschritts-Stand */
function categoryBadges(category: BadgeCategory, progress: Partial<typeof empty> = {}) {
  return getBadges({ ...empty, ...progress }, today).filter((b) => b.category === category)
}

describe('application badges', () => {
  it('has tiers from 1 to 1000 applications', () => {
    expect(categoryBadges('applications').map((b) => b.target)).toEqual([
      1, 10, 25, 50, 100, 150, 200, 1000,
    ])
  })

  it('unlocks tiers up to the current count', () => {
    const badges = categoryBadges('applications', { applicationsCreated: 150 })
    expect(badges.filter((b) => b.unlocked).map((b) => b.title)).toEqual([
      'Erster Schritt',
      'Fleißig',
      'Marathon',
      'Durchstarter',
      'Hundertschaft',
      'Unermüdlich',
    ])
    expect(badges.at(-1)).toMatchObject({
      title: 'Tausendsassa',
      description: '1.000 Bewerbungen angelegt',
      current: 150,
      unlocked: false,
    })
  })
})

describe('follow-up badges', () => {
  it('has tiers from 1 to 1000 follow-ups', () => {
    expect(categoryBadges('followUps').map((b) => b.target)).toEqual([
      1, 10, 25, 50, 100, 150, 200, 1000,
    ])
  })

  it('unlocks tiers up to the current count', () => {
    const badges = categoryBadges('followUps', { followUps: 25 })
    expect(badges.filter((b) => b.unlocked).map((b) => b.title)).toEqual([
      'Dranbleiber',
      'Hartnäckig',
      'Telefonjoker',
    ])
    expect(badges.at(-1)).toMatchObject({
      title: 'Meister der Nachfrage',
      description: '1.000-mal nachgefasst',
      current: 25,
    })
  })
})

describe('interview badges', () => {
  it('has tiers from 1 to 1000 interviews', () => {
    expect(categoryBadges('interviews').map((b) => b.target)).toEqual([
      1, 10, 25, 50, 100, 150, 200, 1000,
    ])
  })

  it('unlocks tiers up to the current count', () => {
    const badges = categoryBadges('interviews', { interviews: 10 })
    expect(badges.filter((b) => b.unlocked).map((b) => b.title)).toEqual([
      'Einladung!',
      'Gesprächsbereit',
    ])
    expect(badges[2]).toMatchObject({
      title: 'Gefragter Kandidat',
      description: '25 Termine erhalten',
      current: 10,
    })
  })
})
