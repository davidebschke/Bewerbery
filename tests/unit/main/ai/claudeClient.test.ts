import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import {
  createAiClient,
  createDefaultClient,
  mapAiError,
  type AnthropicLike,
} from '../../../../src/main/ai/claudeClient'

const headers = new Headers()
const apiError = <T>(Klass: new (...args: never[]) => T, status: number, message = 'x') =>
  new (Klass as unknown as new (...args: unknown[]) => T)(status, undefined, message, headers)

function fakeClient(retrieve: ReturnType<typeof vi.fn>): AnthropicLike {
  return { models: { retrieve } } as unknown as AnthropicLike
}

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
    const client = createDefaultClient('sk-test')
    expect(client).toBeInstanceOf(Anthropic)
    expect(createAiClient()).toHaveProperty('testKey')
  })
})
