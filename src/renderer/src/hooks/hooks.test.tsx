import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TODAY_REFRESH_MS, useToday } from './useToday'
import { resolveTheme, useTheme } from './useTheme'

describe('useToday', () => {
  it('refreshes the date periodically', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 23, 23, 59, 30))
    const { result, unmount } = renderHook(() => useToday())
    expect(result.current.getDate()).toBe(23)
    act(() => vi.advanceTimersByTime(TODAY_REFRESH_MS))
    expect(result.current.getDate()).toBe(24)
    unmount()
  })
})

describe('useTheme', () => {
  it('resolves system theme', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('applies the theme and follows OS changes', () => {
    let listener: (() => void) | undefined
    const media = {
      matches: false,
      addEventListener: vi.fn((_: string, fn: () => void) => (listener = fn)),
      removeEventListener: vi.fn(),
    }
    vi.mocked(window.matchMedia).mockReturnValue(media as unknown as MediaQueryList)

    const { rerender, unmount } = renderHook(({ theme }) => useTheme(theme), {
      initialProps: { theme: 'system' as const as 'system' | 'light' | 'dark' },
    })
    expect(document.documentElement.dataset.theme).toBe('light')

    media.matches = true
    act(() => listener?.())
    expect(document.documentElement.dataset.theme).toBe('dark')

    rerender({ theme: 'light' })
    expect(document.documentElement.dataset.theme).toBe('light')
    unmount()
    expect(media.removeEventListener).toHaveBeenCalled()
  })
})
