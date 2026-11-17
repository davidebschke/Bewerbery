import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Schreibt eine Datei atomar (Temp-Datei + Rename), legt fehlende Ordner an */
export async function writeFileAtomic(
  filePath: string,
  content: string | Uint8Array,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  await writeFile(tmp, content)
  await rename(tmp, filePath)
}

/** Löscht eine Datei, falls vorhanden */
export async function removeFileIfExists(filePath: string): Promise<void> {
  await rm(filePath, { force: true })
}

export function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}
