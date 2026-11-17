import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@shared/constants'
import { fail, ok, type AiErrorCode, type AiResult } from '@shared/domain/cv/aiErrors'

/** Der Teil des SDK-Clients, den die App nutzt – in Tests durch Fakes ersetzbar */
export type AnthropicLike = Pick<Anthropic, 'models' | 'messages' | 'beta'>

export type CreateAnthropicClient = (apiKey: string) => AnthropicLike

export const createDefaultClient: CreateAnthropicClient = (apiKey) =>
  new Anthropic({ apiKey, maxRetries: 2 })

const TOO_LONG_PATTERN = /too long|too many tokens|context (window|length)/i

/** Übersetzt SDK-Fehler in fachliche Fehlercodes (siehe research.md R6) */
export function mapAiError(error: unknown): AiErrorCode {
  if (error instanceof Anthropic.APIUserAbortError) return 'canceled'
  if (error instanceof Anthropic.APIConnectionError) return 'network'
  if (error instanceof Anthropic.RequestTimeoutError) return 'network'
  if (error instanceof Anthropic.AuthenticationError) return 'invalid-key'
  if (error instanceof Anthropic.PermissionDeniedError) return 'invalid-key'
  if (error instanceof Anthropic.RateLimitError) return 'rate-limit'
  if (error instanceof Anthropic.ContentTooLargeError) return 'too-long'
  if (error instanceof Anthropic.BadRequestError && TOO_LONG_PATTERN.test(error.message)) {
    return 'too-long'
  }
  if (error instanceof Error && error.name === 'AbortError') return 'canceled'
  return 'server'
}

export interface AiClient {
  /** Prüft den Key mit einer kostenlosen Modell-Abfrage */
  testKey(apiKey: string, signal?: AbortSignal): Promise<AiResult<true>>
}

export interface AiClientOptions {
  createClient?: CreateAnthropicClient
}

export function createAiClient({
  createClient = createDefaultClient,
}: AiClientOptions = {}): AiClient {
  async function testKey(apiKey: string, signal?: AbortSignal): Promise<AiResult<true>> {
    try {
      await createClient(apiKey).models.retrieve(CLAUDE_MODEL, {}, { signal })
      return ok(true)
    } catch (error) {
      return fail(mapAiError(error))
    }
  }

  return { testKey }
}
