import { mkdtemp, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeCvResult, makeCvSource } from '@shared/testing/cvFixtures'
import { createLastResultStore, LAST_RESULT_FILE } from '../../../../src/main/cv/lastResultStore'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-last-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const bytes = new Uint8Array([1, 2, 3])

describe('lastResultStore', () => {
  it('returns null when nothing is stored', async () => {
    expect(await createLastResultStore(join(dir, 'cv')).load()).toBeNull()
  })

  it('saves and loads the result with its source file', async () => {
    const store = createLastResultStore(join(dir, 'cv'))
    await store.save({ result: makeCvResult(), sourceBytes: bytes })
    expect((await readdir(join(dir, 'cv'))).sort()).toEqual([
      'last-result.json',
      'last-source.docx',
    ])
    expect(await store.load()).toEqual({ result: makeCvResult(), sourceBytes: bytes })
  })

  it('replaces an older run with another format', async () => {
    const store = createLastResultStore(dir)
    await store.save({ result: makeCvResult(), sourceBytes: bytes })
    const odt = makeCvResult({ source: makeCvSource({ format: 'odt', fileName: 'CV.odt' }) })
    await store.save({ result: odt, sourceBytes: bytes })
    expect((await readdir(dir)).sort()).toEqual(['last-result.json', 'last-source.odt'])
  })

  it('cleans up invalid data or a missing source', async () => {
    const store = createLastResultStore(dir)
    await writeFile(join(dir, LAST_RESULT_FILE), '{"kaputt":true}')
    expect(await store.load()).toBeNull()
    expect(await readdir(dir)).toEqual([])

    await store.save({ result: makeCvResult(), sourceBytes: bytes })
    await unlink(join(dir, 'last-source.docx'))
    expect(await store.load()).toBeNull()
    expect(await readdir(dir)).toEqual([])
  })

  it('clears everything', async () => {
    const store = createLastResultStore(dir)
    await store.save({ result: makeCvResult(), sourceBytes: bytes })
    await store.clear()
    expect(await readdir(dir)).toEqual([])
  })
})
