import { describe, expect, it } from 'vitest'
import { MIN_WIDTH, createWindowOptions, decideNavigation, isExternalUrl } from '../../../src/main/window'

describe('window', () => {
  it('uses secure web preferences', () => {
    const options = createWindowOptions('/app/preload')
    expect(options.minWidth).toBe(MIN_WIDTH)
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    })
    expect(options.webPreferences?.preload).toMatch(/preload[\\/]index\.js$/)
  })

  it('only allows safe external URLs', () => {
    expect(isExternalUrl('https://example.com')).toBe(true)
    expect(isExternalUrl('mailto:a@b.de')).toBe(true)
    expect(isExternalUrl('tel:+49123')).toBe(true)
    expect(isExternalUrl('file:///C:/Windows')).toBe(false)
    expect(isExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('decides how to handle navigation', () => {
    expect(decideNavigation('http://localhost:5173/#x', 'http://localhost:5173')).toBe('allow')
    expect(decideNavigation('mailto:a@b.de', 'http://localhost:5173')).toBe('external')
    expect(decideNavigation('tel:+49123')).toBe('external')
    expect(decideNavigation('file:///C:/evil.html')).toBe('block')
  })
})
