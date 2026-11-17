import { describe, expect, it } from 'vitest'
import {
  VARIANT_STYLE_INSTRUCTIONS,
  VARIANT_STYLE_LABELS,
  VARIANT_STYLES,
} from '../../../../../src/shared/domain/cv/styles'

describe('styles', () => {
  it('keeps a fixed order with german labels', () => {
    expect(VARIANT_STYLES).toEqual(['factual', 'impactful', 'ats'])
    expect(VARIANT_STYLES.map((style) => VARIANT_STYLE_LABELS[style])).toEqual([
      'Sachlich',
      'Wirkungsstark',
      'ATS-optimiert',
    ])
  })

  it('has an instruction for every style', () => {
    for (const style of VARIANT_STYLES) {
      expect(VARIANT_STYLE_INSTRUCTIONS[style].length).toBeGreaterThan(20)
    }
  })
})
