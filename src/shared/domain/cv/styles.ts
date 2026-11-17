/** Stile der CV-Varianten in fester Anzeigereihenfolge */
export const VARIANT_STYLES = ['factual', 'impactful', 'ats'] as const

export type VariantStyle = (typeof VARIANT_STYLES)[number]

export const VARIANT_STYLE_LABELS: Record<VariantStyle, string> = {
  factual: 'Sachlich',
  impactful: 'Wirkungsstark',
  ats: 'ATS-optimiert',
}

/** Stil-Anweisungen für die KI (englisch, da Teil des Prompts; Ausgabe bleibt in CV-Sprache) */
export const VARIANT_STYLE_INSTRUCTIONS: Record<VariantStyle, string> = {
  factual:
    'Factual: clear, precise and modest wording. Prefer concrete responsibilities and results over adjectives. Remove filler words and clichés.',
  impactful:
    'Impactful: confident, achievement-oriented wording with strong action verbs. Lead each statement with the result or contribution, stay credible and never exaggerate.',
  ats: 'ATS-optimized: mirror the exact terminology of the job posting where the CV already covers the topic (same spelling of skills, tools, job titles), use plain, conventional section wording and avoid unusual symbols.',
}
