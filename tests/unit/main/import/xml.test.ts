import { describe, expect, it } from 'vitest'
import {
  decodeEntities,
  escapeXml,
  ImportFileError,
  setCell,
  tooManyRows,
  trimRows,
  walkXml,
} from '../../../../src/main/import/xml'

describe('walkXml', () => {
  it('reports tags, attributes, self-closing tags, text and CDATA', () => {
    const events: string[] = []
    walkXml(
      `<?xml version="1.0"?><!DOCTYPE x><!-- Kommentar --><a x="1" y='&amp;2'><b/>Hallo &lt;Welt&gt;<![CDATA[<roh>]]></a>`,
      {
        open: (name, attributes, selfClosing) =>
          events.push(`open ${name} ${JSON.stringify(attributes)} ${selfClosing}`),
        close: (name) => events.push(`close ${name}`),
        text: (text) => events.push(`text ${text}`),
      },
    )
    expect(events).toEqual([
      'open a {"x":"1","y":"&2"} false',
      'open b {} true',
      'close b',
      'text Hallo <Welt>',
      'text <roh>',
      'close a',
    ])
  })

  it('works with partial handlers', () => {
    expect(() => walkXml('<a>t</a><b/>', {})).not.toThrow()
  })
})

describe('decodeEntities / escapeXml', () => {
  it('decodes named and numeric entities and leaves invalid ones', () => {
    expect(decodeEntities('&quot;&apos;&#228;&#xFC;&AMP;&#0;&unknown;')).toBe('"\'äü&&#0;&unknown;')
  })

  it('escapes special characters', () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;')
  })
})

describe('setCell / trimRows', () => {
  it('fills gaps in sparse tables', () => {
    const rows: string[][] = []
    setCell(rows, 2, 1, 'x')
    expect(rows).toEqual([[], [], ['', 'x']])
  })

  it('refuses tables with too many rows', () => {
    expect(() => setCell([], 5000, 0, 'x')).toThrow(ImportFileError)
    expect(tooManyRows().message).toBe(
      'Die Tabelle hat mehr als 5.000 Zeilen. Bitte teile sie auf.',
    )
  })

  it('removes trailing empty cells and rows', () => {
    expect(trimRows([['a', ' ', ''], [], ['', 'b'], [''], []])).toEqual([['a'], [], ['', 'b']])
  })
})
