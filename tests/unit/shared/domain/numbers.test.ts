import { describe, expect, it } from 'vitest'
import { formatNumber } from '../../../../src/shared/domain/numbers'

describe('formatNumber', () => {
  it('adds German thousands separators', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1000)).toBe('1.000')
    expect(formatNumber(125_000_000)).toBe('125.000.000')
  })

  it('handles negative and fractional values', () => {
    expect(formatNumber(-1234)).toBe('-1.234')
    expect(formatNumber(1234.9)).toBe('1.234')
  })
})
