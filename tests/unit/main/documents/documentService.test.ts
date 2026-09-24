import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertSafeSegment, createDocumentService, sanitizeFileName } from '../../../../src/main/documents/documentService'

let dir: string
let sourceDir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-docs-'))
  sourceDir = join(dir, 'source')
  await mkdir(sourceDir)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('sanitizeFileName', () => {
  it('replaces unsafe characters', () => {
    expect(sanitizeFileName('Lebenslauf Müller (2026).pdf')).toBe('Lebenslauf_M_ller_2026_.pdf')
    expect(sanitizeFileName('...hidden')).toBe('hidden')
    expect(sanitizeFileName('???')).toBe('_')
    expect(sanitizeFileName('')).toBe('dokument')
  })
})

describe('assertSafeSegment', () => {
  it('rejects traversal attempts', () => {
    expect(() => assertSafeSegment('../etc')).toThrow()
    expect(() => assertSafeSegment('a/b')).toThrow()
    expect(() => assertSafeSegment('..')).toThrow()
    expect(assertSafeSegment('abc-123')).toBe('abc-123')
  })
})

describe('documentService', () => {
  const now = () => new Date('2026-09-23T10:00:00.000Z')

  it('copies files into the application folder', async () => {
    const service = createDocumentService(join(dir, 'docs'), now)
    const source = join(sourceDir, 'Anschreiben.pdf')
    await writeFile(source, 'PDF-INHALT')

    const [doc] = await service.importFiles('app-1', [source])
    expect(doc).toMatchObject({ name: 'Anschreiben.pdf', size: 10, addedAt: now().toISOString() })
    expect(doc.storedName).toMatch(/-Anschreiben\.pdf$/)

    const stored = service.resolvePath('app-1', doc)
    expect(await readFile(stored, 'utf8')).toBe('PDF-INHALT')
  })

  it('keeps duplicate names apart and skips directories', async () => {
    const service = createDocumentService(join(dir, 'docs'))
    const source = join(sourceDir, 'cv.pdf')
    await writeFile(source, 'x')
    const docs = await service.importFiles('app-1', [source, source, sourceDir])
    expect(docs).toHaveLength(2)
    expect(docs[0].storedName).not.toBe(docs[1].storedName)
  })

  it('removes single documents and whole folders', async () => {
    const service = createDocumentService(join(dir, 'docs'))
    const source = join(sourceDir, 'cv.pdf')
    await writeFile(source, 'x')
    const [a, b] = await service.importFiles('app-1', [source, source])

    await service.remove('app-1', a)
    expect(await readdir(join(dir, 'docs', 'app-1'))).toEqual([b.storedName])

    await service.removeAll('app-1')
    await expect(readdir(join(dir, 'docs', 'app-1'))).rejects.toThrow()
  })

  it('rejects unsafe ids and stored names', () => {
    const service = createDocumentService(join(dir, 'docs'))
    const doc = { id: 'd', name: 'x', storedName: '../../evil', size: 0, addedAt: '' }
    expect(() => service.resolvePath('app-1', doc)).toThrow()
    expect(() => service.resolvePath('..', { ...doc, storedName: 'ok' })).toThrow()
  })
})
