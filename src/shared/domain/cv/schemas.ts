import { z } from 'zod'
import {
  MAX_CV_CHARS,
  MAX_CV_PARAGRAPHS,
  MAX_JOB_DESCRIPTION_CHARS,
  MAX_JOB_TITLE_CHARS,
  MAX_KEYWORDS,
  MAX_VARIANT_CHANGES,
} from '../../constants'
import { VARIANT_STYLES } from './styles'

// ---------------------------------------------------------------------------
// API-Key
// ---------------------------------------------------------------------------

export const apiKeySchema = z
  .string()
  .trim()
  .min(20, 'Der API-Key ist zu kurz')
  .max(400, 'Der API-Key ist zu lang')
  .regex(/^\S+$/, 'Der API-Key darf keine Leerzeichen enthalten')

export const aiKeyStatusSchema = z.object({
  configured: z.boolean(),
  hint: z.string().length(4).nullable(),
  encryptionAvailable: z.boolean(),
})

// ---------------------------------------------------------------------------
// CV-Quelle
// ---------------------------------------------------------------------------

export const cvFormatSchema = z.enum(['docx', 'odt'])

export const cvParagraphSchema = z.object({
  id: z.string().min(1),
  segments: z.array(z.string()),
  /** `false` für leere Absätze bzw. Absätze ohne Buchstaben – gehen nicht an die KI */
  editable: z.boolean(),
})

export const cvSourceSchema = z.object({
  format: cvFormatSchema,
  fileName: z.string().min(1),
  paragraphs: z.array(cvParagraphSchema).max(MAX_CV_PARAGRAPHS),
  charCount: z.number().int().nonnegative().max(MAX_CV_CHARS),
})

// ---------------------------------------------------------------------------
// Auftrag & Ergebnis
// ---------------------------------------------------------------------------

export const cvOptimizationRequestSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(1, 'Stellenanzeige fehlt')
    .max(MAX_JOB_DESCRIPTION_CHARS, 'Stellenanzeige ist zu lang'),
  applicationId: z.string().min(1).nullable(),
  jobTitle: z.string().trim().max(MAX_JOB_TITLE_CHARS),
})

export const variantStyleSchema = z.enum(VARIANT_STYLES)

export const assessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  coveredKeywords: z.array(z.string()).max(MAX_KEYWORDS),
  missingKeywords: z.array(z.string()).max(MAX_KEYWORDS),
})

export const cvVariantSchema = z.object({
  style: variantStyleSchema,
  /** Absatz-ID → neue Segmenttexte (nur gültige, geänderte Absätze) */
  rewrites: z.record(z.string(), z.array(z.string())),
  changes: z.array(z.string()).min(1).max(MAX_VARIANT_CHANGES),
  assessment: assessmentSchema,
  inventedNumbers: z.array(z.string()),
  lengthRatio: z.number().nonnegative(),
})

export const cvOptimizationResultSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  applicationId: z.string().min(1).nullable(),
  jobTitle: z.string(),
  source: cvSourceSchema,
  originalAssessment: assessmentSchema,
  variants: z.array(cvVariantSchema).length(VARIANT_STYLES.length),
})

// ---------------------------------------------------------------------------
// KI-Antwortformate (Structured Outputs) – bewusst ohne Zahlengrenzen,
// da nicht alle JSON-Schema-Constraints unterstützt werden. Begrenzt wird
// anschließend in der Domain-Logik.
// ---------------------------------------------------------------------------

export const generationOutputSchema = z.object({
  paragraphs: z.array(
    z.object({
      id: z.string(),
      segments: z.array(z.string()),
    }),
  ),
  changes: z.array(z.string()),
})

const rawAssessmentSchema = z.object({
  score: z.number(),
  coveredKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
})

export const assessmentOutputSchema = z.object({
  original: rawAssessmentSchema,
  factual: rawAssessmentSchema,
  impactful: rawAssessmentSchema,
  ats: rawAssessmentSchema,
})

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type AiKeyStatus = z.infer<typeof aiKeyStatusSchema>
export type CvFormat = z.infer<typeof cvFormatSchema>
export type CvParagraph = z.infer<typeof cvParagraphSchema>
export type CvSource = z.infer<typeof cvSourceSchema>
export type CvOptimizationRequest = z.infer<typeof cvOptimizationRequestSchema>
export type Assessment = z.infer<typeof assessmentSchema>
export type RawAssessment = z.infer<typeof rawAssessmentSchema>
export type CvVariant = z.infer<typeof cvVariantSchema>
export type CvOptimizationResult = z.infer<typeof cvOptimizationResultSchema>
export type GenerationOutput = z.infer<typeof generationOutputSchema>
export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>
