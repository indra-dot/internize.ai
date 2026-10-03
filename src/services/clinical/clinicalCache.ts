/**
 * clinicalCache.ts
 * ================
 * Persistent client-side caching for Google Gemini Cloud Synthesizer results.
 *
 * Saves tokenized and re-identified results in `chrome.storage.local` (with
 * fallback to `localStorage` for web environments) using a SHA-256 content hash.
 *
 * Benefits:
 * - Prevents repetitive API calls when switching tabs or reviewing the same clinical text.
 * - Protects user API quota and limits latency to <1ms for previously analyzed cases.
 * - Zero cloud persistence: cache resides strictly on the local machine.
 */

import type { CloudSynthesizerResult } from './cloudSynthesizer';

const CACHE_PREFIX = 'internize_synth_cache_v1_';
const MAX_CACHE_ENTRIES = 50;

/**
 * Computes a synchronous deterministic fast hash for cache keys.
 */
export function computeFastCacheKey(
  mode: string,
  urgency: string,
  text: string,
): string {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  const payload = `${mode}::${urgency}::${normalized}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${CACHE_PREFIX}${(hash >>> 0).toString(16)}_${normalized.length}`;
}

/**
 * Computes a deterministic SHA-256 content hash for cache keys.
 */
export async function computeCacheKey(
  mode: string,
  urgency: string,
  text: string,
): Promise<string> {
  const normalized = text.trim().replace(/\r\n/g, '\n');
  const payload = `${mode}::${urgency}::${normalized}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${CACHE_PREFIX}${hashHex.slice(0, 32)}`;
    } catch {
      // Fallback below
    }
  }

  // Fast string hash fallback if crypto.subtle is unavailable
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${CACHE_PREFIX}${(hash >>> 0).toString(16)}_${normalized.length}`;
}

/**
 * Retrieves a cached CloudSynthesizerResult from chrome.storage.local or localStorage.
 */
const memoryCache = new Map<string, CloudSynthesizerResult>();

export async function getCachedSynthesis(
  key: string,
): Promise<CloudSynthesizerResult | null> {
  if (!key) return null;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          const cached = result[key] as CloudSynthesizerResult | undefined;
          if (cached && cached.ok && cached.structuredOutput) {
            resolve(cached);
          } else {
            resolve(null);
          }
        });
      });
    }

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CloudSynthesizerResult;
        if (parsed && parsed.ok && parsed.structuredOutput) {
          return parsed;
        }
      }
      return null;
    }

    // Fallback for Node / testing environments
    return memoryCache.get(key) || null;
  } catch (err) {
    console.warn('[clinicalCache] Error reading cache:', err);
  }

  return null;
}

/**
 * Persists a CloudSynthesizerResult to local storage.
 */
export async function setCachedSynthesis(
  key: string,
  result: CloudSynthesizerResult,
): Promise<void> {
  if (!key || !result || !result.ok) return;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const matchingKeys = Object.keys(items || {}).filter((k) =>
            k.startsWith(CACHE_PREFIX),
          );
          if (matchingKeys.length >= MAX_CACHE_ENTRIES) {
            const toRemove = matchingKeys.slice(0, matchingKeys.length - MAX_CACHE_ENTRIES + 1);
            chrome.storage.local.remove(toRemove, () => {
              chrome.storage.local.set({ [key]: result }, () => resolve());
            });
          } else {
            chrome.storage.local.set({ [key]: result }, () => resolve());
          }
        });
      });
      return;
    }

    if (typeof localStorage !== 'undefined') {
      const matchingKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          matchingKeys.push(k);
        }
      }
      if (matchingKeys.length >= MAX_CACHE_ENTRIES) {
        const toRemove = matchingKeys.slice(0, matchingKeys.length - MAX_CACHE_ENTRIES + 1);
        toRemove.forEach((k) => localStorage.removeItem(k));
      }
      localStorage.setItem(key, JSON.stringify(result));
      return;
    }

    // In-memory fallback
    if (memoryCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = memoryCache.keys().next().value;
      if (firstKey) memoryCache.delete(firstKey);
    }
    memoryCache.set(key, result);
  } catch (err) {
    console.warn('[clinicalCache] Error writing cache:', err);
  }
}

/**
 * Clears all internize synthesis cache entries.
 */
export async function clearClinicalCache(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const all = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(null, (items) => resolve(items));
      });
      const keysToRemove = Object.keys(all).filter((k) => k.startsWith(CACHE_PREFIX));
      if (keysToRemove.length > 0) {
        await new Promise<void>((resolve) => {
          chrome.storage.local.remove(keysToRemove, () => resolve());
        });
      }
      return;
    }

    if (typeof localStorage !== 'undefined') {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      return;
    }

    memoryCache.clear();
  } catch (err) {
    console.warn('[clinicalCache] Error clearing cache:', err);
  }
}
