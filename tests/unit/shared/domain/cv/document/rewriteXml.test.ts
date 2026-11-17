import { describe, expect, it } from 'vitest'
import { parseDocxParagraphs } from '../../../../../../src/shared/domain/cv/document/docx'
import { parseOdtParagraphs } from '../../../../../../src/shared/domain/cv/document/odt'
import { rewriteXml } from '../../../../../../src/shared/domain/cv/document/rewriteXml'
import { tokenizeXml } from '../../../../../../src/shared/xml/tokens'
import { DOCX_DOCUMENT_XML, ODT_CONTENT_XML } from '../../../../../fixtures/cv/xml'

/** Alle Nicht-Text-Tokens (Tags, Kommentare …) in Reihenfolge */
function markup(xml: string, ignore: (raw: string) => boolean = () => false): string[] {
  return tokenizeXml(xml)
    .filter((token) => token.kind !== 'text')
    .map((token) => xml.slice(token.start, token.end))
    .filter((raw) => !ignore(raw))
}

describe('rewriteXml – docx', () => {
  const parsed = parseDocxParagraphs(DOCX_DOCUMENT_XML)

  it('returns the identical document when nothing changes', () => {
    expect(rewriteXml(DOCX_DOCUMENT_XML, parsed, {}, 'docx')).toBe(DOCX_DOCUMENT_XML)
    const same = { p1: ['Skills: ', 'TypeScript, React'] }
    expect(rewriteXml(DOCX_DOCUMENT_XML, parsed, same, 'docx')).toBe(DOCX_DOCUMENT_XML)
  })

  it('replaces only the text of changed segments and keeps every tag', () => {
    const result = rewriteXml(
      DOCX_DOCUMENT_XML,
      parsed,
      {
        p1: ['Skills: ', 'TypeScript, React, Vitest & <Playwright>'],
        p2: ['2019 – 2023', 'Senior Frontend-Entwickler'],
        p5: ['Kontakt: max@example.com | 0151 123'],
      },
      'docx',
    )
    const reparsed = parseDocxParagraphs(result)
    expect(reparsed.paragraphs.map((p) => p.segments)).toEqual([
      ['Max Mustermann'],
      ['Skills: ', 'TypeScript, React, Vitest & <Playwright>'],
      ['2019 – 2023', 'Senior Frontend-Entwickler'],
      ['Teamarbeit & Kommunikation'],
      ['Profil'],
      ['Kontakt: max@example.com | 0151 123'],
      ['Seite '],
      ['Zeile eins', 'Zeile zwei'],
      ['Portfolio: ', 'github.com/max'],
      ['Stand: '],
    ])
    expect(result).toContain('Vitest &amp; &lt;Playwright&gt;')
    // Formatierung bleibt: gleiche Tag-Folge, nur xml:space wird ergänzt
    const withoutPreserve = (raw: string) => raw.replace(' xml:space="preserve"', '')
    expect(markup(result).map(withoutPreserve)).toEqual(
      markup(DOCX_DOCUMENT_XML).map(withoutPreserve),
    )
  })

  it('writes merged runs into the first node and empties the others', () => {
    const result = rewriteXml(DOCX_DOCUMENT_XML, parsed, { p1: ['Skills: ', 'Angular'] }, 'docx')
    expect(result).toContain('<w:t xml:space="preserve">Angular</w:t>')
    expect(result).toContain('<w:t></w:t>')
    expect(result).not.toContain('Type</w:t>')
  })

  it('keeps preserve tags as they are and flattens control characters', () => {
    const result = rewriteXml(
      DOCX_DOCUMENT_XML,
      parsed,
      { p8: ['Projekte:\n', 'github.com/max'] },
      'docx',
    )
    expect(result).toContain('<w:t xml:space="preserve">Projekte: </w:t>')
    expect(result.match(/xml:space="preserve" xml:space/)).toBeNull()
  })

  it('ignores unknown paragraphs and surplus segments', () => {
    const result = rewriteXml(
      DOCX_DOCUMENT_XML,
      parsed,
      { p99: ['x'], p0: ['Max Mustermann', 'zu viel'] },
      'docx',
    )
    expect(result).toBe(DOCX_DOCUMENT_XML)
  })
})

describe('rewriteXml – odt', () => {
  const parsed = parseOdtParagraphs(ODT_CONTENT_XML)

  it('returns the identical document when nothing changes', () => {
    expect(rewriteXml(ODT_CONTENT_XML, parsed, {}, 'odt')).toBe(ODT_CONTENT_XML)
  })

  it('removes merged space elements and encodes multiple spaces', () => {
    const result = rewriteXml(
      ODT_CONTENT_XML,
      parsed,
      {
        p1: ['Profil: ', '  Erfahrener   Frontend-Entwickler'],
        p2: ['Skills: Rust, Go & TypeScript', 'Python'],
      },
      'odt',
    )
    expect(result).toContain(
      '<text:s/><text:s text:c="1"/>Erfahrener <text:s text:c="2"/>Frontend-Entwickler',
    )
    expect(result).toContain('<text:p>Skills: Rust, Go &amp; TypeScript<text:tab/>Python</text:p>')
    const reparsed = parseOdtParagraphs(result)
    expect(reparsed.paragraphs[1].segments).toEqual([
      'Profil: ',
      '  Erfahrener   Frontend-Entwickler',
    ])
    expect(reparsed.paragraphs[2].segments).toEqual(['Skills: Rust, Go & TypeScript', 'Python'])
    // Alle Strukturelemente außer den entfallenen text:s bleiben erhalten
    const isSpace = (raw: string) => raw.startsWith('<text:s')
    expect(markup(result, isSpace)).toEqual(markup(ODT_CONTENT_XML, isSpace))
  })

  it('can start a segment with a single leading space', () => {
    const result = rewriteXml(ODT_CONTENT_XML, parsed, { p3: [' Mehr'] }, 'odt')
    expect(result).toContain('</draw:frame><text:s/>Mehr</text:p>')
  })
})
