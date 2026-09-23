import { appDataSchema, applicationInputSchema, applicationSchema } from '../schemas'
import type { AppData, Application, ApplicationDocument, ApplicationInput } from '../types'

export function createId(): string {
  return globalThis.crypto.randomUUID()
}

export function createEmptyData(): AppData {
  return appDataSchema.parse({})
}

export interface CreateApplicationOptions {
  id?: string
  now?: Date
  documents?: ApplicationDocument[]
}

export function createApplication(
  input: ApplicationInput,
  { id = createId(), now = new Date(), documents = [] }: CreateApplicationOptions = {},
): Application {
  const parsed = applicationInputSchema.parse(input)
  const timestamp = now.toISOString()
  return applicationSchema.parse({
    ...parsed,
    id,
    documents,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}
