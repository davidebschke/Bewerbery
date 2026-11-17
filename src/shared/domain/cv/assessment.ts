import { MAX_KEYWORDS } from '../../constants'
import type { Assessment, CvOptimizationResult, RawAssessment } from './schemas'
import { VARIANT_STYLES, type VariantStyle } from './styles'

function uniqueKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    const key = trimmed.toLocaleLowerCase('de-DE')
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

/**
 * Bereinigt eine KI-Bewertung: Score auf 0–100 runden, Keywords trimmen und deduplizieren.
 * Ein „abgedecktes“ Keyword, das nicht im Text vorkommt, gilt als fehlend.
 */
export function normalizeAssessment(raw: RawAssessment, text: string): Assessment {
  const haystack = text.toLocaleLowerCase('de-DE')
  const covered: string[] = []
  const missing: string[] = []

  for (const keyword of uniqueKeywords(raw.coveredKeywords)) {
    if (haystack.includes(keyword.toLocaleLowerCase('de-DE'))) covered.push(keyword)
    else missing.push(keyword)
  }
  const coveredKeys = new Set(covered.map((keyword) => keyword.toLocaleLowerCase('de-DE')))
  for (const keyword of uniqueKeywords([...missing, ...raw.missingKeywords])) {
    if (!coveredKeys.has(keyword.toLocaleLowerCase('de-DE'))) missing.push(keyword)
  }

  const score = Number.isFinite(raw.score) ? Math.round(raw.score) : 0
  return {
    score: Math.min(100, Math.max(0, score)),
    coveredKeywords: covered.slice(0, MAX_KEYWORDS),
    missingKeywords: uniqueKeywords(missing).slice(0, MAX_KEYWORDS),
  }
}

export function scoreDelta(result: CvOptimizationResult, style: VariantStyle): number {
  const variant = result.variants.find((candidate) => candidate.style === style)
  return variant ? variant.assessment.score - result.originalAssessment.score : 0
}

/** „+18“, „−3“ (typografisches Minus) oder „±0“ */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '±0'
}

/**
 * Stil mit dem höchsten Score; bei Gleichstand gewinnt die feste Reihenfolge.
 * `null`, wenn keine Variante das Original übertrifft.
 */
export function bestVariant(result: CvOptimizationResult): VariantStyle | null {
  let best: VariantStyle | null = null
  let bestScore = result.originalAssessment.score
  for (const style of VARIANT_STYLES) {
    const variant = result.variants.find((candidate) => candidate.style === style)
    if (variant && variant.assessment.score > bestScore) {
      best = style
      bestScore = variant.assessment.score
    }
  }
  return best
}
