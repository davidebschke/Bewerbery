import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import {
  createAiClient,
  createDefaultClient,
  mapAiError,
  type AnthropicLike,
} from '../../../../src/main/ai/claudeClient'
import { makeCvSource } from '../../../../src/shared/testing/cvFixtures'

const headers = new Headers()
const apiError = <T>(Klass: new (...args: never[]) => T, status: number, message = 'x') =>
  new (Klass as unknown as new (...args: unknown[]) => T)(status, undefined, message, headers)

function fakeClient(retrieve: ReturnType<typeof vi.fn>): AnthropicLike {
  return { models: { retrieve } } as unknown as AnthropicLike
}

function parsingClient(parse: ReturnType<typeof vi.fn>): AnthropicLike {
  return { beta: { messages: { parse } } } as unknown as AnthropicLike
}

const generation = {
  paragraphs: [{ id: 'p3', segments: ['Frontend-Entwickler: ', 'Neu formuliert.'] }],
  changes: ['Verben geschärft'],
}
const rawAssessment = { score: 70, coveredKeywords: ['React'], missingKeywords: [] }
const assessment = {
  original: rawAssessment,
  factual: rawAssessment,
  impactful: rawAssessment,
  ats: rawAssessment,
}
const texts = { original: 'O', factual: 'F', impactful: 'I', ats: 'A' }

describe('createAiClient – structured requests', () => {
  it('generates a variant with structured output, fallbacks and the abort signal', async () => {
    const parse = vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: generation }))
    const signal = new AbortController().signal
    const client = createAiClient({ createClient: () => parsingClient(parse) })

    const result = await client.generateVariant('sk', 'ats', makeCvSource(), 'React', signal)

    expect(result).toEqual({ ok: true, value: generation })
    const [params, options] = parse.mock.calls[0] as unknown as [Record<string, unknown>, unknown]
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16_000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
    })
    expect(params.system).toContain('ATS-optimized')
    expect(params.messages).toEqual([
      { role: 'user', content: expect.stringContaining('<job_posting>\nReact') },
    ])
    expect(options).toEqual({ signal })
  })

  it('assesses all versions in one request', async () => {
    const parse = vi.fn(async () => ({ stop_reason: 'end_turn', parsed_output: assessment }))
    const client = createAiClient({ createClient: () => parsingClient(parse) })
    expect(await client.assessAll('sk', texts, 'React')).toEqual({ ok: true, value: assessment })
    const [params] = parse.mock.calls[0] as unknown as [{ messages: { content: string }[] }]
    expect(params.messages[0].content).toContain('<cv_version name="impactful">\nI')
  })

  it.each([
    [{ stop_reason: 'refusal', parsed_output: null }, 'refused'],
    [{ stop_reason: 'max_tokens', parsed_output: null }, 'too-long'],
    [{ stop_reason: 'end_turn', parsed_output: null }, 'bad-response'],
  ])('maps the response %o to %s', async (response, error) => {
    const client = createAiClient({
      createClient: () => parsingClient(vi.fn(async () => response)),
    })
    expect(await client.assessAll('sk', texts, 'React')).toEqual({ ok: false, error })
  })

  it('maps thrown sdk errors', async () => {
    const parse = vi.fn(async () => {
      throw new Anthropic.APIUserAbortError()
    })
    const client = createAiClient({ createClient: () => parsingClient(parse) })
    expect(await client.generateVariant('sk', 'factual', makeCvSource(), 'React')).toEqual({
      ok: false,
      error: 'canceled',
    })
  })
})

describe('mapAiError', () => {
  it.each([
    [new Anthropic.APIUserAbortError(), 'canceled'],
    [new Anthropic.APIConnectionError({ message: 'offline' }), 'network'],
    [new Anthropic.APIConnectionTimeoutError(), 'network'],
    [apiError(Anthropic.RequestTimeoutError, 408), 'network'],
    [apiError(Anthropic.AuthenticationError, 401), 'invalid-key'],
    [apiError(Anthropic.PermissionDeniedError, 403), 'invalid-key'],
    [apiError(Anthropic.RateLimitError, 429), 'rate-limit'],
    [apiError(Anthropic.ContentTooLargeError, 413), 'too-long'],
    [apiError(Anthropic.BadRequestError, 400, 'prompt is too long: 1200000 tokens'), 'too-long'],
    [apiError(Anthropic.BadRequestError, 400, 'invalid model'), 'server'],
    [apiError(Anthropic.InternalServerError, 500), 'server'],
    [apiError(Anthropic.OverloadedError, 529), 'server'],
    [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'canceled'],
    [new Error('kaputt'), 'server'],
    ['string', 'server'],
    [new Anthropic.AnthropicError('Failed to parse structured output'), 'bad-response'],
    [Object.assign(new Error('schema'), { name: 'ZodError' }), 'bad-response'],
    [new SyntaxError('Unexpected token'), 'bad-response'],
  ])('maps %s to %s', (error, code) => {
    expect(mapAiError(error)).toBe(code)
  })
})

describe('createAiClient.testKey', () => {
  it('accepts a key when the model can be retrieved', async () => {
    const retrieve = vi.fn(async () => ({ id: 'claude-opus-5-5' }))
    const createClient = vi.fn(() => fakeClient(retrieve))
    const signal = new AbortController().signal
    const result = await createAiClient({ createClient }).testKey('sk-test', signal)
    expect(result).toEqual({ ok: true, value: true })
    expect(createClient).toHaveBeenCalledWith('sk-test')
    expect(retrieve).toHaveBeenCalledWith('claude-opus-5-5', {}, { signal })
  })

  it('reports an invalid key', async () => {
    const retrieve = vi.fn(async () => {
      throw apiError(Anthropic.AuthenticationError, 401)
    })
    const result = await createAiClient({ createClient: () => fakeClient(retrieve) }).testKey('x')
    expect(result).toEqual({ ok: false, error: 'invalid-key' })
  })

  it('creates a real sdk client by default without sending requests', () => {
    expect(createAiClient()).toHaveProperty('generateVariant')
    const client = createDefaultClient('sk-test')
    expect(client).toBeInstanceOf(Anthropic)
    expect(createAiClient()).toHaveProperty('testKey')
  })
})
