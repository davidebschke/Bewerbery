import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, ok, type AiResult } from '@shared/domain/cv/aiErrors'
import type { AssessmentOutput, GenerationOutput } from '@shared/domain/cv/schemas'
import type { VariantStyle } from '@shared/domain/cv/styles'
import { makeCvResult } from '@shared/testing/cvFixtures'
import type { AiClient } from '../../../../src/main/ai/claudeClient'
import { readCvDocument } from '../../../../src/main/cv/cvDocument'
import {
  createCvService,
  variantFileName,
  type CvServiceDeps,
} from '../../../../src/main/cv/cvService'
import { createLastResultStore } from '../../../../src/main/cv/lastResultStore'
import { buildDocx, buildOdt, PDF_BYTES } from '../../../fixtures/cv/buildFixtures'

const KEY = 'sk-ant-api03-test'
const REQUEST = {
  jobDescription: 'React, TypeScript, Vitest',
  applicationId: 'app-1',
  jobTitle: 'Dev',
}

const raw = (score: number) => ({
  score,
  coveredKeywords: ['React', 'Kubernetes'],
  missingKeywords: ['Vitest'],
})
const ASSESSMENT: AssessmentOutput = {
  original: raw(50),
  factual: raw(70),
  impactful: raw(75),
  ats: raw(80),
}

function generation(style: VariantStyle): GenerationOutput {
  const texts: Record<VariantStyle, string> = {
    factual: 'Senior Frontend-Entwickler',
    impactful: 'Frontend-Entwickler mit 12 Projekten',
    ats: 'Frontend-Entwickler (React)',
  }
  return {
    paragraphs: [
      { id: 'p2', segments: ['2019 – 2023', texts[style]] },
      { id: 'p99', segments: ['unbekannt'] },
    ],
    changes: style === 'factual' ? ['  ', ''] : ['Titel geschärft', ...Array(6).fill('mehr')],
  }
}

let dir: string
let docxPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-cv-'))
  docxPath = join(dir, 'Lebenslauf.docx')
  await writeFile(docxPath, buildDocx())
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function setup(overrides: Partial<CvServiceDeps> = {}, ai: Partial<AiClient> = {}) {
  const deps: CvServiceDeps = {
    secrets: { get: vi.fn(async () => KEY) },
    lastResults: createLastResultStore(join(dir, 'cv')),
    ai: {
      generateVariant: vi.fn(async (_key, style: VariantStyle) => ok(generation(style))),
      assessAll: vi.fn(async () => ok(ASSESSMENT)),
      ...ai,
    },
    documents: {
      importBuffer: vi.fn(async (_id: string, name: string, bytes: Uint8Array) => ({
        id: 'd1',
        name,
        storedName: `d1-${name}`,
        size: bytes.length,
        addedAt: '2026-11-17T10:00:00.000Z',
      })),
    },
    now: () => new Date('2026-11-17T10:00:00.000Z'),
    newId: () => 'result-1',
    ...overrides,
  }
  return { deps, service: createCvService(deps) }
}

describe('variantFileName', () => {
  it('appends the style label before the extension', () => {
    expect(variantFileName('Lebenslauf.docx', 'ats')).toBe('Lebenslauf – ATS-optimiert.docx')
    expect(variantFileName('CV.v2.odt', 'factual')).toBe('CV.v2 – Sachlich.odt')
    expect(variantFileName('ohne-endung', 'impactful')).toBe('ohne-endung – Wirkungsstark')
  })
})

describe('cvService variants', () => {
  async function optimized() {
    const setupResult = setup()
    await setupResult.service.loadSource(docxPath)
    const result = await setupResult.service.optimize(REQUEST)
    if (!result.ok) throw new Error(result.error)
    return setupResult
  }

  it('needs a finished optimization', async () => {
    const { service } = setup()
    expect(await service.saveVariant('ats', vi.fn())).toEqual({ ok: false, error: 'no-source' })
    expect(await service.attachVariant('ats', 'app-1')).toEqual({ ok: false, error: 'no-source' })
  })

  it('saves a variant in the original design to the chosen path', async () => {
    const { service } = await optimized()
    const target = join(dir, 'Ziel.docx')
    const choose = vi.fn(async () => target)

    expect(await service.saveVariant('factual', choose)).toEqual({
      ok: true,
      value: { canceled: false, filePath: target },
    })
    expect(choose).toHaveBeenCalledWith('Lebenslauf – Sachlich.docx', 'docx')

    const written = readCvDocument(new Uint8Array(await readFile(target)), 'Ziel.docx')
    if (!written.ok) throw new Error(written.error)
    expect(written.value.source.paragraphs[2].segments).toEqual([
      '2019 – 2023',
      'Senior Frontend-Entwickler',
    ])
    const original = readCvDocument(buildDocx(), 'x.docx')
    if (!original.ok) throw new Error(original.error)
    expect(written.value.source.paragraphs.map((p) => p.segments.length)).toEqual(
      original.value.source.paragraphs.map((p) => p.segments.length),
    )
  })

  it('keeps using the source of the result after another file was loaded', async () => {
    const { service } = await optimized()
    const odtPath = join(dir, 'Anderer.odt')
    await writeFile(odtPath, buildOdt())
    await service.loadSource(odtPath)
    const choose = vi.fn(async () => null)
    expect(await service.saveVariant('ats', choose)).toEqual({
      ok: true,
      value: { canceled: true },
    })
    expect(choose).toHaveBeenCalledWith('Lebenslauf – ATS-optimiert.docx', 'docx')
  })

  it('reports write errors', async () => {
    const { service } = await optimized()
    const choose = vi.fn(async () => join(dir, 'fehlt', 'ordner', 'x.docx'))
    expect(await service.saveVariant('ats', choose)).toEqual({ ok: false, error: 'save-failed' })
  })

  it('attaches a variant to an application', async () => {
    const { service, deps } = await optimized()
    const result = await service.attachVariant('impactful', 'app-1')
    expect(result).toMatchObject({ ok: true, value: { name: 'Lebenslauf – Wirkungsstark.docx' } })
    const [id, name, bytes] = vi.mocked(deps.documents.importBuffer).mock.calls[0]
    expect([id, name]).toEqual(['app-1', 'Lebenslauf – Wirkungsstark.docx'])
    expect(readCvDocument(bytes, name).ok).toBe(true)

    vi.mocked(deps.documents.importBuffer).mockRejectedValueOnce(new Error('disk'))
    expect(await service.attachVariant('ats', 'app-1')).toEqual({
      ok: false,
      error: 'save-failed',
    })
  })
})

