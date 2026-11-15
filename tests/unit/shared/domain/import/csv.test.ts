import { describe, expect, it } from 'vitest'
import { decodeText, detectDelimiter, parseCsv } from '@shared/domain/import/csv'

describe('decodeText', () => {
  it('decodes UTF-8 with and without BOM', () => {
    const bytes = new TextEncoder().encode('Müller;Straße')
    expect(decodeText(bytes)).toBe('Müller;Straße')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]))).toBe('Müller;Straße')
  })

  it('falls back to Windows-1252 for invalid UTF-8', () => {
    // „Müller“ in Windows-1252: ü = 0xFC
    const bytes = new Uint8Array([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72, 0x80])
    expect(decodeText(bytes)).toBe('Müller€')
  })
})

describe('detectDelimiter', () => {
  it.each([
    ['a;b;c\n1;2;3', ';'],
    ['a,b,c\n1,2,3', ','],
    ['a\tb\tc\n1\t2\t3', '\t'],
    ['a|b|c\n1|2|3', '|'],
  ])('detects %j', (text, delimiter) => {
    expect(detectDelimiter(text)).toBe(delimiter)
  })

  it('ignores delimiters inside quotes and prefers consistent ones', () => {
    expect(detectDelimiter('Firma;Notiz\n"A, B und C";"x, y"\nD;"1,2"')).toBe(';')
  })

  it('defaults to semicolon for single-column text', () => {
    expect(detectDelimiter('nur eine Spalte\nnoch eine')).toBe(';')
  })
})

describe('parseCsv', () => {
  it('parses quoted fields with delimiters, quotes and line breaks', () => {
    const text = '﻿Firma;Notiz\r\n"ACME; Inc.";"Sagte ""Hallo""\nzweite Zeile"\r\nB;\n'
    expect(parseCsv(text)).toEqual([
      ['Firma', 'Notiz'],
      ['ACME; Inc.', 'Sagte "Hallo"\nzweite Zeile'],
      ['B', ''],
    ])
  })

  it('handles CR line endings, missing trailing newline and explicit delimiters', () => {
    expect(parseCsv('a,b\r1,2', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('x;y', ',')).toEqual([['x;y']])
  })

  it('keeps quotes in the middle of a field as text', () => {
    expect(parseCsv('a;5" Monitor')).toEqual([['a', '5" Monitor']])
  })

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([])
  })
})
