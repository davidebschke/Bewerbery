import { describe, expect, it } from 'vitest'
import { installMockApi } from '../../../../../src/renderer/src/test/mockApi'
import { getApi } from '../../../../../src/renderer/src/lib/api'
import { cn } from '../../../../../src/renderer/src/lib/cn'
import { formatFileSize } from '../../../../../src/renderer/src/lib/format'

describe('lib', () => {
  it('joins class names', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('formats file sizes in German', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1,5 MB')
  })

  it('returns the preload api', () => {
    const api = installMockApi()
    expect(getApi()).toBe(api)
  })
})
