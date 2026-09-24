import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DATA_FILE_NAME } from '@shared/constants'
import { createEmptyData } from '@shared/domain/factory'
import { appDataSchema } from '@shared/schemas'
import type { AppData } from '@shared/types'

export interface DataStore {
  readonly filePath: string
  load(): Promise<AppData>
  save(data: unknown): Promise<AppData>
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

/**
 * Speichert alle App-Daten als eine JSON-Datei im angegebenen Verzeichnis.
 * Schreibvorgänge sind atomar (Temp-Datei + Rename) und werden serialisiert.
 */
export function createDataStore(dir: string, now: () => Date = () => new Date()): DataStore {
  const filePath = join(dir, DATA_FILE_NAME)
  let queue: Promise<unknown> = Promise.resolve()

  async function backupCorruptFile(): Promise<void> {
    const stamp = now().toISOString().replace(/[:.]/g, '-')
    await rename(filePath, `${filePath}.corrupt-${stamp}.json`)
  }

  async function load(): Promise<AppData> {
    let raw: string
    try {
      raw = await readFile(filePath, 'utf8')
    } catch (error) {
      if (isMissingFile(error)) return createEmptyData()
      throw error
    }

    try {
      const result = appDataSchema.safeParse(JSON.parse(raw))
      if (result.success) return result.data
    } catch {
      // ungültiges JSON → Backup unten
    }
    await backupCorruptFile()
    return createEmptyData()
  }

  function save(data: unknown): Promise<AppData> {
    const task = queue.then(async () => {
      const validated = appDataSchema.parse(data)
      await mkdir(dir, { recursive: true })
      const tmp = `${filePath}.tmp`
      await writeFile(tmp, JSON.stringify(validated, null, 2), 'utf8')
      await rename(tmp, filePath)
      return validated
    })
    queue = task.catch(() => undefined)
    return task
  }

  return { filePath, load, save }
}
