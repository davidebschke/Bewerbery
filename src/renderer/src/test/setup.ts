import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { initialState, useAppStore } from '../stores/appStore'
import { installMockApi } from './mockApi'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

beforeEach(() => {
  installMockApi()
  useAppStore.setState({ ...initialState, status: 'ready' })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
