import { ok } from '@shared/domain/cv/aiErrors'
import { paragraphText } from '@shared/domain/cv/rewrite'
import type { AssessmentOutput, CvSource, RawAssessment } from '@shared/domain/cv/schemas'
import { VARIANT_STYLE_LABELS, type VariantStyle } from '@shared/domain/cv/styles'
import type { AiClient } from './claudeClient'
import type { SecretCrypto } from './secretStore'

/**
 * Fake-Implementierungen für E2E-Tests (`BEWERBERY_AI_FAKE=1`): keine Netzwerkzugriffe,
 * deterministische Antworten. Nie im normalen Betrieb aktiv.
 */
export const AI_FAKE_ENV = 'BEWERBERY_AI_FAKE'

export function isAiFakeMode(env: Record<string, string | undefined>): boolean {
  return env[AI_FAKE_ENV] === '1'
}

/** Umkehrbare Pseudo-Verschlüsselung – der Klartext steht trotzdem nie in der Datei */
export const fakeCrypto: SecretCrypto = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(Buffer.from(text, 'utf8').toString('base64')).reverse(),
  decryptString: (buffer) =>
    Buffer.from(Buffer.from(buffer).reverse().toString(), 'base64').toString('utf8'),
}

export const FAKE_SCORES: Record<'original' | VariantStyle, number> = {
  original: 54,
  factual: 71,
  impactful: 78,
  ats: 83,
}

/** Ändert das letzte Segment des längsten bearbeitbaren Absatzes */
function fakeRewrite(source: CvSource, style: VariantStyle) {
  const target = source.paragraphs
    .filter((paragraph) => paragraph.editable)
    .reduce((longest, paragraph) =>
      paragraphText(paragraph).length > paragraphText(longest).length ? paragraph : longest,
    )
  const segments = [...target.segments]
  segments[segments.length - 1] = `${segments.at(-1)} (${VARIANT_STYLE_LABELS[style]})`
  return {
    paragraphs: [{ id: target.id, segments }],
    changes: [`${VARIANT_STYLE_LABELS[style]}: Formulierung an die Stellenanzeige angepasst`],
  }
}

function fakeAssessment(score: number, jobDescription: string): RawAssessment {
  const words = jobDescription.split(/[^\p{L}\p{N}+#.-]+/u).filter((word) => word.length > 2)
  return { score, coveredKeywords: words.slice(0, 3), missingKeywords: words.slice(3, 5) }
}

export function createFakeAiClient(): AiClient {
  return {
    testKey: async () => ok(true),
    generateVariant: async (_key, style, source) => ok(fakeRewrite(source, style)),
    assessAll: async (_key, _texts, jobDescription) => {
      const output = Object.fromEntries(
        Object.entries(FAKE_SCORES).map(([name, score]) => [
          name,
          fakeAssessment(score, jobDescription),
        ]),
      ) as AssessmentOutput
      return ok(output)
    },
  }
}
