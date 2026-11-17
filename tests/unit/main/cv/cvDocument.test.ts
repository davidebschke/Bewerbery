import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readCvDocument, writeCvDocument } from '../../../../src/main/cv/cvDocument'
import { buildDocx, buildOdt, PDF_BYTES } from '../../../fixtures/cv/buildFixtures'
import {
  DOCX_DOCUMENT_XML,
  DOCX_EMPTY_XML,
  DOCX_TRACKED_XML,
  ODT_TRACKED_XML,
} from '../../../fixtures/cv/xml'

function loaded(bytes: Uint8Array, name: string) {
  const result = readCvDocument(bytes, name)
  if (!result.ok) throw new Error(result.error)
  return result.value
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('readCvDocument', () => {
  it('reads a styled docx into a cv source', () => {
    const { source, mainEntry } = loaded(buildDocx(), 'Lebenslauf.docx')
    expect(mainEntry).toBe('word/document.xml')
    expect(source.format).toBe('docx')
    expect(source.fileName).toBe('Lebenslauf.docx')
    expect(source.paragraphs).toHaveLength(10)
    expect(source.charCount).toBe(
      source.paragraphs.reduce((sum, p) => sum + p.segments.join('').length, 0),
    )
  })

  it('reads an odt', () => {
    const { source, mainEntry } = loaded(buildOdt(), 'CV.ODT')
    expect(mainEntry).toBe('content.xml')
    expect(source.format).toBe('odt')
    expect(source.paragraphs[0].segments).toEqual(['Max Mustermann'])
  })

  it('finds the main document part via the package relationships', () => {
    const bytes = zipSync({
      '_rels/.rels': strToU8(
        '<Relationships><Relationship Id="r2" Type="x/styles" Target="a.xml"/><Relationship Target="/word/haupt.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Id="r1"/></Relationships>',
      ),
      'word/haupt.xml': strToU8(DOCX_DOCUMENT_XML),
    })
    expect(loaded(bytes, 'cv.docx').mainEntry).toBe('word/haupt.xml')
  })

  it.each([
    [PDF_BYTES, 'Lebenslauf.pdf', 'pdf-not-supported'],
    [PDF_BYTES, 'getarnt.docx', 'pdf-not-supported'],
    [buildDocx(), 'Lebenslauf.doc', 'unsupported-file'],
    [strToU8('Hallo'), 'cv.txt', 'unsupported-file'],
    [new Uint8Array(10 * 1024 * 1024 + 1), 'riesig.docx', 'file-too-large'],
    [new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), 'geschuetzt.docx', 'unreadable-file'],
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'kaputt.docx', 'unreadable-file'],
    [zipSync({ 'andere.xml': strToU8('<a/>') }), 'leer.docx', 'unreadable-file'],
    [buildDocx(DOCX_TRACKED_XML), 'aenderungen.docx', 'tracked-changes'],
    [buildOdt(ODT_TRACKED_XML), 'aenderungen.odt', 'tracked-changes'],
    [buildDocx(DOCX_EMPTY_XML), 'bild.docx', 'no-text'],
  ])('rejects %#: %s as %s', (bytes, name, error) => {
    expect(readCvDocument(bytes, name)).toEqual({ ok: false, error })
  })

  it('rejects documents above the paragraph or character limits', () => {
    const paragraph = '<w:p><w:r><w:t>Absatz</w:t></w:r></w:p>'
    const many = `<w:document><w:body>${paragraph.repeat(601)}</w:body></w:document>`
    expect(readCvDocument(buildDocx(many), 'lang.docx')).toEqual({ ok: false, error: 'too-long' })

    const long = `<w:document><w:body><w:p><w:r><w:t>${'x'.repeat(30_001)}</w:t></w:r></w:p></w:body></w:document>`
    expect(readCvDocument(buildDocx(long), 'lang.docx')).toEqual({ ok: false, error: 'too-long' })
  })
})

describe('writeCvDocument', () => {
  it('keeps every other zip entry identical and only changes the text', () => {
    const original = buildDocx()
    const document = loaded(original, 'cv.docx')
    const written = writeCvDocument(original, document, {
      p2: ['2019 – 2023', 'Senior Frontend-Entwickler'],
    })

    const before = unzipSync(original)
    const after = unzipSync(written)
    expect(Object.keys(after)).toEqual(Object.keys(before))
    for (const name of Object.keys(before)) {
      if (name === 'word/document.xml') continue
      expect(after[name], name).toEqual(before[name])
    }
    expect(text(after['word/document.xml'])).toBe(
      DOCX_DOCUMENT_XML.replace(
        '<w:t>Frontend-Entwickler</w:t>',
        '<w:t xml:space="preserve">Senior Frontend-Entwickler</w:t>',
      ),
    )

    const reread = loaded(written, 'cv.docx')
    expect(reread.source.paragraphs.map((p) => p.segments.length)).toEqual(
      document.source.paragraphs.map((p) => p.segments.length),
    )
    expect(reread.source.paragraphs[2].segments[1]).toBe('Senior Frontend-Entwickler')
  })

  it('round-trips without changes', () => {
    const original = buildOdt()
    const written = writeCvDocument(original, loaded(original, 'cv.odt'), {})
    const before = unzipSync(original)
    const after = unzipSync(written)
    for (const name of Object.keys(before)) expect(after[name]).toEqual(before[name])
  })

  it('keeps the odt mimetype as first, uncompressed entry', () => {
    const original = buildOdt()
    const written = writeCvDocument(original, loaded(original, 'cv.odt'), {
      p1: ['Profil: ', 'Erfahrene Entwicklerin'],
    })
    // Lokaler Header: Signatur, …, Kompression (Offset 8) = 0 (stored), Name ab Offset 30
    expect(written[8]).toBe(0)
    expect(text(written.slice(30, 38))).toBe('mimetype')
    expect(text(written.slice(38, 77))).toBe('application/vnd.oasis.opendocument.text')
    expect(loaded(written, 'cv.odt').source.paragraphs[1].segments[1]).toBe(
      'Erfahrene Entwicklerin',
    )
  })
})
