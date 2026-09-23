import { appDataSchema, applicationSchema, settingsSchema } from '../schemas'
import type { AppData, Application, Settings } from '../types'

let counter = 0

export function makeApplication(overrides: Partial<Application> = {}): Application {
  counter++
  return applicationSchema.parse({
    id: `app-${counter}`,
    company: `Firma ${counter}`,
    sentAt: '2026-09-01',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  })
}

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return settingsSchema.parse(overrides)
}

export function makeData(overrides: Partial<AppData> = {}): AppData {
  return appDataSchema.parse(overrides)
}
