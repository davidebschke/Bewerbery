import { describe, expect, it } from 'vitest'
import { createFakeAiClient, fakeCrypto, isAiFakeMode } from '../../../../src/main/ai/fakeAi'

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
})
