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
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Super Cepat & Hemat Biaya)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Penalaran Pro Kompleks)' },
  { id: 'custom', name: 'Kustom (Ketik Manual)...' },
];

const STORAGE_KEY = 'geminiConfig';
export const INTERACTIONS_API_REVISION = '2026-05-20';

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
 * Tests connection to Google Gemini API using the modern Interactions API.
 * Uses `store: false` to ensure zero cloud persistence of test messages.
 */
export async function testGeminiConnection(
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<{ success: boolean; error?: string }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, error: 'API Key tidak boleh kosong.' };
  }

  const targetModel = model.trim() || DEFAULT_GEMINI_MODEL;
  const interactionsEndpoint = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${key}`;

  try {
    // 1. Try modern Interactions API first
    const response = await fetch(interactionsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Revision': INTERACTIONS_API_REVISION,
      },
      body: JSON.stringify({
        model: targetModel,
        input: 'Ping test. Reply with OK.',
        store: false, // Medical privacy: do not store interaction in cloud history
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    // 2. If endpoint not found / not allowed, fallback to generateContent
    if (response.status === 404 || response.status === 405) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping test. Reply with OK.' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (fallbackRes.ok) {
        return { success: true };
      }

      const fallbackErr = await fallbackRes.json().catch(() => null) as { error?: { message?: string } } | null;
      return {
        success: false,
        error: fallbackErr?.error?.message ?? `HTTP ${fallbackRes.status} ${fallbackRes.statusText}`,
      };
    }

    const errorJson = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const message = errorJson?.error?.message ?? `HTTP ${response.status} ${response.statusText}`;
    return { success: false, error: message };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi Google Gemini API.',
    };
  }
}
