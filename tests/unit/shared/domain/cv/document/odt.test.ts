import { describe, expect, it } from 'vitest'
import { parseOdtParagraphs } from '../../../../../../src/shared/domain/cv/document/odt'
import { ODT_CONTENT_XML, ODT_TRACKED_XML } from '../../../../../fixtures/cv/xml'

describe('parseOdtParagraphs', () => {
  const parsed = parseOdtParagraphs(ODT_CONTENT_XML)

  it('splits paragraphs and headings into segments in document order', () => {
    expect(parsed.paragraphs.map((p) => p.segments)).toEqual([
      ['Max Mustermann'],
      ['Profil: ', 'Erfahrener Entwickler'],
      ['Skills: Rust  Go', 'Python'],
      ['Weiter'],
      ['Kontakt'],
      ['Text'],
      ['Zeile eins', 'Mehr unter ', 'github.com/max'],
      ['Seite '],
    ])
    expect(parsed.hasTrackedChanges).toBe(false)
  })

  it('records text and space nodes with exact positions', () => {
    const skills = parsed.nodes.filter((node) => node.paragraphId === 'p2')
    expect(skills.map((node) => [node.kind, ODT_CONTENT_XML.slice(node.start, node.end)])).toEqual([
      ['text', 'Skills:'],
      ['space', '<text:s/>'],
      ['text', 'Rust'],
      ['space', '<text:s text:c="2"/>'],
      ['text', 'Go'],
      ['text', 'Python'],
    ])
    expect(skills.map((node) => node.segmentIndex)).toEqual([0, 0, 0, 0, 0, 1])
  })

  it('ignores comments and fields', () => {
    const texts = parsed.paragraphs.flatMap((p) => p.segments).join('|')
    expect(texts).not.toContain('Kommentar')
    expect(texts).not.toContain('1')
  })

  it('detects tracked changes', () => {
    expect(parseOdtParagraphs(ODT_TRACKED_XML).hasTrackedChanges).toBe(true)
  })

  it('ignores text outside of paragraphs and unknown space counts', () => {
    const xml = '<office:text>lose<text:s/><text:p>A<text:s text:c="x"/>B</text:p></office:text>'
    expect(parseOdtParagraphs(xml).paragraphs[0].segments).toEqual(['A B'])
  })
})
