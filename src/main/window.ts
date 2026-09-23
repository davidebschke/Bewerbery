import { join } from 'node:path'
import type { BrowserWindowConstructorOptions } from 'electron'

export const MIN_WIDTH = 360
export const MIN_HEIGHT = 560

export function createWindowOptions(preloadDir: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 820,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Bewerbery',
    backgroundColor: '#0f1020',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(preloadDir, 'index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  }
}

/** Nur http(s)- und mailto/tel-Links extern öffnen */
export function isExternalUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url)
}

export type NavigationDecision = 'allow' | 'external' | 'block'

/** Die App ist eine Single-Page-App: jede Navigation weg von ihr wird abgefangen */
export function decideNavigation(url: string, appUrl?: string): NavigationDecision {
  if (appUrl && url.startsWith(appUrl)) return 'allow'
  return isExternalUrl(url) ? 'external' : 'block'
}