describe('cvService last result', () => {
  it('persists a successful run and restores it in a new session', async () => {
    const first = setup()
    await first.service.loadSource(docxPath)
    const result = await first.service.optimize(REQUEST)
    if (!result.ok) throw new Error(result.error)
    expect((await readdir(join(dir, 'cv'))).sort()).toEqual([
      'last-result.json',
      'last-source.docx',
    ])
    expect(await first.service.getLastResult()).toEqual(result.value)

    // Neustart: neuer Service, gleiche Dateien
    const second = setup()
    expect(await second.service.getLastResult()).toEqual(result.value)
    const choose = vi.fn(async () => join(dir, 'nach-neustart.docx'))
    expect((await second.service.saveVariant('ats', choose)).ok).toBe(true)
    const written = readCvDocument(
      new Uint8Array(await readFile(join(dir, 'nach-neustart.docx'))),
      'x.docx',
    )
    expect(written.ok && written.value.source.paragraphs[2].segments[1]).toBe(
      'Frontend-Entwickler (React)',
    )
  })

  it('returns null without a stored run and discards on request', async () => {
    const { service } = setup()
    expect(await service.getLastResult()).toBeNull()

    await service.loadSource(docxPath)
    await service.optimize(REQUEST)
    await service.clearLastResult()
    expect(await service.getLastResult()).toBeNull()
    expect(await readdir(join(dir, 'cv'))).toEqual([])
    expect(await setup().service.getLastResult()).toBeNull()
  })

  it('drops a stored run whose source can no longer be read', async () => {
    const lastResults = createLastResultStore(join(dir, 'cv'))
    await lastResults.save({ result: makeCvResult(), sourceBytes: PDF_BYTES })
    const { service } = setup({ lastResults })
    expect(await service.getLastResult()).toBeNull()
    expect(await readdir(join(dir, 'cv'))).toEqual([])
  })

  it('keeps the result even if persisting fails', async () => {
    const lastResults = {
      save: vi.fn(async () => {
        throw new Error('disk full')
      }),
      load: vi.fn(async () => null),
      clear: vi.fn(async () => undefined),
    }
    const { service } = setup({ lastResults })
    await service.loadSource(docxPath)
    const result = await service.optimize(REQUEST)
    expect(result.ok).toBe(true)
    expect((await service.getLastResult())?.id).toBe('result-1')
  })
})

describe('cvService.loadSource', () => {
  it('reads docx and odt files without writing anything yet', async () => {
    const { service } = setup()
    const result = await service.loadSource(docxPath)
    if (!result.ok) throw new Error(result.error)
    expect(result.value.fileName).toBe('Lebenslauf.docx')

    const odtPath = join(dir, 'CV.odt')
    await writeFile(odtPath, buildOdt())
    const odt = await service.loadSource(odtPath)
    expect(odt.ok && odt.value.format).toBe('odt')
    expect(await readdir(dir)).not.toContain('cv')
  })

  it('rejects pdfs, oversized and unreadable files', async () => {
    const { service } = setup()
    const pdf = join(dir, 'cv.pdf')
    await writeFile(pdf, PDF_BYTES)
    expect(await service.loadSource(pdf)).toEqual({ ok: false, error: 'pdf-not-supported' })

    const big = join(dir, 'gross.docx')
    await writeFile(big, new Uint8Array(10 * 1024 * 1024 + 1))
    expect(await service.loadSource(big)).toEqual({ ok: false, error: 'file-too-large' })
    const bigPdf = join(dir, 'gross.pdf')
    await writeFile(bigPdf, new Uint8Array(10 * 1024 * 1024 + 1))
    expect(await service.loadSource(bigPdf)).toEqual({ ok: false, error: 'pdf-not-supported' })

    expect(await service.loadSource(join(dir, 'fehlt.docx'))).toEqual({
      ok: false,
      error: 'unreadable-file',
    })
  })
})

