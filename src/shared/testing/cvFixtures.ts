import type { Assessment, CvOptimizationResult, CvSource, CvVariant } from '../domain/cv/schemas'
import type { VariantStyle } from '../domain/cv/styles'

/** Beispiel-Lebenslauf mit gemischt formatierten Absätzen (Test- und Fake-Daten) */
export function makeCvSource(overrides: Partial<CvSource> = {}): CvSource {
  const paragraphs = overrides.paragraphs ?? [
    { id: 'p0', segments: ['Max Mustermann'], editable: true },
    { id: 'p1', segments: ['Berufserfahrung'], editable: true },
    { id: 'p2', segments: ['2019 – 2023'], editable: false },
    {
      id: 'p3',
      segments: ['Frontend-Entwickler: ', 'Entwicklung von Webanwendungen mit React.'],
      editable: true,
    },
    { id: 'p4', segments: ['Skills: ', 'TypeScript, React, Teamarbeit'], editable: true },
  ]
  return {
    format: 'docx',
    fileName: 'Lebenslauf.docx',
    paragraphs,
    charCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.segments.join('').length, 0),
    ...overrides,
  }
}

export function makeAssessment(score: number, overrides: Partial<Assessment> = {}): Assessment {
  return {
    score,
    coveredKeywords: ['React', 'TypeScript'],
    missingKeywords: ['Vitest'],
    ...overrides,
  }
}

const SAMPLE_REWRITES: Record<VariantStyle, Record<string, string[]>> = {
  factual: {
    p3: ['Frontend-Entwickler: ', 'Entwicklung und Wartung von Webanwendungen mit React.'],
  },
  impactful: {
    p3: ['Frontend-Entwickler: ', 'Baute performante Webanwendungen mit React für Kunden.'],
    p4: ['Skills: ', 'TypeScript, React, Zusammenarbeit im Team'],
  },
  ats: {
    p4: ['Skills: ', 'TypeScript, React, Teamfähigkeit'],
  },
}

export function makeCvVariant(
  style: VariantStyle,
  score: number,
  overrides: Partial<CvVariant> = {},
): CvVariant {
  return {
    style,
    rewrites: SAMPLE_REWRITES[style],
    changes: ['Formulierungen an die Stellenanzeige angepasst'],
    assessment: makeAssessment(score),
    inventedNumbers: [],
    lengthRatio: 1.05,
    ...overrides,
  }
}

export function makeCvResult(overrides: Partial<CvOptimizationResult> = {}): CvOptimizationResult {
  return {
    id: 'result-1',
    createdAt: '2026-11-17T10:00:00.000Z',
    applicationId: null,
    jobTitle: 'Frontend-Entwickler · Muster GmbH',
    source: makeCvSource(),
    originalAssessment: makeAssessment(54, { coveredKeywords: ['React'] }),
    variants: [
      makeCvVariant('factual', 71),
      makeCvVariant('impactful', 78),
      makeCvVariant('ats', 83),
    ],
    ...overrides,
  }
}
