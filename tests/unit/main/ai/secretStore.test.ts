import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSecretStore,
  KEY_FILE_NAME,
  KEY_META_FILE_NAME,
  type SecretCrypto,
} from '../../../../src/main/ai/secretStore'

const KEY = 'sk-ant-api03-geheimer-testschluessel-wxyz'

/** Fake-Verschlüsselung: Base64 + umgedreht – Klartext taucht nie in der Datei auf */
function fakeCrypto(available = true): SecretCrypto {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (text) =>
      Buffer.from(Buffer.from(text).toString('base64').split('').reverse().join('')),
    decryptString: (buffer) =>
      Buffer.from(buffer.toString().split('').reverse().join(''), 'base64').toString(),
  }
}

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-secret-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function allFileContents(): Promise<string> {
  const names = await readdir(dir)
  const contents = await Promise.all(names.map((name) => readFile(join(dir, name), 'utf8')))
  return contents.join('\n')
}

describe('secretStore', () => {
  it('reports no key initially', async () => {
    const store = createSecretStore(dir, fakeCrypto())
    expect(await store.status()).toEqual({
      configured: false,
      hint: null,
      encryptionAvailable: true,
    })
    expect(await store.get()).toBeNull()
  })

  it('stores the key encrypted and only exposes the last 4 characters', async () => {
    const store = createSecretStore(dir, fakeCrypto())
    const result = await store.set(KEY)
    expect(result).toEqual({
      ok: true,
      value: { configured: true, hint: 'wxyz', encryptionAvailable: true },
    })
    expect(await store.get()).toBe(KEY)
    expect(await allFileContents()).not.toContain(KEY)
    expect((await readdir(dir)).sort()).toEqual([KEY_FILE_NAME, KEY_META_FILE_NAME])
  })

  it('replaces and removes a key', async () => {
    const store = createSecretStore(dir, fakeCrypto())
    await store.set(KEY)
    await store.set('sk-ant-api03-zweiter-schluessel-1234')
    expect((await store.status()).hint).toBe('1234')

    expect(await store.remove()).toEqual({
      configured: false,
      hint: null,
      encryptionAvailable: true,
    })
    expect(await readdir(dir)).toEqual([])
  })

  it('refuses to store a key without os encryption', async () => {
    const store = createSecretStore(dir, fakeCrypto(false))
    expect(await store.set(KEY)).toEqual({ ok: false, error: 'encryption-unavailable' })
    expect(await readdir(dir)).toEqual([])
    expect((await store.status()).encryptionAvailable).toBe(false)
    expect(await store.get()).toBeNull()
  })

  it('treats broken metadata or a missing key file as not configured', async () => {
    const store = createSecretStore(dir, fakeCrypto())
    await writeFile(join(dir, KEY_META_FILE_NAME), '{kaputt')
    expect((await store.status()).configured).toBe(false)

    await writeFile(join(dir, KEY_META_FILE_NAME), JSON.stringify({ hint: 'zu lang' }))
    expect((await store.status()).configured).toBe(false)

    await writeFile(join(dir, KEY_META_FILE_NAME), JSON.stringify({ hint: 'abcd' }))
    expect((await store.status()).configured).toBe(false)

    await writeFile(join(dir, KEY_FILE_NAME), '')
    expect((await store.status()).configured).toBe(false)
    expect(await store.get()).toBeNull()
  })

  it('returns null when the key cannot be decrypted', async () => {
    const crypto = fakeCrypto()
    const store = createSecretStore(dir, {
      ...crypto,
      decryptString: () => {
        throw new Error('anderes Benutzerkonto')
      },
    })
    await store.set(KEY)
    expect(await store.get()).toBeNull()
  })

  it('rethrows unexpected read errors in status', async () => {
    const store = createSecretStore(dir, fakeCrypto())
    await writeFile(join(dir, KEY_META_FILE_NAME), JSON.stringify({ hint: 'abcd' }))
    // Ordner statt Datei → EISDIR statt ENOENT
    await import('node:fs/promises').then((fs) => fs.mkdir(join(dir, KEY_FILE_NAME)))
    await expect(store.status()).rejects.toThrow()
  })
})
