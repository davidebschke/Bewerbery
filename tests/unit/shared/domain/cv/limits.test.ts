import { describe, expect, it } from 'vitest'
import {
  checkJobDescription,
  jobDescriptionMessage,
} from '../../../../../src/shared/domain/cv/limits'

describe('checkJobDescription', () => {
  it('accepts trimmed text up to 15 000 characters', () => {
    expect(checkJobDescription('  React  ')).toEqual({ ok: true, length: 5 })
    expect(checkJobDescription('x'.repeat(15_000)).ok).toBe(true)
  })

  it('reports empty and too long postings with german messages', () => {
    const empty = checkJobDescription('   ')
    expect(empty).toEqual({ ok: false, reason: 'empty', length: 0 })
    expect(jobDescriptionMessage(empty)).toBe(
      'Füge die Stellenanzeige ein oder wähle eine Bewerbung.',
    )

    const long = checkJobDescription('x'.repeat(16_234))
    expect(long).toEqual({ ok: false, reason: 'too-long', length: 16_234, excess: 1_234 })
    expect(jobDescriptionMessage(long)).toBe('Die Stellenanzeige ist 1.234 Zeichen zu lang.')
    expect(jobDescriptionMessage({ ok: true, length: 1 })).toBeNull()
  })
})
