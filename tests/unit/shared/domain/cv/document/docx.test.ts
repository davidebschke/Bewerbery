import { describe, expect, it } from 'vitest'
import { parseDocxParagraphs } from '../../../../../../src/shared/domain/cv/document/docx'
import { DOCX_DOCUMENT_XML, DOCX_EMPTY_XML, DOCX_TRACKED_XML } from '../../../../../fixtures/cv/xml'

describe('parseDocxParagraphs', () => {
  const parsed = parseDocxParagraphs(DOCX_DOCUMENT_XML)

  it('splits paragraphs into formatting segments in document order', () => {
    expect(parsed.paragraphs.map((p) => p.segments)).toEqual([
      ['Max Mustermann'],
      ['Skills: ', 'TypeScript, React'],
      ['2019 – 2023', 'Frontend-Entwickler'],
      ['Teamarbeit & Kommunikation'],
      ['Profil'],
      ['Kontakt: max@example.com'],
      ['Seite '],
      ['Zeile eins', 'Zeile zwei'],
      ['Portfolio: ', 'github.com/max'],
      ['Stand: '],
    ])
    expect(parsed.paragraphs.map((p) => p.id)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
      'p9',
    ])
    expect(parsed.hasTrackedChanges).toBe(false)
  })

  it('marks paragraphs without letters as not editable', () => {
    const xml = DOCX_DOCUMENT_XML.replace('<w:t>Max Mustermann</w:t>', '<w:t>2019 – 2023</w:t>')
    const [first, second] = parseDocxParagraphs(xml).paragraphs
    expect(first.editable).toBe(false)
    expect(second.editable).toBe(true)
  })

  it('remembers the exact text positions of every w:t node', () => {
    const skills = parsed.nodes.filter((node) => node.paragraphId === 'p1')
    expect(skills.map((node) => DOCX_DOCUMENT_XML.slice(node.start, node.end))).toEqual([
      'Skills: ',
      'Type',
      'Script, React',
    ])
    expect(skills.map((node) => node.segmentIndex)).toEqual([0, 1, 1])
    expect(skills.map((node) => node.preserve)).toEqual([true, false, false])
    expect(DOCX_DOCUMENT_XML.slice(skills[1].tagEnd! - 5, skills[1].tagEnd)).toBe('<w:t>')
  })

  it('keeps escaped characters as raw ranges', () => {
    const node = parsed.nodes.find((n) => n.paragraphId === 'p3')!
    expect(DOCX_DOCUMENT_XML.slice(node.start, node.end)).toBe('Teamarbeit &amp; Kommunikation')
  })

  it('ignores the vml fallback copy of text boxes', () => {
    expect(parsed.nodes.filter((n) => n.paragraphId === 'p5')).toHaveLength(1)
    const count = parsed.paragraphs.filter((p) => p.segments[0].startsWith('Kontakt')).length
    expect(count).toBe(1)
  })

  it('detects tracked changes', () => {
    expect(parseDocxParagraphs(DOCX_TRACKED_XML).hasTrackedChanges).toBe(true)
  })

  it('returns no paragraphs for documents without text', () => {
    expect(parseDocxParagraphs(DOCX_EMPTY_XML).paragraphs).toEqual([])
  })

  it('handles self-closing runs and text outside paragraphs gracefully', () => {
    const xml =
      '<w:body><w:r/><w:r><w:t>lose</w:t></w:r><w:p><w:r><w:t/><w:rPr/></w:r><w:r><w:t>ok</w:t></w:r></w:p></w:body>'
    expect(parseDocxParagraphs(xml).paragraphs.map((p) => p.segments)).toEqual([['ok']])
  })

  it('treats unbalanced field ends without crashing', () => {
    const xml =
      '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r><w:t>Text</w:t></w:r></w:p></w:fldSimple></mc:Fallback>'
    expect(parseDocxParagraphs(xml).paragraphs[0].segments).toEqual(['Text'])
  })
})
