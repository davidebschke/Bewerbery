import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { ApplicationDocument } from '@shared/types'

export interface DocumentService {
  readonly rootDir: string
  importFiles(applicationId: string, filePaths: string[]): Promise<ApplicationDocument[]>
  importBuffer(applicationId: string, name: string, bytes: Uint8Array): Promise<ApplicationDocument>
  resolvePath(applicationId: string, document: ApplicationDocument): string
  remove(applicationId: string, document: ApplicationDocument): Promise<void>
  removeAll(applicationId: string): Promise<void>
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

/** Verhindert Path-Traversal: nur einfache Segmente ohne Trenner */
export function assertSafeSegment(value: string): string {
  if (!SAFE_SEGMENT.test(value) || value === '.' || value === '..') {
    throw new Error(`Ungültiger Pfadbestandteil: ${value}`)
  }
  return value
}

export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  return cleaned.slice(-120) || 'dokument'
}

/** Kopiert eingereichte Dokumente in `<rootDir>/<applicationId>/` */
export function createDocumentService(
  rootDir: string,
  now: () => Date = () => new Date(),
): DocumentService {
  const applicationDir = (applicationId: string) => join(rootDir, assertSafeSegment(applicationId))

  async function importFiles(
    applicationId: string,
    filePaths: string[],
  ): Promise<ApplicationDocument[]> {
    const targetDir = applicationDir(applicationId)
    await mkdir(targetDir, { recursive: true })

    const documents: ApplicationDocument[] = []
    for (const source of filePaths) {
      const info = await stat(source)
      if (!info.isFile()) continue
      const id = randomUUID()
      const name = basename(source)
      const storedName = `${id}-${sanitizeFileName(name)}`
      await copyFile(source, join(targetDir, storedName))
      documents.push({ id, name, storedName, size: info.size, addedAt: now().toISOString() })
    }
    return documents
  }

  /** Legt erzeugte Inhalte (z. B. eine optimierte CV-Variante) als Dokument ab */
  async function importBuffer(
    applicationId: string,
    name: string,
    bytes: Uint8Array,
  ): Promise<ApplicationDocument> {
    const targetDir = applicationDir(applicationId)
    await mkdir(targetDir, { recursive: true })
    const id = randomUUID()
    const storedName = `${id}-${sanitizeFileName(name)}`
    await writeFile(join(targetDir, storedName), bytes)
    return { id, name, storedName, size: bytes.length, addedAt: now().toISOString() }
  }

  function resolvePath(applicationId: string, document: ApplicationDocument): string {
    return join(applicationDir(applicationId), assertSafeSegment(document.storedName))
  }

  async function remove(applicationId: string, document: ApplicationDocument): Promise<void> {
    await rm(resolvePath(applicationId, document), { force: true })
  }

  async function removeAll(applicationId: string): Promise<void> {
    await rm(applicationDir(applicationId), { recursive: true, force: true })
  }

  return { rootDir, importFiles, importBuffer, resolvePath, remove, removeAll }
}
