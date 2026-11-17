import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Constitution I (Opt-in-Ausnahme): Netzwerkcode liegt ausschließlich in `src/main/ai/`.
 * Dieser Test verhindert, dass das SDK oder andere Netzwerk-APIs an anderer Stelle auftauchen.
 */
const SRC = join(__dirname, '../../../../src')
const AI_DIR = `main${sep}ai${sep}`

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
  })
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  code: readFileSync(path, 'utf8'),
}))

describe('network boundary', () => {
  it('imports the anthropic sdk only in src/main/ai', () => {
    const importers = files
      .filter(({ code }) => /from ['"]@anthropic-ai\/sdk/.test(code))
      .map(({ path }) => path)
    expect(importers.length).toBeGreaterThan(0)
    expect(importers.filter((path) => !path.startsWith(AI_DIR))).toEqual([])
  })

  it('uses no other network apis in the app code', () => {
    const pattern = /\bfetch\(|XMLHttpRequest|new WebSocket|from ['"]node:(https?|net|tls)['"]/
    const offenders = files.filter(({ code }) => pattern.test(code)).map(({ path }) => path)
    expect(offenders).toEqual([])
  })
})
