import { describe, expect, it } from 'vitest'
import {
  applyEdits,
  decodeEntities,
  escapeXml,
  escapeXmlText,
  parseAttributes,
  tokenizeXml,
} from '../../../../src/shared/xml/tokens'

const XML =
  '<?xml version="1.0"?><!-- Kommentar --><w:p a="1" b=\'x &amp; y\'><w:t xml:space="preserve"> A &lt; B </w:t><w:br/><![CDATA[<roh>]]></w:p>'

describe('tokenizeXml', () => {
  it('keeps exact positions so that slices reproduce the original', () => {
    const tokens = tokenizeXml(XML)
    expect(tokens.map((t) => XML.slice(t.start, t.end)).join('')).toBe(XML)
    expect(tokens[0]).toMatchObject({ kind: 'other', start: 0 })
  })

  it('classifies tokens and decodes text and attributes', () => {
    const tokens = tokenizeXml(XML)
    expect(tokens.map((t) => t.kind)).toEqual([
      'other',
      'other',
      'open',
      'open',
      'text',
      'close',
      'open',
      'cdata',
      'close',
    ])
    expect(tokens[2]).toMatchObject({
      name: 'w:p',
      attributes: { a: '1', b: 'x & y' },
      selfClosing: false,
    })
    expect(tokens[4]).toMatchObject({ kind: 'text', text: ' A < B ' })
    expect(tokens[6]).toMatchObject({ name: 'w:br', selfClosing: true })
    expect(tokens[7]).toMatchObject({ kind: 'cdata', text: '<roh>' })
    expect(tokens[8]).toMatchObject({ kind: 'close', name: 'w:p' })
  })
})

describe('entities', () => {
  it('decodes named and numeric entities but never resolves custom ones', () => {
    expect(decodeEntities('&lt;&gt;&quot;&apos;&amp; &#228; &#x1F600; &custom; &#0;')).toBe(
      '<>"\'& ä 😀 &custom; &#0;',
    )
  })

  it('escapes attributes and text', () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;')
    expect(escapeXmlText(`a&b<c>"d'`)).toBe(`a&amp;b&lt;c&gt;"d'`)
  })

  it('parses attributes with single and double quotes', () => {
    expect(parseAttributes(` x="1" y='2'`)).toEqual({ x: '1', y: '2' })
  })
})

describe('applyEdits', () => {
  it('applies non-overlapping edits independent of their order', () => {
    expect(
      applyEdits('0123456789', [
        { start: 1, end: 3, replacement: 'A' },
        { start: 7, end: 7, replacement: 'B' },
        { start: 4, end: 5, replacement: '' },
      ]),
    ).toBe('0A356B789')
  })

  it('rejects overlapping or inverted edits', () => {
    expect(() =>
      applyEdits('0123', [
        { start: 0, end: 2, replacement: '' },
        { start: 1, end: 3, replacement: '' },
      ]),
    ).toThrow('Überlappende')
    expect(() => applyEdits('0123', [{ start: 3, end: 1, replacement: '' }])).toThrow()
  })
})
