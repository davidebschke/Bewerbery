import { vi } from 'vitest'
import { makeData } from '@shared/testing/fixtures'
import type { AppData } from '@shared/types'
import { useAppStore } from '../stores/appStore'

/** Friert nur `Date` ein – Timer bleiben echt, damit user-event funktioniert */
export function freezeToday(date = new Date(2026, 8, 23, 12)): Date {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(date)
  return date
}

export function seedStore(overrides: Partial<AppData> = {}): AppData {
  const data = makeData(overrides)
  useAppStore.setState({ data, status: 'ready' })
  return data
}