describe('cvService.optimize', () => {
  it('requires a key and a source', async () => {
    const noKey = setup({ secrets: { get: vi.fn(async () => null) } })
    expect(await noKey.service.optimize(REQUEST)).toEqual({ ok: false, error: 'no-key' })
    const { service } = setup()
    expect(await service.optimize(REQUEST)).toEqual({ ok: false, error: 'no-source' })
  })

  it('generates three variants in parallel and assesses them together', async () => {
    const { service, deps } = setup()
    await service.loadSource(docxPath)
    const result = await service.optimize(REQUEST)
    if (!result.ok) throw new Error(result.error)

    expect(deps.ai.generateVariant).toHaveBeenCalledTimes(3)
    const texts = vi.mocked(deps.ai.assessAll).mock.calls[0][1]
    expect(texts.original).toContain('2019 – 2023 Frontend-Entwickler')
    expect(texts.ats).toContain('2019 – 2023 Frontend-Entwickler (React)')

    const value = result.value
    expect(value).toMatchObject({
      id: 'result-1',
      createdAt: '2026-11-17T10:00:00.000Z',
      applicationId: 'app-1',
      jobTitle: 'Dev',
    })
    expect(value.originalAssessment).toEqual({
      score: 50,
      coveredKeywords: ['React'],
      missingKeywords: ['Kubernetes', 'Vitest'],
    })
    expect(value.variants.map((variant) => variant.style)).toEqual(['factual', 'impactful', 'ats'])

    const [factual, impactful, ats] = value.variants
    expect(factual.rewrites).toEqual({ p2: ['2019 – 2023', 'Senior Frontend-Entwickler'] })
    expect(factual.changes).toEqual(['Formulierungen an die Stellenanzeige angepasst'])
    expect(impactful.changes).toHaveLength(5)
    expect(impactful.inventedNumbers).toEqual(['12'])
    expect(ats.assessment.coveredKeywords).toEqual(['React'])
    expect(ats.lengthRatio).toBeGreaterThan(1)
    expect(factual.inventedNumbers).toEqual([])
  })

  it('aborts the remaining styles when one fails and reports its error', async () => {
    const signals: AbortSignal[] = []
    const { service } = setup(
      {},
      {
        generateVariant: vi.fn(async (_key, style: VariantStyle, _source, _job, signal) => {
          signals.push(signal!)
          if (style === 'impactful') return fail('rate-limit')
          await new Promise((resolve) => setTimeout(resolve, 5))
          return signal!.aborted ? fail('canceled') : ok(generation(style))
        }),
      },
    )
    await service.loadSource(docxPath)
    expect(await service.optimize(REQUEST)).toEqual({ ok: false, error: 'rate-limit' })
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(service.isRunning()).toBe(false)
  })

  it('reports assessment errors', async () => {
    const { service } = setup({}, { assessAll: vi.fn(async () => fail('bad-response')) })
    await service.loadSource(docxPath)
    expect(await service.optimize(REQUEST)).toEqual({ ok: false, error: 'bad-response' })
  })

  it('allows only one run at a time and can be canceled', async () => {
    let release: () => void = () => undefined
    const { service } = setup(
      {},
      {
        generateVariant: vi.fn(
          (_key, style: VariantStyle, _source, _job, signal) =>
            new Promise<AiResult<GenerationOutput>>((resolve) => {
              release = () => resolve(ok(generation(style)))
              signal!.addEventListener('abort', () => resolve(fail('canceled')))
            }),
        ),
      },
    )
    await service.loadSource(docxPath)
    const running = service.optimize(REQUEST)
    await vi.waitFor(() => expect(service.isRunning()).toBe(true))
    expect(await service.optimize(REQUEST)).toEqual({ ok: false, error: 'busy' })

    service.cancel()
    expect(await running).toEqual({ ok: false, error: 'canceled' })
    expect(service.isRunning()).toBe(false)
    release()
    service.cancel()
  })

  it('reports canceled even when the ai finishes after the user canceled', async () => {
    let finish: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (finish = resolve))
    const { service } = setup(
      {},
      {
        generateVariant: vi.fn(async (_key, style: VariantStyle) => {
          await gate
          return ok(generation(style))
        }),
      },
    )
    await service.loadSource(docxPath)
    const running = service.optimize(REQUEST)
    await vi.waitFor(() => expect(service.isRunning()).toBe(true))
    service.cancel()
    finish()
    expect(await running).toEqual({ ok: false, error: 'canceled' })
  })

  it('turns unexpected exceptions into server errors', async () => {
    const { service } = setup(
      {},
      {
        assessAll: vi.fn(async () => {
          throw new Error('boom')
        }),
      },
    )
    await service.loadSource(docxPath)
    expect(await service.optimize(REQUEST)).toEqual({ ok: false, error: 'server' })
  })
})
