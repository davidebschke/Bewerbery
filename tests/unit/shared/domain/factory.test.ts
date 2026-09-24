import { describe, expect, it } from 'vitest'
import { createApplication, createEmptyData, createId } from '../../../../src/shared/domain/factory'

describe('factory', () => {
  it('creates unique ids', () => {
    expect(createId()).not.toBe(createId())
  })

  it('creates empty data', () => {
    expect(createEmptyData().applications).toEqual([])
  })

  it('creates an application with system fields', () => {
    const now = new Date('2026-09-23T08:00:00.000Z')
    const app = createApplication({ company: ' ACME ', sentAt: '2026-09-20' }, { now })
    expect(app.company).toBe('ACME')
    expect(app.createdAt).toBe(now.toISOString())
    expect(app.updatedAt).toBe(now.toISOString())
    expect(app.stage).toBe('applied')
    expect(app.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('accepts a predefined id and documents', () => {
    const doc = { id: 'd', name: 'cv.pdf', storedName: 'd-cv.pdf', size: 1, addedAt: 'x' }
    const app = createApplication(
      { company: 'ACME', sentAt: '2026-09-20' },
      { id: 'draft-1', documents: [doc] },
    )
    expect(app.id).toBe('draft-1')
    expect(app.documents).toEqual([doc])
  })

  it('throws on invalid input', () => {
    expect(() => createApplication({ company: '', sentAt: '2026-09-20' })).toThrow()
  })
})
