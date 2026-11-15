import { XP_REWARDS } from '../constants'
import type { Application, Progress, Stage } from '../types'
import { isoWeekKey } from './dates'

export interface Level {
  level: number
  title: string
  minXp: number
}

export const MAX_LEVEL = 5000

/** Handverlesene XP-Schwellen der ersten Level (Index 0 = Level 1) */
const BASE_THRESHOLDS = [0, 50, 120, 220, 360, 550, 800]
/** Abstand zwischen den letzten festen Leveln – danach wächst er pro Level um STEP_GROWTH */
const BASE_STEP = 250
const STEP_GROWTH = 10

interface Rank {
  minLevel: number
  title: string
}

/** Rangtitel – ein Titel gilt ab `minLevel` bis zum nächsten Rang */
const RANKS: Rank[] = [
  { minLevel: 1, title: 'Bewerbungs-Rookie' },
  { minLevel: 2, title: 'Motivierter Starter' },
  { minLevel: 3, title: 'Netzwerk-Entdecker' },
  { minLevel: 4, title: 'Nachfass-Profi' },
  { minLevel: 5, title: 'Interview-Ass' },
  { minLevel: 6, title: 'Karriere-Stratege' },
  { minLevel: 7, title: 'Jobjäger-Legende' },
]

function clampLevel(level: number): number {
  return Math.min(Math.max(Math.floor(level), 1), MAX_LEVEL)
}

/** Mindest-XP für ein Level */
export function xpForLevel(level: number): number {
  const n = clampLevel(level)
  if (n <= BASE_THRESHOLDS.length) return BASE_THRESHOLDS[n - 1]
  const m = n - BASE_THRESHOLDS.length
  const last = BASE_THRESHOLDS[BASE_THRESHOLDS.length - 1]
  return last + BASE_STEP * m + (STEP_GROWTH * m * (m + 1)) / 2
}

export function rankTitle(level: number): string {
  const n = clampLevel(level)
  let title = RANKS[0].title
  for (const rank of RANKS) {
    if (n >= rank.minLevel) title = rank.title
  }
  return title
}

export function getLevel(level: number): Level {
  const n = clampLevel(level)
  return { level: n, title: rankTitle(n), minXp: xpForLevel(n) }
}

/** Höchstes erreichtes Level für eine XP-Summe */
export function levelForXp(xp: number): number {
  const base = BASE_THRESHOLDS.length
  if (xp < xpForLevel(base)) {
    return BASE_THRESHOLDS.filter((minXp) => xp >= minXp).length || 1
  }
  // Quadratische Gleichung für die wachsende Kurve lösen, danach Rundungsfehler korrigieren
  const half = STEP_GROWTH / 2
  const linear = BASE_STEP + half
  const rest = xp - xpForLevel(base)
  let level =
    base + Math.floor((-linear + Math.sqrt(linear * linear + 4 * half * rest)) / (2 * half))
  level = clampLevel(level)
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level++
  while (level > 1 && xpForLevel(level) > xp) level--
  return level
}

export interface LevelInfo {
  current: Level
  next: Level | null
  /** 0..1 Fortschritt zum nächsten Level */
  progress: number
  xpIntoLevel: number
  xpForNext: number
}

export function getLevelInfo(xp: number): LevelInfo {
  const level = levelForXp(xp)
  const current = getLevel(level)
  const next = level < MAX_LEVEL ? getLevel(level + 1) : null
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
