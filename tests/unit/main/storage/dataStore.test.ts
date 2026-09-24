import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeApplication, makeData } from '@shared/testing/fixtures'
import { createDataStore } from '../../../../src/main/storage/dataStore'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-store-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('dataStore', () => {
  it('returns empty data when no file exists', async () => {
    const store = createDataStore(dir)
    expect((await store.load()).applications).toEqual([])
  })

  it('saves and loads data', async () => {
    const store = createDataStore(join(dir, 'nested'))
    const data = makeData({ applications: [makeApplication({ company: 'ACME' })] })
    await store.save(data)
    const loaded = await store.load()
    expect(loaded.applications[0].company).toBe('ACME')
    const files = await readdir(join(dir, 'nested'))
    expect(files).toEqual(['bewerbery-data.json'])
  })

  it('serializes concurrent saves so the last one wins', async () => {
    const store = createDataStore(dir)
    await Promise.all(
      [1, 2, 3, 4].map((weeks) =>
        store.save(
          makeData({
            settings: { followUpWeeks: weeks, notificationsEnabled: true, theme: 'system' },
          }),
        ),
      ),
    )
    expect((await store.load()).settings.followUpWeeks).toBe(4)
  })

  it('rejects invalid data on save without touching the file', async () => {
    const store = createDataStore(dir)
    await store.save(makeData())
    await expect(store.save({ version: 1, applications: [{ id: '' }] })).rejects.toThrow()
    expect((await store.load()).applications).toEqual([])
  })

  it('keeps working after a failed write', async () => {
    const store = createDataStore(join(dir, 'blocked'))
    await writeFile(join(dir, 'blocked'), 'I am a file, not a directory')
    await expect(store.save(makeData())).rejects.toThrow()
    await rm(join(dir, 'blocked'))
    await expect(store.save(makeData())).resolves.toBeDefined()
  })

  it('backs up corrupt JSON and starts fresh', async () => {
    const now = () => new Date('2026-09-23T10:00:00.000Z')
    const store = createDataStore(dir, now)
    await writeFile(store.filePath, '{ kaputt', 'utf8')
    expect((await store.load()).applications).toEqual([])
    const files = await readdir(dir)
    expect(files).toContain('bewerbery-data.json.corrupt-2026-09-23T10-00-00-000Z.json')
  })

  it('backs up schema-invalid data', async () => {
    const store = createDataStore(dir)
    await writeFile(store.filePath, JSON.stringify({ version: 42 }), 'utf8')
    await store.load()
    const files = await readdir(dir)
    expect(files.some((f) => f.includes('.corrupt-'))).toBe(true)
    const backup = files.find((f) => f.includes('.corrupt-'))!
    expect(await readFile(join(dir, backup), 'utf8')).toContain('42')
  })

  it('rethrows unexpected read errors', async () => {
    const store = createDataStore(dir)
    // Verzeichnis statt Datei → EISDIR
    await import('node:fs/promises').then((fs) => fs.mkdir(store.filePath))
    await expect(store.load()).rejects.toThrow()
  })
})
