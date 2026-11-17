import { ok } from '@shared/domain/cv/aiErrors'
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

export function createFakeAiClient(): AiClient {
  return {
    testKey: async () => ok(true),
  }
}
