/**
 * client.ts
 * =========
 * Client-side configuration and test utility for Google Gemini Interactions API (BYOK).
 *
 * Stored in `chrome.storage.local` to ensure user credentials remain strictly
 * on the local machine and are never synced across cloud profiles.
 */

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Default - Model Generasi 3 Terbaru)' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Penalaran & Kecepatan Seimbang)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Multimodal & Kecepatan Stabil)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Cepat & Responsif)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Super Cepat & Hemat Biaya)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Penalaran Pro Kompleks)' },
  { id: 'custom', name: 'Kustom (Ketik Manual)...' },
];

const STORAGE_KEY = 'geminiConfig';
export const INTERACTIONS_API_REVISION = '2026-05-20';

/**
 * Normalizes a requested model ID and builds an ordered list of Gemini 3.x fallback model IDs.
 */
export function resolveModelCandidates(requestedModel: string): string[] {
  const cleaned = (requestedModel || DEFAULT_GEMINI_MODEL).trim().replace(/^models\//i, '');
  const candidates: string[] = [cleaned];

  if (cleaned === 'gemini-3.5-flash-lite') {
    candidates.push('gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash');
  } else if (cleaned === 'gemini-3.8-flash' || cleaned === 'gemini-3.7-flash' || cleaned === 'gemini-3.6-flash') {
    candidates.push('gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite');
  } else if (cleaned === 'gemini-3.1-pro-preview') {
    candidates.push('gemini-3.8-flash', 'gemini-3.6-flash');
  } else {
    candidates.push('gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite');
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Extracts a human-readable error message from Google Gemini REST responses.
 * Handles both JSON Object `{ error: { message } }` (generateContent)
 * and JSON Array `[{ error: { message } }]` (Interactions API).
 */
export function extractGeminiErrorMessage(
  errBody: unknown,
  status: number,
  statusText: string,
): string {
  if (Array.isArray(errBody) && errBody.length > 0) {
    const first = errBody[0] as { error?: { message?: string } } | undefined;
    if (first?.error?.message) return first.error.message;
  }
  if (typeof errBody === 'object' && errBody !== null) {
    const obj = errBody as { error?: { message?: string }; message?: string };
    if (obj.error?.message) return obj.error.message;
    if (typeof obj.message === 'string' && obj.message) return obj.message;
  }
  return `HTTP ${status}${statusText ? ` ${statusText}` : ''}`;
}

/**
 * Loads Gemini configuration from chrome.storage.local (fallback to localStorage).
 */
export async function loadGeminiConfig(): Promise<GeminiConfig | null> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const config = result[STORAGE_KEY] as GeminiConfig | undefined;
        if (config && config.apiKey) {
          resolve({
            apiKey: config.apiKey,
            model: config.model || DEFAULT_GEMINI_MODEL,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // Fallback for non-extension development environments
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GeminiConfig;
      if (parsed.apiKey) {
        return {
          apiKey: parsed.apiKey,
          model: parsed.model || DEFAULT_GEMINI_MODEL,
        };
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

/**
 * Saves Gemini configuration to chrome.storage.local (fallback to localStorage).
 */
export async function saveGeminiConfig(config: GeminiConfig): Promise<void> {
  const payload: GeminiConfig = {
    apiKey: config.apiKey.trim(),
    model: config.model.trim() || DEFAULT_GEMINI_MODEL,
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => resolve());
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Tests connection to Google Gemini API.
 *
 * NOTE: Never send the non-standard `Api-Revision` HTTP header from browser fetch,
 * because `generativelanguage.googleapis.com` rejects `api-revision` during CORS
 * OPTIONS preflight with HTTP 403 Forbidden (causing `TypeError: Failed to fetch`).
 */
export async function testGeminiConnection(
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<{ success: boolean; error?: string; resolvedModel?: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, error: 'API Key tidak boleh kosong.' };
  }

  const modelCandidates = resolveModelCandidates(model);
  const primaryModel = modelCandidates[0];
  const interactionsEndpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';

  let lastErrorMessage = '';

  // 1. Try modern Interactions API first (isolated try/catch so CORS/network errors still fall back)
  try {
    const response = await fetch(interactionsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        model: primaryModel,
        input: 'Ping test. Reply with OK.',
        store: false, // Medical privacy: do not store interaction in cloud history
      }),
    });

    if (response.ok) {
      return { success: true, resolvedModel: primaryModel };
    }

    const errJson = await response.json().catch(() => null);
    lastErrorMessage = extractGeminiErrorMessage(errJson, response.status, response.statusText);

    // If explicitly quota/rate-limit exhausted on valid key, still let generateContent verify
    // in case only the interactions endpoint is restricted for this key/model.
  } catch (err) {
    lastErrorMessage = err instanceof Error ? err.message : 'Gagal menghubungi endpoint interactions.';
  }

  // 2. Fallback to standard generateContent across model candidates
  for (const candidateModel of modelCandidates) {
    try {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent`;
      let fallbackRes: Response;
      try {
        fallbackRes = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test. Reply with OK.' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });
      } catch {
        // Fallback if browser environment blocks custom x-goog-api-key header on preflight
        fallbackRes = await fetch(`${fallbackEndpoint}?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test. Reply with OK.' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });
      }

      if (fallbackRes.ok) {
        return { success: true, resolvedModel: candidateModel };
      }

      const fallbackErr = await fallbackRes.json().catch(() => null);
      const msg = extractGeminiErrorMessage(fallbackErr, fallbackRes.status, fallbackRes.statusText);
      lastErrorMessage = msg;

      // If model not found (404 or model not supported), try the next fallback model candidate
      const isModelNotFound =
        fallbackRes.status === 404 ||
        /not found|not supported|invalid model/i.test(msg);
      if (isModelNotFound) {
        continue;
      }

      // For other errors (e.g. 400 API_KEY_INVALID, 429 quota), stop looping generativelanguage models
      break;
    } catch (err) {
      lastErrorMessage = err instanceof Error ? err.message : 'Gagal menghubungi Google Gemini API.';
    }
  }

  // 3. If key starts with 'AQ.' (Vertex AI Express Mode / newer Google Cloud Auth Key)
  // and generativelanguage.googleapis.com rejected it, try Vertex AI Express endpoint
  if (key.startsWith('AQ.')) {
    for (const candidateModel of modelCandidates) {
      try {
        const vertexEndpoint = `https://aiplatform.googleapis.com/v1/publishers/google/models/${candidateModel}:generateContent?key=${encodeURIComponent(key)}`;
        const vertexRes = await fetch(vertexEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Ping test. Reply with OK.' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

        if (vertexRes.ok) {
          return { success: true, resolvedModel: candidateModel };
        }

        const vertexErr = await vertexRes.json().catch(() => null);
        const msg = extractGeminiErrorMessage(vertexErr, vertexRes.status, vertexRes.statusText);
        if (vertexRes.status === 404 || /not found|not supported/i.test(msg)) {
          continue;
        }
        lastErrorMessage = msg;
        break;
      } catch {
        // Ignore Vertex fallback network error and preserve primary error message
      }
    }
  }

  return {
    success: false,
    error: lastErrorMessage || 'Gagal menghubungi Google Gemini API.',
  };
}
