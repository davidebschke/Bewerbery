import { z } from 'zod'
import {
  DATA_VERSION,
  DEFAULT_FOLLOW_UP_WEEKS,
  MAX_FOLLOW_UP_WEEKS,
  MIN_FOLLOW_UP_WEEKS,
} from './constants'

/** ISO-Datum im Format YYYY-MM-DD */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum')

export const stageSchema = z.enum(['applied', 'interview', 'offer', 'rejected'])

export const followUpWeeksSchema = z
  .number()
  .int()
  .min(MIN_FOLLOW_UP_WEEKS)
  .max(MAX_FOLLOW_UP_WEEKS)

export const applicationDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  storedName: z.string().min(1),
  size: z.number().int().nonnegative(),
  addedAt: z.string(),
})

export const applicationSchema = z.object({
  id: z.string().min(1),
  company: z.string().trim().min(1, 'Unternehmen ist erforderlich'),
  position: z.string().default(''),
  contactName: z.string().default(''),
  contactPhone: z.string().default(''),
  contactEmail: z.union([z.literal(''), z.email('Ungültige E-Mail-Adresse')]).default(''),
  sentAt: isoDateSchema,
  lastFollowUpAt: isoDateSchema.nullable().default(null),
  followUpWeeks: followUpWeeksSchema.nullable().default(null),
  stage: stageSchema.default('applied'),
  appointmentAt: z.string().nullable().default(null),
  notes: z.string().default(''),
  documents: z.array(applicationDocumentSchema).default([]),
  awardedStages: z.array(stageSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const themeSchema = z.enum(['system', 'light', 'dark'])

export const settingsSchema = z.object({
  followUpWeeks: followUpWeeksSchema.default(DEFAULT_FOLLOW_UP_WEEKS),
  notificationsEnabled: z.boolean().default(true),
  theme: themeSchema.default('system'),
})

export const progressSchema = z.object({
  xp: z.number().int().nonnegative().default(0),
  applicationsCreated: z.number().int().nonnegative().default(0),
  followUps: z.number().int().nonnegative().default(0),
  interviews: z.number().int().nonnegative().default(0),
  offers: z.number().int().nonnegative().default(0),
  rejections: z.number().int().nonnegative().default(0),
  activeWeeks: z.array(z.string()).default([]),
})

export const appDataSchema = z.object({
  version: z.literal(DATA_VERSION).default(DATA_VERSION),
  applications: z.array(applicationSchema).default([]),
  settings: settingsSchema.default(settingsSchema.parse({})),
  progress: progressSchema.default(progressSchema.parse({})),
})

/** Eingabe aus dem Formular (ohne Systemfelder) */
export const applicationInputSchema = applicationSchema.pick({
  company: true,
  position: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  sentAt: true,
  followUpWeeks: true,
  notes: true,
})
