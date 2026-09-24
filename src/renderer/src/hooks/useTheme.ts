import { useEffect } from 'react'
import type { Theme } from '@shared/types'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return prefersDark ? 'dark' : 'light'
  return theme
}

/** Setzt `data-theme` am <html>-Element und folgt bei „system“ dem Betriebssystem */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media.matches)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
