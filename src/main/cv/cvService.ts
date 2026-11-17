import { readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { MAX_CV_FILE_BYTES, MAX_VARIANT_CHANGES } from '@shared/constants'
import { fail, ok, type AiResult } from '@shared/domain/cv/aiErrors'
import { normalizeAssessment } from '@shared/domain/cv/assessment'
import { findInventedNumbers } from '@shared/domain/cv/plausibility'
import { lengthRatio, mergeRewrite, variantText, type Rewrites } from '@shared/domain/cv/rewrite'
import type {
  CvOptimizationRequest,
  CvOptimizationResult,
  CvSource,
  CvVariant,
  GenerationOutput,
} from '@shared/domain/cv/schemas'
import { VARIANT_STYLES, type VariantStyle } from '@shared/domain/cv/styles'
import type { AiClient } from '../ai/claudeClient'
import type { SecretStore } from '../ai/secretStore'
import { removeFileIfExists, writeFileAtomic } from '../storage/atomicWrite'
import { checkCvFileName, readCvDocument, type LoadedCvDocument } from './cvDocument'

export const CV_DIR_NAME = 'cv'
const DEFAULT_CHANGE = 'Formulierungen an die Stellenanzeige angepasst'

export interface CvServiceDeps {
  /** Benutzerdatenverzeichnis; Quelle und Ergebnis liegen unter `cv/` */
  dir: string
  secrets: Pick<SecretStore, 'get'>
  ai: Pick<AiClient, 'generateVariant' | 'assessAll'>
  now(): Date
  newId(): string
}

export interface CvService {
  /** Liest einen Lebenslauf ein und merkt ihn als aktuelle Quelle */
  loadSource(filePath: string): Promise<AiResult<CvSource>>
  optimize(request: CvOptimizationRequest): Promise<AiResult<CvOptimizationResult>>
  /** Bricht einen laufenden Lauf ab; der wartende Aufruf liefert `canceled` */
  cancel(): void
  isRunning(): boolean
}

interface CurrentSource {
  bytes: Uint8Array
  document: LoadedCvDocument
}

function cleanChanges(changes: string[]): string[] {
  const cleaned = changes.map((change) => change.trim()).filter(Boolean)
  return cleaned.length ? cleaned.slice(0, MAX_VARIANT_CHANGES) : [DEFAULT_CHANGE]
}

export function createCvService(deps: CvServiceDeps): CvService {
  const cvDir = join(deps.dir, CV_DIR_NAME)
  let current: CurrentSource | null = null
  let controller: AbortController | null = null
  let canceledByUser = false

  async function loadSource(filePath: string): Promise<AiResult<CvSource>> {
    const fileName = basename(filePath)
    try {
      const { size } = await stat(filePath)
      if (size > MAX_CV_FILE_BYTES) return fail(checkCvFileName(fileName) ?? 'file-too-large')
      const bytes = new Uint8Array(await readFile(filePath))
      const result = readCvDocument(bytes, fileName)
      if (!result.ok) return result

      const extension = result.value.source.format
      await writeFileAtomic(join(cvDir, `source.${extension}`), bytes)
      await removeFileIfExists(join(cvDir, `source.${extension === 'docx' ? 'odt' : 'docx'}`))
      current = { bytes, document: result.value }
      return ok(result.value.source)
    } catch {
      return fail('unreadable-file')
    }
  }

  /** Startet alle Stile parallel; scheitert einer, werden die übrigen abgebrochen */
  async function generateAll(
    key: string,
    source: CvSource,
    jobDescription: string,
    signal: AbortController,
  ): Promise<AiResult<Record<VariantStyle, GenerationOutput>>> {
    const results = await Promise.all(
      VARIANT_STYLES.map(async (style) => {
        const result = await deps.ai.generateVariant(
          key,
          style,
          source,
          jobDescription,
          signal.signal,
        )
        if (!result.ok) signal.abort()
        return [style, result] as const
      }),
    )
    const failure = results.find(([, result]) => !result.ok && result.error !== 'canceled')
    if (failure && !failure[1].ok) return fail(failure[1].error)
    if (results.some(([, result]) => !result.ok)) return fail('canceled')

    const outputs = Object.fromEntries(
      results.map(([style, result]) => [style, (result as { value: GenerationOutput }).value]),
    )
    return ok(outputs as Record<VariantStyle, GenerationOutput>)
  }

  async function run(
    key: string,
    { document }: CurrentSource,
    request: CvOptimizationRequest,
    abort: AbortController,
  ): Promise<AiResult<CvOptimizationResult>> {
    const { source } = document
    const generated = await generateAll(key, source, request.jobDescription, abort)
    if (!generated.ok) return generated

    const rewrites = {} as Record<VariantStyle, Rewrites>
    for (const style of VARIANT_STYLES) {
      rewrites[style] = mergeRewrite(source, generated.value[style].paragraphs)
    }
    const texts = {
      original: variantText(source),
      factual: variantText(source, rewrites.factual),
      impactful: variantText(source, rewrites.impactful),
      ats: variantText(source, rewrites.ats),
    }

    const assessed = await deps.ai.assessAll(key, texts, request.jobDescription, abort.signal)
    if (!assessed.ok) return assessed

    const variants: CvVariant[] = VARIANT_STYLES.map((style) => ({
      style,
      rewrites: rewrites[style],
      changes: cleanChanges(generated.value[style].changes),
      assessment: normalizeAssessment(assessed.value[style], texts[style]),
      inventedNumbers: findInventedNumbers(texts.original, texts[style]),
      lengthRatio: lengthRatio(source, rewrites[style]),
    }))

    return ok({
      id: deps.newId(),
      createdAt: deps.now().toISOString(),
      applicationId: request.applicationId,
      jobTitle: request.jobTitle,
      source,
      originalAssessment: normalizeAssessment(assessed.value.original, texts.original),
      variants,
    })
  }

  async function optimize(request: CvOptimizationRequest): Promise<AiResult<CvOptimizationResult>> {
    if (controller) return fail('busy')
    const key = await deps.secrets.get()
    if (!key) return fail('no-key')
    if (!current) return fail('no-source')

    const abort = new AbortController()
    controller = abort
    canceledByUser = false
    try {
      const result = await run(key, current, request, abort)
      if (canceledByUser) return fail('canceled')
      return result
    } catch {
      return fail(canceledByUser ? 'canceled' : 'server')
    } finally {
      controller = null
    }
  }

  function cancel(): void {
    if (!controller) return
    canceledByUser = true
    controller.abort()
  }

  return { loadSource, optimize, cancel, isRunning: () => controller !== null }
}
