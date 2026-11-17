import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { MAX_CV_FILE_BYTES, MAX_VARIANT_CHANGES } from '@shared/constants'
import { fail, ok, type AiResult } from '@shared/domain/cv/aiErrors'
import { normalizeAssessment } from '@shared/domain/cv/assessment'
import { findInventedNumbers } from '@shared/domain/cv/plausibility'
import { lengthRatio, mergeRewrite, variantText, type Rewrites } from '@shared/domain/cv/rewrite'
import type {
  CvFormat,
  CvOptimizationRequest,
  CvOptimizationResult,
  CvSource,
  CvVariant,
  GenerationOutput,
} from '@shared/domain/cv/schemas'
import { VARIANT_STYLE_LABELS, VARIANT_STYLES, type VariantStyle } from '@shared/domain/cv/styles'
import type { FileSaveOutcome } from '@shared/ipc'
import type { ApplicationDocument } from '@shared/types'
import type { AiClient } from '../ai/claudeClient'
import type { SecretStore } from '../ai/secretStore'
import type { DocumentService } from '../documents/documentService'
import { removeFileIfExists, writeFileAtomic } from '../storage/atomicWrite'
import {
  checkCvFileName,
  readCvDocument,
  writeCvDocument,
  type LoadedCvDocument,
} from './cvDocument'

export const CV_DIR_NAME = 'cv'
const DEFAULT_CHANGE = 'Formulierungen an die Stellenanzeige angepasst'

export interface CvServiceDeps {
  /** Benutzerdatenverzeichnis; Quelle und Ergebnis liegen unter `cv/` */
  dir: string
  secrets: Pick<SecretStore, 'get'>
  ai: Pick<AiClient, 'generateVariant' | 'assessAll'>
  documents: Pick<DocumentService, 'importBuffer'>
  now(): Date
  newId(): string
}

/** Fragt den Zielpfad für eine Variante ab; `null` = abgebrochen */
export type ChooseVariantPath = (suggestedName: string, format: CvFormat) => Promise<string | null>

export interface CvService {
  /** Liest einen Lebenslauf ein und merkt ihn als aktuelle Quelle */
  loadSource(filePath: string): Promise<AiResult<CvSource>>
  optimize(request: CvOptimizationRequest): Promise<AiResult<CvOptimizationResult>>
  /** Bricht einen laufenden Lauf ab; der wartende Aufruf liefert `canceled` */
  cancel(): void
  isRunning(): boolean
  /** Schreibt eine Variante des letzten Ergebnisses im Originaldesign an einen gewählten Ort */
  saveVariant(
    style: VariantStyle,
    choosePath: ChooseVariantPath,
  ): Promise<AiResult<FileSaveOutcome>>
  /** Legt eine Variante des letzten Ergebnisses als Dokument an einer Bewerbung ab */
  attachVariant(style: VariantStyle, applicationId: string): Promise<AiResult<ApplicationDocument>>
}

interface CurrentSource {
  bytes: Uint8Array
  document: LoadedCvDocument
}

/** Letztes Ergebnis mit der Quelle, aus der es entstanden ist */
interface LastRun {
  result: CvOptimizationResult
  source: CurrentSource
}

interface VariantFile {
  fileName: string
  format: CvFormat
  bytes: Uint8Array
}

/** „Lebenslauf.docx“ + ATS → „Lebenslauf – ATS-optimiert.docx“ */
export function variantFileName(fileName: string, style: VariantStyle): string {
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''
  return `${base} – ${VARIANT_STYLE_LABELS[style]}${extension}`
}

function cleanChanges(changes: string[]): string[] {
  const cleaned = changes.map((change) => change.trim()).filter(Boolean)
  return cleaned.length ? cleaned.slice(0, MAX_VARIANT_CHANGES) : [DEFAULT_CHANGE]
}

export function createCvService(deps: CvServiceDeps): CvService {
  const cvDir = join(deps.dir, CV_DIR_NAME)
  let current: CurrentSource | null = null
  let last: LastRun | null = null
  let controller: AbortController | null = null
  let canceledByUser = false

  function buildVariant(style: VariantStyle): AiResult<VariantFile> {
    const variant = last?.result.variants.find((candidate) => candidate.style === style)
    if (!last || !variant) return fail('no-source')
    const { bytes, document } = last.source
    return ok({
      fileName: variantFileName(document.source.fileName, style),
      format: document.source.format,
      bytes: writeCvDocument(bytes, document, variant.rewrites),
    })
  }

  async function saveVariant(
    style: VariantStyle,
    choosePath: ChooseVariantPath,
  ): Promise<AiResult<FileSaveOutcome>> {
    const built = buildVariant(style)
    if (!built.ok) return built
    const filePath = await choosePath(built.value.fileName, built.value.format)
    if (!filePath) return ok({ canceled: true })
    try {
      await writeFile(filePath, built.value.bytes)
      return ok({ canceled: false, filePath })
    } catch {
      return fail('save-failed')
    }
  }

  async function attachVariant(
    style: VariantStyle,
    applicationId: string,
  ): Promise<AiResult<ApplicationDocument>> {
    const built = buildVariant(style)
    if (!built.ok) return built
    try {
      const { fileName, bytes } = built.value
      return ok(await deps.documents.importBuffer(applicationId, fileName, bytes))
    } catch {
      return fail('save-failed')
    }
  }

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
    const source = current
    try {
      const result = await run(key, source, request, abort)
      if (canceledByUser) return fail('canceled')
      if (result.ok) last = { result: result.value, source }
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

  return {
    loadSource,
    optimize,
    cancel,
    isRunning: () => controller !== null,
    saveVariant,
    attachVariant,
  }
}
