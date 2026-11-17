import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { paragraphText } from '@shared/domain/cv/rewrite'
import { readCvDocument, writeCvDocument } from '../../../../src/main/cv/cvDocument'

/**
 * Prüft den Parser gegen echte, von LibreOffice gespeicherte Lebensläufe
 * (tests/fixtures/cv/samples, erzeugt mit scripts/generate-cv-samples.mjs).
 */
const SAMPLES = join(__dirname, '../../../fixtures/cv/samples')
const read = (name: string) => new Uint8Array(readFileSync(join(SAMPLES, name)))

function load(name: string) {
  const result = readCvDocument(read(name), name)
  if (!result.ok) throw new Error(`${name}: ${result.error}`)
  return result.value
}

const CVS = [
  ['01-backend-lena-hoffmann', 'Lena Hoffmann', 'Senior Backend-Entwicklerin'],
  ['02-ai-engineer-jonas-weber', 'Jonas Weber', 'AI Engineer · LLM-Anwendungen & MLOps'],
  ['03-junior-frontend-aylin-demir', 'Aylin Demir', 'Junior Frontend-Entwicklerin'],
  ['04-ai-lead-michael-brandt-en', 'Dr. Michael Brandt', 'Head of AI Engineering'],
] as const

describe.each(['docx', 'odt'] as const)('sample cvs as %s', (format) => {
  it.each(CVS)('reads %s with name and role', (base, name, role) => {
    const { source } = load(`${base}.${format}`)
    const texts = source.paragraphs.map(paragraphText)
    expect(source.format).toBe(format)
    expect(texts).toContain(role)
    expect(texts.some((text) => text.includes(name))).toBe(true)
    expect(source.paragraphs.filter((p) => p.editable).length).toBeGreaterThan(10)
  })

  it('keeps bold labels and their values in separate segments', () => {
    const { source } = load(`01-backend-lena-hoffmann.${format}`)
    const skills = source.paragraphs.find((p) => p.segments[0] === 'Frameworks: ')
    expect(skills?.segments).toEqual(['Frameworks: ', 'Spring Boot, Ktor, Hibernate'])
  })

  it('finds the contact details inside the text frame exactly once', () => {
    const { source } = load(`02-ai-engineer-jonas-weber.${format}`)
    const mails = source.paragraphs.filter((p) => paragraphText(p).includes('jonas.weber@'))
    expect(mails).toHaveLength(1)
  })

  it('rewrites a sample without touching any other package entry', () => {
    const bytes = read(`03-junior-frontend-aylin-demir.${format}`)
    const document = load(`03-junior-frontend-aylin-demir.${format}`)
    const target = document.source.paragraphs.find((p) =>
      paragraphText(p).startsWith('Umsetzung von Komponenten'),
    )!
    const written = writeCvDocument(bytes, document, {
      [target.id]: [
        'Entwicklung barrierefreier React-Komponenten mit TypeScript nach Figma-Vorlagen',
      ],
    })

    const before = unzipSync(bytes)
    const after = unzipSync(written)
    expect(Object.keys(after)).toEqual(Object.keys(before))
    for (const entry of Object.keys(before)) {
      if (entry === document.mainEntry) continue
      expect(after[entry], entry).toEqual(before[entry])
    }
    const reread = readCvDocument(written, `x.${format}`)
    if (!reread.ok) throw new Error(reread.error)
    expect(reread.value.source.paragraphs.map((p) => p.segments.length)).toEqual(
      document.source.paragraphs.map((p) => p.segments.length),
    )
    expect(reread.value.source.paragraphs.map(paragraphText)).toContain(
      'Entwicklung barrierefreier React-Komponenten mit TypeScript nach Figma-Vorlagen',
    )
  })

  it('rejects the cv with tracked changes', () => {
    const name = `05-aenderungen-nachverfolgt.${format}`
    expect(readCvDocument(read(name), name)).toEqual({ ok: false, error: 'tracked-changes' })
  })
})

describe('sample pdf', () => {
  it('is rejected with the pdf hint', () => {
    const name = '02-ai-engineer-jonas-weber.pdf'
    expect(readCvDocument(read(name), name)).toEqual({ ok: false, error: 'pdf-not-supported' })
  })
})
