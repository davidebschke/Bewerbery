import { describe, expect, it } from 'vitest'
import {
  AI_ERROR_CODES,
  AI_ERROR_MESSAGES,
  fail,
  isAiErrorCode,
  ok,
} from '../../../../../src/shared/domain/cv/aiErrors'

describe('aiErrors', () => {
  it('has a german title and hint for every code', () => {
    expect(AI_ERROR_CODES).toHaveLength(18)
    for (const code of AI_ERROR_CODES) {
      expect(AI_ERROR_MESSAGES[code].title.length).toBeGreaterThan(0)
      expect(AI_ERROR_MESSAGES[code].hint.length).toBeGreaterThan(0)
    }
  })

  it('explains how to convert a pdf into a word file', () => {
    expect(AI_ERROR_MESSAGES['pdf-not-supported'].hint).toContain('als .docx')
  })

  it('builds results', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 })
    expect(fail('network')).toEqual({ ok: false, error: 'network' })
  })

  it('recognises error codes', () => {
    expect(isAiErrorCode('busy')).toBe(true)
    expect(isAiErrorCode('unknown')).toBe(false)
    expect(isAiErrorCode(42)).toBe(false)
  })
})
