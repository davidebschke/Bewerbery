import { describe, expect, it } from 'vitest'
import {
  applyRewrites,
  changedParagraphIds,
  lengthRatio,
  mergeRewrite,
  paragraphText,
  variantText,
} from '../../../../../src/shared/domain/cv/rewrite'
import { makeCvSource } from '../../../../../src/shared/testing/cvFixtures'

const source = makeCvSource()

describe('mergeRewrite', () => {
  it('keeps valid changes of editable paragraphs', () => {
    expect(
      mergeRewrite(source, [
        { id: 'p3', segments: ['Frontend-Entwickler: ', 'Baute Webanwendungen mit React.'] },
      ]),
    ).toEqual({ p3: ['Frontend-Entwickler: ', 'Baute Webanwendungen mit React.'] })
  })

  it('drops unknown, non-editable, mismatched, empty and unchanged paragraphs', () => {
    expect(
      mergeRewrite(source, [
        { id: 'p99', segments: ['x'] },
        { id: 'p2', segments: ['2018 – 2023'] },
        { id: 'p3', segments: ['nur ein Segment'] },
        { id: 'p4', segments: [' ', '  '] },
        { id: 'p0', segments: ['Max Mustermann'] },
      ]),
    ).toEqual({})
  })

  it('restores the outer whitespace of every segment', () => {
    expect(
      mergeRewrite(source, [{ id: 'p4', segments: ['Kenntnisse:', 'TypeScript, React '] }]),
    ).toEqual({ p4: ['Kenntnisse: ', 'TypeScript, React'] })
  })

  it('keeps an intentionally emptied segment next to a non-empty one', () => {
    expect(mergeRewrite(source, [{ id: 'p4', segments: ['', 'TypeScript'] }])).toEqual({
      p4: ['', 'TypeScript'],
    })
  })
})

describe('variant text', () => {
  const rewrites = { p3: ['Frontend-Entwickler: ', 'Baute Webanwendungen.'] }

  it('applies rewrites to a copy of the paragraphs', () => {
    const paragraphs = applyRewrites(source, rewrites)
    expect(paragraphs[3].segments[1]).toBe('Baute Webanwendungen.')
    expect(source.paragraphs[3].segments[1]).toBe('Entwicklung von Webanwendungen mit React.')
  })

  it('joins segments and paragraphs into plain text', () => {
    expect(
      paragraphText({ id: 'x', segments: ['2019 – 2023', 'Entwickler'], editable: true }),
    ).toBe('2019 – 2023 Entwickler')
    expect(paragraphText({ id: 'x', segments: ['Skills: ', 'TS'], editable: true })).toBe(
      'Skills: TS',
    )
    expect(variantText(source, rewrites).split('\n')).toEqual([
      'Max Mustermann',
      'Berufserfahrung',
      '2019 – 2023',
      'Frontend-Entwickler: Baute Webanwendungen.',
      'Skills: TypeScript, React, Teamarbeit',
    ])
  })

  it('computes the length ratio and changed ids', () => {
    expect(lengthRatio(source, {})).toBe(1)
    expect(lengthRatio(source, rewrites)).toBeLessThan(1)
    expect(lengthRatio({ ...source, paragraphs: [] }, {})).toBe(1)
    expect([...changedParagraphIds(rewrites)]).toEqual(['p3'])
  })
})
