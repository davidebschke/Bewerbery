import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isMissingFile,
  removeFileIfExists,
  writeFileAtomic,
} from '../../../../src/main/storage/atomicWrite'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-atomic-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('atomicWrite', () => {
  it('writes text and bytes into nested folders without leaving temp files', async () => {
    const textFile = join(dir, 'a', 'b', 'text.json')
    await writeFileAtomic(textFile, '{"ok":true}')
    expect(await readFile(textFile, 'utf8')).toBe('{"ok":true}')

    const binFile = join(dir, 'a', 'bin.dat')
    await writeFileAtomic(binFile, new Uint8Array([1, 2, 3]))
    expect([...(await readFile(binFile))]).toEqual([1, 2, 3])
    expect(await readdir(join(dir, 'a'))).toEqual(['b', 'bin.dat'])
  })

  it('removes files and ignores missing ones', async () => {
    const file = join(dir, 'x.txt')
    await writeFileAtomic(file, 'x')
    await removeFileIfExists(file)
    await removeFileIfExists(file)
    expect(await readdir(dir)).toEqual([])
  })

  it('detects missing-file errors', async () => {
    const error = await readFile(join(dir, 'fehlt')).catch((e: unknown) => e)
    expect(isMissingFile(error)).toBe(true)
    expect(isMissingFile(new Error('x'))).toBe(false)
    expect(isMissingFile(undefined)).toBe(false)
  })
})
