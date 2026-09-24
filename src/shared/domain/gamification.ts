import { XP_REWARDS } from '../constants'
import type { Application, Progress, Stage } from '../types'
import { isoWeekKey } from './dates'

export interface Level {
  level: number
  title: string
  minXp: number
}

export const LEVELS: Level[] = [
  { level: 1, title: 'Bewerbungs-Rookie', minXp: 0 },
  { level: 2, title: 'Motivierter Starter', minXp: 50 },
  { level: 3, title: 'Netzwerk-Entdecker', minXp: 120 },
  { level: 4, title: 'Nachfass-Profi', minXp: 220 },
  { level: 5, title: 'Interview-Ass', minXp: 360 },
  { level: 6, title: 'Karriere-Stratege', minXp: 550 },
  { level: 7, title: 'Jobjäger-Legende', minXp: 800 },
]

export interface LevelInfo {
  current: Level
  next: Level | null
  /** 0..1 Fortschritt zum nächsten Level */
  progress: number
  xpIntoLevel: number
  xpForNext: number
}

export function getLevelInfo(xp: number): LevelInfo {
  let index = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) index = i
  }
  const current = LEVELS[index]
  const next = LEVELS[index + 1] ?? null
  if (!next) {
    return { current, next, progress: 1, xpIntoLevel: xp - current.minXp, xpForNext: 0 }
  }
  const span = next.minXp - current.minXp
  const xpIntoLevel = xp - current.minXp
  return { current, next, progress: xpIntoLevel / span, xpIntoLevel, xpForNext: span - xpIntoLevel }
}

export type XpEvent = 'create' | 'followUp' | 'interview' | 'offer' | 'rejected'

export interface AwardResult {
  progress: Progress
  gained: number
  leveledUp: boolean
}

function recordWeek(activeWeeks: string[], today: Date): string[] {
  const key = isoWeekKey(today)
  return activeWeeks.includes(key) ? activeWeeks : [...activeWeeks, key].sort()
}

export function awardXp(progress: Progress, event: XpEvent, today: Date): AwardResult {
  const gained = XP_REWARDS[event]
  const before = getLevelInfo(progress.xp).current.level
  const counterKey = {
    create: 'applicationsCreated',
    followUp: 'followUps',
    interview: 'interviews',
    offer: 'offers',
    rejected: 'rejections',
  } as const satisfies Record<XpEvent, keyof Progress>

  const next: Progress = {
    ...progress,
    xp: progress.xp + gained,
    [counterKey[event]]: progress[counterKey[event]] + 1,
    activeWeeks: recordWeek(progress.activeWeeks, today),
  }
  return { progress: next, gained, leveledUp: getLevelInfo(next.xp).current.level > before }
}

/** XP-Ereignis für einen Statuswechsel – nur wenn der Status noch nie belohnt wurde */
export function stageEvent(application: Application, stage: Stage): XpEvent | null {
  if (stage === 'applied' || application.awardedStages.includes(stage)) return null
  return stage
}

/** Anzahl aufeinanderfolgender aktiver Wochen bis zur aktuellen (oder letzten) Woche */
export function getStreak(activeWeeks: string[], today: Date): number {
  const set = new Set(activeWeeks)
  const cursor = new Date(today)
  if (!set.has(isoWeekKey(cursor))) cursor.setDate(cursor.getDate() - 7)
  let streak = 0
  while (set.has(isoWeekKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

export interface Badge {
  id: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}

interface BadgeDefinition {
  id: string
  title: string
  description: string
  icon: string
  check: (progress: Progress, streak: number) => boolean
}

const BADGES: BadgeDefinition[] = [
  {
    id: 'first-application',
    title: 'Erster Schritt',
    description: 'Erste Bewerbung angelegt',
    icon: '🚀',
    check: (p) => p.applicationsCreated >= 1,
  },
  {
    id: 'ten-applications',
    title: 'Fleißig',
    description: '10 Bewerbungen angelegt',
    icon: '📬',
    check: (p) => p.applicationsCreated >= 10,
  },
  {
    id: 'twentyfive-applications',
    title: 'Marathon',
    description: '25 Bewerbungen angelegt',
    icon: '🏃',
    check: (p) => p.applicationsCreated >= 25,
  },
  {
    id: 'first-follow-up',
    title: 'Dranbleiber',
    description: 'Zum ersten Mal nachgefasst',
    icon: '📞',
    check: (p) => p.followUps >= 1,
  },
  {
    id: 'five-follow-ups',
    title: 'Hartnäckig',
    description: '5-mal nachgefasst',
    icon: '💪',
    check: (p) => p.followUps >= 5,
  },
  {
    id: 'first-interview',
    title: 'Einladung!',
    description: 'Ersten Termin erhalten',
    icon: '🎤',
    check: (p) => p.interviews >= 1,
  },
  {
    id: 'first-offer',
    title: 'Volltreffer',
    description: 'Erstes Angebot erhalten',
    icon: '🏆',
    check: (p) => p.offers >= 1,
  },
  {
    id: 'resilient',
    title: 'Stehaufmännchen',
    description: 'Absage weggesteckt – weiter geht’s',
    icon: '🌱',
    check: (p) => p.rejections >= 1,
  },
  {
    id: 'streak-3',
    title: 'In Serie',
    description: '3 Wochen in Folge aktiv',
    icon: '🔥',
    check: (_p, s) => s >= 3,
  },
]

export function getBadges(progress: Progress, today: Date): Badge[] {
  const streak = getStreak(progress.activeWeeks, today)
  return BADGES.map(({ check, ...badge }) => ({ ...badge, unlocked: check(progress, streak) }))
}
