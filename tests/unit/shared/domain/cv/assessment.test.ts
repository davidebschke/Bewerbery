import { describe, expect, it } from 'vitest'
import {
  bestVariant,
  formatDelta,
  normalizeAssessment,
  scoreDelta,
} from '../../../../../src/shared/domain/cv/assessment'
import {
  makeAssessment,
  makeCvResult,
  makeCvVariant,
} from '../../../../../src/shared/testing/cvFixtures'

describe('normalizeAssessment', () => {
  it('rounds and clamps the score', () => {
    const raw = { coveredKeywords: [], missingKeywords: [] }
    expect(normalizeAssessment({ ...raw, score: 72.6 }, '').score).toBe(73)
    expect(normalizeAssessment({ ...raw, score: 140 }, '').score).toBe(100)
    expect(normalizeAssessment({ ...raw, score: -5 }, '').score).toBe(0)
    expect(normalizeAssessment({ ...raw, score: Number.NaN }, '').score).toBe(0)
  })

  it('trims, deduplicates and moves covered keywords that are not in the text', () => {
    const result = normalizeAssessment(
      {
        score: 60,
        coveredKeywords: [' React ', 'react', 'Kubernetes', ''],
        missingKeywords: ['Go', 'kubernetes', 'React'],
      },
      'Erfahrung mit React und TypeScript',
    )
    expect(result).toEqual({
      score: 60,
      coveredKeywords: ['React'],
      missingKeywords: ['Kubernetes', 'Go'],
    })
  })

  it('limits keyword lists to 25 entries', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Skill${i}`)
    const result = normalizeAssessment(
      { score: 1, coveredKeywords: many, missingKeywords: [] },
      many.join(' '),
    )
    expect(result.coveredKeywords).toHaveLength(25)
  })
})

describe('score comparison', () => {
  const result = makeCvResult()

  it('computes and formats deltas', () => {
    expect(scoreDelta(result, 'ats')).toBe(29)
    expect(scoreDelta({ ...result, variants: [] }, 'ats')).toBe(0)
    expect(formatDelta(18)).toBe('+18')
    expect(formatDelta(-3)).toBe('−3')
    expect(formatDelta(0)).toBe('±0')
  })

  it('finds the best variant and prefers the fixed order on ties', () => {
    expect(bestVariant(result)).toBe('ats')
    const tie = makeCvResult({
      variants: [
        makeCvVariant('factual', 80),
        makeCvVariant('impactful', 80),
        makeCvVariant('ats', 70),
      ],
    })
    expect(bestVariant(tie)).toBe('factual')
  })

  it('marks no variant when none beats the original', () => {
    const worse = makeCvResult({ originalAssessment: makeAssessment(90) })
    expect(bestVariant(worse)).toBeNull()
  })
})
