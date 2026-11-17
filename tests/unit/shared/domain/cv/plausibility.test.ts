import { describe, expect, it } from 'vitest'
import { findInventedNumbers } from '../../../../../src/shared/domain/cv/plausibility'

describe('findInventedNumbers', () => {
  it('finds numbers that only appear in the variant', () => {
    expect(
      findInventedNumbers(
        'Seit 2019 Teamleitung von 5 Personen',
        'Seit 2019 Leitung von 12 Personen, Umsatz +30 % in 2021',
      ),
    ).toEqual(['12', '30 %', '2021'])
  })

  it('treats formatting variants of the same number as equal', () => {
    expect(
      findInventedNumbers('Budget 1.500.000 €, Quote 2,5', 'Budget 1500000 €, Quote 2.5'),
    ).toEqual([])
    expect(findInventedNumbers('Steigerung um 30%', 'Steigerung um 30 %')).toEqual([])
  })

  it('accepts a percent sign dropped from an original number but not one added', () => {
    expect(findInventedNumbers('Quote 30 %', 'Quote 30')).toEqual([])
    expect(findInventedNumbers('Team mit 30 Personen', 'Team mit 30 % mehr Leistung')).toEqual([
      '30 %',
    ])
  })

  it('reports each invented number once', () => {
    expect(findInventedNumbers('', '7 Jahre, 7 Projekte')).toEqual(['7'])
  })
})
