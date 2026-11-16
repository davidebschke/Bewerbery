import { describe, expect, it } from 'vitest'
import {
  appDataSchema,
  applicationInputSchema,
  applicationSchema,
  settingsSchema,
} from '../../../src/shared/schemas'

describe('schemas', () => {
  it('fills defaults for empty app data', () => {
    const data = appDataSchema.parse({})
    expect(data).toEqual({
      version: 1,
      applications: [],
      settings: { followUpWeeks: 2, notificationsEnabled: true, theme: 'system' },
      progress: {
        xp: 0,
        applicationsCreated: 0,
        followUps: 0,
        interviews: 0,
        offers: 0,
        rejections: 0,
        activeWeeks: [],
      },
    })
  })

  it('applies defaults to a minimal application', () => {
    const app = applicationSchema.parse({
      id: 'a',
      company: 'ACME',
      sentAt: '2026-09-01',
      createdAt: 'x',
      updatedAt: 'x',
    })
    expect(app.stage).toBe('applied')
    expect(app.documents).toEqual([])
    expect(app.followUpWeeks).toBeNull()
  })

  it('rejects missing company, missing position and invalid email', () => {
    const result = applicationInputSchema.safeParse({
      company: '  ',
      position: ' ',
      sentAt: '2026-09-01',
      contactEmail: 'kein-mail',
    })
    expect(result.success).toBe(false)
    const messages = result.error!.issues.map((i) => i.message)
    expect(messages).toContain('Unternehmen ist erforderlich')
    expect(messages).toContain('Position ist erforderlich')
    expect(messages).toContain('Ungültige E-Mail-Adresse')
  })

  it('accepts empty email and rejects invalid dates', () => {
    expect(
      applicationInputSchema.safeParse({
        company: 'A',
        position: 'P',
        sentAt: '2026-09-01',
        contactEmail: '',
      }).success,
    ).toBe(true)
    expect(
      applicationInputSchema.safeParse({ company: 'A', position: 'P', sentAt: '01.09.2026' })
        .success,
    ).toBe(false)
  })

  it('keeps loading stored applications without position', () => {
    const data = appDataSchema.parse({
      applications: [
        { id: 'alt', company: 'Alt', sentAt: '2026-01-01', createdAt: 'x', updatedAt: 'x' },
      ],
    })
    expect(data.applications[0].position).toBe('')
  })

  it('limits follow-up weeks to 1..12', () => {
    expect(settingsSchema.safeParse({ followUpWeeks: 0 }).success).toBe(false)
    expect(settingsSchema.safeParse({ followUpWeeks: 13 }).success).toBe(false)
    expect(settingsSchema.safeParse({ followUpWeeks: 12 }).success).toBe(true)
  })

  it('rejects unknown data versions', () => {
    expect(appDataSchema.safeParse({ version: 99 }).success).toBe(false)
  })
})
