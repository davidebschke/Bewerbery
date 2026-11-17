import { describe, expect, it } from 'vitest'
import { createFakeAiClient, fakeCrypto, isAiFakeMode } from '../../../../src/main/ai/fakeAi'
import { makeCvSource } from '../../../../src/shared/testing/cvFixtures'

describe('fakeAi', () => {
  it('is only active with BEWERBERY_AI_FAKE=1', () => {
    expect(isAiFakeMode({ BEWERBERY_AI_FAKE: '1' })).toBe(true)
    expect(isAiFakeMode({ BEWERBERY_AI_FAKE: 'true' })).toBe(false)
    expect(isAiFakeMode({})).toBe(false)
  })

  it('round-trips keys without storing plain text', () => {
    const key = 'sk-ant-api03-fake-key-1234'
    const encrypted = fakeCrypto.encryptString(key)
    expect(encrypted.toString()).not.toContain(key)
    expect(fakeCrypto.decryptString(encrypted)).toBe(key)
    expect(fakeCrypto.isEncryptionAvailable()).toBe(true)
  })

  it('accepts every key without network', async () => {
    expect(await createFakeAiClient().testKey('x')).toEqual({ ok: true, value: true })
  })

  it('rewrites the last segment of the longest editable paragraph per style', async () => {
    const result = await createFakeAiClient().generateVariant('x', 'ats', makeCvSource(), 'React')
    expect(result).toEqual({
      ok: true,
      value: {
        paragraphs: [
          {
            id: 'p3',
            segments: [
              'Frontend-Entwickler: ',
              'Entwicklung von Webanwendungen mit React. (ATS-optimiert)',
            ],
          },
        ],
        changes: ['ATS-optimiert: Formulierung an die Stellenanzeige angepasst'],
      },
    })
  })

  it('returns fixed scores and keywords from the job posting', async () => {
    const texts = { original: '', factual: '', impactful: '', ats: '' }
    const job = 'React, TypeScript, Vitest, Go, Kotlin und Docker'
    const result = await createFakeAiClient().assessAll('x', texts, job)
    if (!result.ok) throw new Error(result.error)
    expect(result.value.original).toEqual({
      score: 54,
      coveredKeywords: ['React', 'TypeScript', 'Vitest'],
      missingKeywords: ['Kotlin', 'und'],
    })
    expect(result.value.ats.score).toBe(83)
  })
})
