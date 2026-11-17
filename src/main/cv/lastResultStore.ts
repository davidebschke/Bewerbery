import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cvOptimizationResultSchema, type CvOptimizationResult } from '@shared/domain/cv/schemas'
import { removeFileIfExists, writeFileAtomic } from '../storage/atomicWrite'

export const LAST_RESULT_FILE = 'last-result.json'
const SOURCE_FILES = ['last-source.docx', 'last-source.odt']

export interface StoredRun {
  result: CvOptimizationResult
  /** Originaldatei, aus der das Ergebnis entstanden ist */
  sourceBytes: Uint8Array
}

export interface LastResultStore {
  save(run: StoredRun): Promise<void>
  /** `null`, wenn nichts gespeichert oder die Daten ungültig sind (dann wird aufgeräumt) */
  load(): Promise<StoredRun | null>
  clear(): Promise<void>
}

/** Speichert das letzte Optimierungsergebnis samt Quelldatei unter `<dir>/` */
export function createLastResultStore(dir: string): LastResultStore {
  const resultPath = join(dir, LAST_RESULT_FILE)
  const sourcePath = (format: string) => join(dir, `last-source.${format}`)

  async function clear(): Promise<void> {
    await removeFileIfExists(resultPath)
    for (const name of SOURCE_FILES) await removeFileIfExists(join(dir, name))
  }

  async function save({ result, sourceBytes }: StoredRun): Promise<void> {
    await clear()
    await writeFileAtomic(sourcePath(result.source.format), sourceBytes)
    await writeFileAtomic(resultPath, JSON.stringify(result))
  }

  async function load(): Promise<StoredRun | null> {
    let raw: string
    try {
      raw = await readFile(resultPath, 'utf8')
    } catch {
      return null
    }
    try {
      const result = cvOptimizationResultSchema.parse(JSON.parse(raw))
      const sourceBytes = new Uint8Array(await readFile(sourcePath(result.source.format)))
      return { result, sourceBytes }
    } catch {
      await clear()
      return null
    }
  }

  return { save, load, clear }
}
