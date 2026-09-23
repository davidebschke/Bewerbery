import type { z } from 'zod'
import type {
  appDataSchema,
  applicationDocumentSchema,
  applicationInputSchema,
  applicationSchema,
  progressSchema,
  settingsSchema,
  stageSchema,
  themeSchema,
} from './schemas'

export type Stage = z.infer<typeof stageSchema>
export type Theme = z.infer<typeof themeSchema>
export type ApplicationDocument = z.infer<typeof applicationDocumentSchema>
export type Application = z.infer<typeof applicationSchema>
export type ApplicationInput = z.input<typeof applicationInputSchema>
export type Settings = z.infer<typeof settingsSchema>
export type Progress = z.infer<typeof progressSchema>
export type AppData = z.infer<typeof appDataSchema>

export type FollowUpStatus = 'fresh' | 'soon' | 'due' | 'none'

export interface FollowUpInfo {
  status: FollowUpStatus
  /** 0..1 */
  ratio: number
  elapsedDays: number
  totalDays: number
  /** negativ = überfällig */
  daysRemaining: number
  dueDate: string
  weeks: number
}
