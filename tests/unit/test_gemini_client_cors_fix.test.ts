import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractGeminiErrorMessage,
  GEMINI_AVAILABLE_MODELS,
  resolveModelCandidates,
  testGeminiConnection,
} from '../../src/services/gemini/client';

describe('Gemini Client CORS & Fallback Hardening', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('strictly uses Gemini 3.x models and excludes 2.5 models', () => {
    const modelIds = GEMINI_AVAILABLE_MODELS.map((m) => m.id);
    expect(modelIds).toContain('gemini-3.8-flash');
    expect(modelIds).toContain('gemini-3.6-flash');
    expect(modelIds).toContain('gemini-3.5-flash');
    expect(modelIds).toContain('gemini-3.5-flash-lite');
    for (const id of modelIds) {
      expect(id).not.toContain('2.5');
    }

    const candidates = resolveModelCandidates('gemini-3.5-flash-lite');
    expect(candidates[0]).toBe('gemini-3.5-flash-lite');
    for (const c of candidates) {
      expect(c).not.toContain('2.5');
    }
  });

  it('parses both JSON Array (Interactions API) and JSON Object (generateContent) error payloads', () => {
    const arrayErr = [{ error: { code: 400, message: 'Array error message' } }];
    expect(extractGeminiErrorMessage(arrayErr, 400, 'Bad Request')).toBe('Array error message');

    const objErr = { error: { code: 429, message: 'Quota exceeded' } };
    expect(extractGeminiErrorMessage(objErr, 429, 'Too Many Requests')).toBe('Quota exceeded');
  });

  it('never sends Api-Revision header that triggers CORS preflight 403 Forbidden', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output_text: 'OK' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await testGeminiConnection('AIzaSyTestKey1234567890123456789012345', 'gemini-3.5-flash-lite');
    expect(res.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Api-Revision']).toBeUndefined();
    expect(headers['api-revision']).toBeUndefined();
    expect(headers['x-goog-api-key']).toBe('AIzaSyTestKey1234567890123456789012345');
  });

  it('falls back to generateContent when interactions endpoint throws Failed to fetch or returns 400', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await testGeminiConnection('AQ.Ab8RN6LoWTjAbk-testKey123456', 'gemini-3.5-flash-lite');
    expect(res.success).toBe(true);
    expect(res.resolvedModel).toBe('gemini-3.5-flash-lite');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
  });

  it('cascades to next Gemini 3.x model if primary model returns 404 on generateContent', async () => {
    const fetchMock = vi
      .fn()
      // 1. interactions returns 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => [{ error: { message: 'Endpoint not found' } }],
      })
      // 2. generateContent on gemini-3.5-flash-lite returns 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Model not found' } }),
      })
      // 3. generateContent on gemini-3.5-flash succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await testGeminiConnection('AIzaSyTestKey1234567890123456789012345', 'gemini-3.5-flash-lite');
    expect(res.success).toBe(true);
    expect(res.resolvedModel).toBe('gemini-3.5-flash');
  });
});
