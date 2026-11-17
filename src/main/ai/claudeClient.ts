import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import { CLAUDE_MODEL } from '@shared/constants'
import { fail, ok, type AiErrorCode, type AiResult } from '@shared/domain/cv/aiErrors'
import {
  buildAssessmentPrompt,
  buildGenerationPrompt,
  type AssessmentTexts,
  type Prompt,
} from '@shared/domain/cv/prompts'
import {
  assessmentOutputSchema,
  generationOutputSchema,
  type AssessmentOutput,
  type CvSource,
  type GenerationOutput,
} from '@shared/domain/cv/schemas'
import type { VariantStyle } from '@shared/domain/cv/styles'

/** Serverseitiger Ersatz bei Ablehnung durch Sicherheitsfilter (siehe research.md R1) */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const MAX_OUTPUT_TOKENS = 16_000

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
  if (error instanceof Anthropic.APIError) return 'server'
  // Fehler beim Auslesen der strukturierten Antwort (ungültiges JSON, Schema verletzt)
  if (error instanceof Anthropic.AnthropicError) return 'bad-response'
  if (error instanceof Error && (error.name === 'ZodError' || error instanceof SyntaxError)) {
    return 'bad-response'
  }
  return 'server'
}

export interface AiClient {
  /** Prüft den Key mit einer kostenlosen Modell-Abfrage */
  testKey(apiKey: string, signal?: AbortSignal): Promise<AiResult<true>>
  /** Erzeugt die Absatz-Ersetzungen für einen Stil */
  generateVariant(
    apiKey: string,
    style: VariantStyle,
    source: CvSource,
    jobDescription: string,
    signal?: AbortSignal,
  ): Promise<AiResult<GenerationOutput>>
  /** Bewertet Original und Varianten gemeinsam nach demselben Schema */
  assessAll(
    apiKey: string,
    texts: AssessmentTexts,
    jobDescription: string,
    signal?: AbortSignal,
  ): Promise<AiResult<AssessmentOutput>>
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

  async function structured<T>(
    apiKey: string,
    prompt: Prompt,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
  ): Promise<AiResult<T>> {
    try {
      const response = await createClient(apiKey).beta.messages.parse(
        {
          model: CLAUDE_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        },
        { signal },
      )
      if (response.stop_reason === 'refusal') return fail('refused')
      if (response.stop_reason === 'max_tokens') return fail('too-long')
      const parsed = response.parsed_output as T | null | undefined
      return parsed ? ok(parsed) : fail('bad-response')
    } catch (error) {
      return fail(mapAiError(error))
    }
  }

  function generateVariant(
    apiKey: string,
    style: VariantStyle,
    source: CvSource,
    jobDescription: string,
    signal?: AbortSignal,
  ): Promise<AiResult<GenerationOutput>> {
    const prompt = buildGenerationPrompt(style, source, jobDescription)
    return structured(apiKey, prompt, generationOutputSchema, signal)
  }

  function assessAll(
    apiKey: string,
    texts: AssessmentTexts,
    jobDescription: string,
    signal?: AbortSignal,
  ): Promise<AiResult<AssessmentOutput>> {
    const prompt = buildAssessmentPrompt(texts, jobDescription)
    return structured(apiKey, prompt, assessmentOutputSchema, signal)
  }

  return { testKey, generateVariant, assessAll }
}
