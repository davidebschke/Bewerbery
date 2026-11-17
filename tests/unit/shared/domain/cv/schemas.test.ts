import { describe, expect, it } from 'vitest'
import {
  aiKeyStatusSchema,
  apiKeySchema,
  assessmentSchema,
  cvOptimizationRequestSchema,
  cvOptimizationResultSchema,
  cvSourceSchema,
  cvVariantSchema,
  generationOutputSchema,
} from '../../../../../src/shared/domain/cv/schemas'

const assessment = { score: 70, coveredKeywords: ['React'], missingKeywords: ['Go'] }
const source = {
  format: 'docx',
  fileName: 'CV.docx',
  paragraphs: [{ id: 'p0', segments: ['Max Muster'], editable: true }],
  charCount: 10,
}
const variant = (style: string) => ({
  style,
  rewrites: { p0: ['Max Mustermann'] },
  changes: ['Name vervollständigt'],
  assessment,
  inventedNumbers: [],
  lengthRatio: 1.2,
})

describe('cv schemas', () => {
  it('validates api keys without echoing them', () => {
    expect(apiKeySchema.parse('  sk-ant-abcdefghijklmnopqrstuvwxyz  ')).toBe(
      'sk-ant-abcdefghijklmnopqrstuvwxyz',
    )
    expect(apiKeySchema.safeParse('kurz').success).toBe(false)
    expect(apiKeySchema.safeParse('sk-ant-abc defghijklmnopqrstuvwxyz').success).toBe(false)
    expect(apiKeySchema.safeParse('x'.repeat(401)).success).toBe(false)
  })

  it('accepts a key status with a 4-character hint', () => {
    expect(
      aiKeyStatusSchema.safeParse({ configured: true, hint: 'abcd', encryptionAvailable: true })
        .success,
    ).toBe(true)
    expect(
      aiKeyStatusSchema.safeParse({ configured: true, hint: 'abc', encryptionAvailable: true })
        .success,
    ).toBe(false)
  })

  it('limits the cv source to docx/odt, 600 paragraphs and 30 000 characters', () => {
    expect(cvSourceSchema.safeParse(source).success).toBe(true)
    expect(cvSourceSchema.safeParse({ ...source, format: 'pdf' }).success).toBe(false)
    expect(cvSourceSchema.safeParse({ ...source, charCount: 30_001 }).success).toBe(false)
    const paragraphs = Array.from({ length: 601 }, (_, i) => ({
      id: `p${i}`,
      segments: ['x'],
      editable: true,
    }))
    expect(cvSourceSchema.safeParse({ ...source, paragraphs }).success).toBe(false)
  })

  it('trims and limits the optimization request', () => {
    const parsed = cvOptimizationRequestSchema.parse({
      jobDescription: '  React  ',
      applicationId: null,
      jobTitle: ' Dev ',
    })
    expect(parsed).toEqual({ jobDescription: 'React', applicationId: null, jobTitle: 'Dev' })
    expect(
      cvOptimizationRequestSchema.safeParse({
        jobDescription: ' ',
        applicationId: null,
        jobTitle: '',
      }).success,
    ).toBe(false)
    expect(
      cvOptimizationRequestSchema.safeParse({
        jobDescription: 'x'.repeat(15_001),
        applicationId: null,
        jobTitle: '',
      }).success,
    ).toBe(false)
    expect(
      cvOptimizationRequestSchema.safeParse({
        jobDescription: 'x',
        applicationId: null,
        jobTitle: 'x'.repeat(201),
      }).success,
    ).toBe(false)
  })

  it('restricts assessments to integer scores between 0 and 100', () => {
    expect(assessmentSchema.safeParse(assessment).success).toBe(true)
    expect(assessmentSchema.safeParse({ ...assessment, score: 101 }).success).toBe(false)
    expect(assessmentSchema.safeParse({ ...assessment, score: 50.5 }).success).toBe(false)
  })

  it('requires 1 to 5 changes per variant', () => {
    expect(cvVariantSchema.safeParse(variant('ats')).success).toBe(true)
    expect(cvVariantSchema.safeParse({ ...variant('ats'), changes: [] }).success).toBe(false)
    expect(
      cvVariantSchema.safeParse({ ...variant('ats'), changes: ['a', 'b', 'c', 'd', 'e', 'f'] })
        .success,
    ).toBe(false)
  })

  it('requires exactly three variants in a result', () => {
    const result = {
      id: 'r1',
      createdAt: '2026-11-17T10:00:00.000Z',
      applicationId: null,
      jobTitle: 'Dev',
      source,
      originalAssessment: assessment,
      variants: [variant('factual'), variant('impactful'), variant('ats')],
    }
    expect(cvOptimizationResultSchema.safeParse(result).success).toBe(true)
    expect(
      cvOptimizationResultSchema.safeParse({ ...result, variants: result.variants.slice(1) })
        .success,
    ).toBe(false)
  })

  it('parses the raw generation output', () => {
    expect(
      generationOutputSchema.safeParse({
        paragraphs: [{ id: 'p0', segments: ['a'] }],
        changes: [],
      }).success,
    ).toBe(true)
  })
})
