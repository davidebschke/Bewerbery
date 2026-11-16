import { describe, expect, it } from 'vitest'
import { errorMessage } from '../../../../../src/renderer/src/lib/errors'

describe('errorMessage', () => {
  it('strips the Electron IPC prefix', () => {
    const error = new Error(
      "Error invoking remote method 'import:pick-file': Error: „a.pdf“ wird nicht unterstützt.",
    )
    expect(errorMessage(error, 'x')).toBe('„a.pdf“ wird nicht unterstützt.')
  })

  it('keeps plain messages and strings', () => {
    expect(errorMessage(new Error('kaputt'), 'x')).toBe('kaputt')
    expect(errorMessage('Text', 'x')).toBe('Text')
  })

  it('falls back for empty or unknown errors', () => {
    expect(errorMessage(new Error(''), 'Fallback')).toBe('Fallback')
    expect(errorMessage({}, 'Fallback')).toBe('Fallback')
  })
})
