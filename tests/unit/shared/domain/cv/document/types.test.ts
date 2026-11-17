import { describe, expect, it } from 'vitest'
import {
  appendText,
  finishParagraphs,
  type ParagraphDraft,
} from '../../../../../../src/shared/domain/cv/document/types'

const draft = (order: number, segments: string[] = []): ParagraphDraft => ({
  order,
  segments,
  nodes: segments.map((_, segmentIndex) => ({ segmentIndex, kind: 'text', start: 0, end: 0 })),
  lastKey: null,
})

describe('document types', () => {
  it('appends to the current segment while the key stays the same', () => {
    const paragraph = draft(0)
    expect(appendText(paragraph, 'a', 'Hal')).toBe(0)
    expect(appendText(paragraph, 'a', 'lo')).toBe(0)
    expect(appendText(paragraph, 'b', ' Welt')).toBe(1)
    paragraph.lastKey = null
    expect(appendText(paragraph, 'b', '!')).toBe(2)
    expect(paragraph.segments).toEqual(['Hallo', ' Welt', '!'])
  })

  it('orders paragraphs, drops empty ones and assigns ids to nodes', () => {
    const parsed = finishParagraphs([draft(2, ['zwei']), draft(1), draft(0, ['1999'])], true)
    expect(parsed.paragraphs).toEqual([
      { id: 'p0', segments: ['1999'], editable: false },
      { id: 'p1', segments: ['zwei'], editable: true },
    ])
    expect(parsed.nodes.map((node) => node.paragraphId)).toEqual(['p0', 'p1'])
    expect(parsed.hasTrackedChanges).toBe(true)
  })
})
