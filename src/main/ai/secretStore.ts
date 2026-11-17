import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { fail, ok, type AiResult } from '@shared/domain/cv/aiErrors'
import type { AiKeyStatus } from '@shared/domain/cv/schemas'
import { isMissingFile, removeFileIfExists, writeFileAtomic } from '../storage/atomicWrite'

export const KEY_FILE_NAME = 'ai-key.bin'
export const KEY_META_FILE_NAME = 'ai-key.json'

/** Verschlüsselung des Betriebssystems (in Electron: `safeStorage`) */
export interface SecretCrypto {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface SecretStore {
  status(): Promise<AiKeyStatus>
  /** Speichert den Key verschlüsselt; ersetzt einen vorhandenen */
  set(apiKey: string): Promise<AiResult<AiKeyStatus>>
  /** Entschlüsselter Key – nur für den Main-Prozess, nie an den Renderer geben */
  get(): Promise<string | null>
  remove(): Promise<AiKeyStatus>
}

const metaSchema = z.object({ hint: z.string().length(4) })

/**
 * Hält den Anthropic-API-Key verschlüsselt in einer eigenen Datei, getrennt von
 * `bewerbery-data.json`. Die Metadaten enthalten nur die letzten 4 Zeichen.
 */
export function createSecretStore(dir: string, crypto: SecretCrypto): SecretStore {
  const keyPath = join(dir, KEY_FILE_NAME)
  const metaPath = join(dir, KEY_META_FILE_NAME)

  async function readHint(): Promise<string | null> {
    try {
      const meta = metaSchema.safeParse(JSON.parse(await readFile(metaPath, 'utf8')))
      return meta.success ? meta.data.hint : null
    } catch {
      return null
    }
  }

  async function hasKeyFile(): Promise<boolean> {
    try {
      return (await readFile(keyPath)).length > 0
    } catch (error) {
      if (isMissingFile(error)) return false
      throw error
    }
  }

  async function status(): Promise<AiKeyStatus> {
    const hint = await readHint()
    const configured = hint !== null && (await hasKeyFile())
    return {
      configured,
      hint: configured ? hint : null,
      encryptionAvailable: crypto.isEncryptionAvailable(),
    }
  }

  async function set(apiKey: string): Promise<AiResult<AiKeyStatus>> {
    if (!crypto.isEncryptionAvailable()) return fail('encryption-unavailable')
    await writeFileAtomic(keyPath, crypto.encryptString(apiKey))
    await writeFileAtomic(metaPath, JSON.stringify({ hint: apiKey.slice(-4) }))
    return ok(await status())
  }

  async function get(): Promise<string | null> {
    if (!crypto.isEncryptionAvailable()) return null
    try {
      const encrypted = await readFile(keyPath)
      return encrypted.length ? crypto.decryptString(encrypted) : null
    } catch {
      // fehlende oder nicht entschlüsselbare Datei (z. B. anderes Benutzerkonto)
      return null
    }
  }

  async function remove(): Promise<AiKeyStatus> {
    await removeFileIfExists(keyPath)
    await removeFileIfExists(metaPath)
    return status()
  }

  return { status, set, get, remove }
}
