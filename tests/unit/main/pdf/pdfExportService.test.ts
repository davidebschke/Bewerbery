import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeApplication, makeSettings } from '../../../../src/shared/testing/fixtures'
import { createPdfExportService } from '../../../../src/main/pdf/pdfExportService'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'bewerbery-pdf-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('pdfExportService', () => {
  const settings = makeSettings({ followUpWeeks: 2 })
  const today = new Date(2026, 8, 23)

  it('writes a pdf to the chosen path and suggests a dated file name', async () => {
    const filePath = join(dir, 'export.pdf')
    const saveFile = vi.fn(async () => filePath)
    const service = createPdfExportService(saveFile)

    const result = await service.exportApplications([makeApplication()], settings, today)

    expect(result).toEqual({ canceled: false, filePath })
    expect(saveFile).toHaveBeenCalledWith('Bewerbungen-Zusammenfassung-2026-09-23.pdf')
    const bytes = await readFile(filePath)
    expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('does nothing and returns canceled when the save dialog is dismissed', async () => {
    const saveFile = vi.fn(async () => null)
    const service = createPdfExportService(saveFile)

    const result = await service.exportApplications([makeApplication()], settings, today)

    expect(result).toEqual({ canceled: true })
  })
})
