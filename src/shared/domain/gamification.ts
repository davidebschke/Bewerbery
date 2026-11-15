import { XP_REWARDS } from '../constants'
import type { Application, Progress, Stage } from '../types'
import { isoWeekKey } from './dates'
import { formatNumber } from './numbers'

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
  { minLevel: 8, title: 'Bewerbungs-Veteran' },
  { minLevel: 10, title: 'Lebenslauf-Virtuose' },
  { minLevel: 15, title: 'Gesprächs-Diplomat' },
  { minLevel: 25, title: 'Personaler-Flüsterer' },
  { minLevel: 50, title: 'Karriere-Architekt' },
  { minLevel: 100, title: 'Jobmarkt-Meister' },
  { minLevel: 250, title: 'Bewerbungs-Großmeister' },
  { minLevel: 500, title: 'Branchen-Ikone' },
  { minLevel: 1000, title: 'Karriere-Titan' },
  { minLevel: 2500, title: 'Mythos des Arbeitsmarkts' },
  { minLevel: MAX_LEVEL, title: 'Unsterbliche Bewerbungs-Legende' },
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

export type BadgeCategory =
  'applications' | 'followUps' | 'interviews' | 'offers' | 'rejections' | 'streak'

export interface Badge {
  id: string
  category: BadgeCategory
  title: string
  description: string
  icon: string
  /** Schwelle, ab der das Abzeichen freigeschaltet ist */
  target: number
  /** Aktueller Stand, höchstens `target` */
  current: number
  unlocked: boolean
}

export interface BadgeGroup {
  category: BadgeCategory
  title: string
  badges: Badge[]
  unlockedCount: number
}

interface BadgeTier {
  threshold: number
  title: string
  icon: string
}

interface CategoryDefinition {
  category: BadgeCategory
  title: string
  metric: (progress: Progress, streak: number) => number
  describe: (threshold: number) => string
  tiers: BadgeTier[]
}

/** „Erste …“ für Stufe 1, sonst Anzahl mit Tausenderpunkt */
function counted(first: string, many: (count: string) => string) {
  return (threshold: number) => (threshold === 1 ? first : many(formatNumber(threshold)))
}

const CATEGORIES: CategoryDefinition[] = [
  {
    category: 'applications',
    title: 'Bewerbungen',
    metric: (p) => p.applicationsCreated,
    describe: counted('Erste Bewerbung angelegt', (n) => `${n} Bewerbungen angelegt`),
    tiers: [
      { threshold: 1, title: 'Erster Schritt', icon: '🚀' },
      { threshold: 10, title: 'Fleißig', icon: '📬' },
      { threshold: 25, title: 'Marathon', icon: '🏃' },
      { threshold: 50, title: 'Durchstarter', icon: '📈' },
      { threshold: 100, title: 'Hundertschaft', icon: '💯' },
      { threshold: 150, title: 'Unermüdlich', icon: '⚙️' },
      { threshold: 200, title: 'Bewerbungsmaschine', icon: '🤖' },
      { threshold: 1000, title: 'Tausendsassa', icon: '👑' },
    ],
  },
  {
    category: 'followUps',
    title: 'Nachfragen',
    metric: (p) => p.followUps,
    describe: counted('Zum ersten Mal nachgefasst', (n) => `${n}-mal nachgefasst`),
    tiers: [
      { threshold: 1, title: 'Dranbleiber', icon: '📞' },
      { threshold: 10, title: 'Hartnäckig', icon: '💪' },
      { threshold: 25, title: 'Telefonjoker', icon: '☎️' },
      { threshold: 50, title: 'Erinnerungskünstler', icon: '🔔' },
      { threshold: 100, title: 'Unüberhörbar', icon: '📣' },
      { threshold: 150, title: 'Dauerbrenner', icon: '🔁' },
      { threshold: 200, title: 'Nicht zu bremsen', icon: '🚂' },
      { threshold: 1000, title: 'Meister der Nachfrage', icon: '🧭' },
    ],
  },
  {
    category: 'interviews',
    title: 'Termine',
    metric: (p) => p.interviews,
    describe: counted('Ersten Termin erhalten', (n) => `${n} Termine erhalten`),
    tiers: [
      { threshold: 1, title: 'Einladung!', icon: '🎤' },
      { threshold: 10, title: 'Gesprächsbereit', icon: '🗣️' },
      { threshold: 25, title: 'Gefragter Kandidat', icon: '🌟' },
      { threshold: 50, title: 'Voller Terminkalender', icon: '📅' },
      { threshold: 100, title: 'Bühnenprofi', icon: '🎭' },
      { threshold: 150, title: 'Smalltalk-Champion', icon: '☕' },
      { threshold: 200, title: 'Interview-Veteran', icon: '🎖️' },
      { threshold: 1000, title: 'Gesprächslegende', icon: '🏛️' },
    ],
  },
  {
    category: 'offers',
    title: 'Angebote',
    metric: (p) => p.offers,
    describe: counted('Erstes Angebot erhalten', (n) => `${n} Angebote erhalten`),
    tiers: [{ threshold: 1, title: 'Volltreffer', icon: '🏆' }],
  },
  {
    category: 'rejections',
    title: 'Absagen',
    metric: (p) => p.rejections,
    describe: counted(
      'Absage weggesteckt – weiter geht’s',
      (n) => `${n} Absagen weggesteckt – weiter geht’s`,
    ),
    tiers: [{ threshold: 1, title: 'Stehaufmännchen', icon: '🌱' }],
  },
  {
    category: 'streak',
    title: 'Serien',
    metric: (_p, streak) => streak,
    describe: (threshold) => `${formatNumber(threshold)} Wochen in Folge aktiv`,
    tiers: [{ threshold: 3, title: 'In Serie', icon: '🔥' }],
  },
]

/** Abzeichen nach Kategorien gruppiert, in fester Reihenfolge */
export function getBadgeGroups(progress: Progress, today: Date): BadgeGroup[] {
  const streak = getStreak(progress.activeWeeks, today)
  return CATEGORIES.map(({ category, title, metric, describe, tiers }) => {
    const value = metric(progress, streak)
    const badges = tiers.map(({ threshold, title: badgeTitle, icon }) => ({
      id: `${category}-${threshold}`,
      category,
      title: badgeTitle,
      description: describe(threshold),
      icon,
      target: threshold,
      current: Math.min(value, threshold),
      unlocked: value >= threshold,
    }))
    return { category, title, badges, unlockedCount: badges.filter((b) => b.unlocked).length }
  })
}

export function getBadges(progress: Progress, today: Date): Badge[] {
  return getBadgeGroups(progress, today).flatMap((group) => group.badges)
}
