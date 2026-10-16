/**
 * chromeStorage.ts
 * Type-safe wrapper around chrome.storage.sync and chrome.storage.local.
 * Provides a consistent async API that degrades gracefully outside
 * the extension context (e.g., during development / Vite dev server).
 */

import { clearClinicalCache } from '../clinical/clinicalCache';
import type { LocalStorageSchema, SyncStorageSchema } from '../../types/storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Draft TTL: 12 hours in milliseconds (43,200,000 ms). */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage);
}

/**
 * Reads one or more keys from chrome.storage.sync.
 * Returns partial schema — unset keys will be undefined.
 */
export async function syncGet<K extends keyof SyncStorageSchema>(
  keys: K[],
): Promise<Pick<SyncStorageSchema, K>> {
  if (!isExtensionContext()) return {} as Pick<SyncStorageSchema, K>;
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys as string[], (result) => {
      resolve(result as Pick<SyncStorageSchema, K>);
    });
  });
}

/**
 * Writes one or more keys to chrome.storage.sync.
 */
export async function syncSet(data: Partial<SyncStorageSchema>): Promise<void> {
  if (!isExtensionContext()) return;
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Removes one or more keys from chrome.storage.sync.
 */
export async function syncRemove(keys: (keyof SyncStorageSchema)[]): Promise<void> {
  if (!isExtensionContext()) return;
  return new Promise((resolve) => {
    chrome.storage.sync.remove(keys as string[], resolve);
  });
}

// ---------------------------------------------------------------------------
// Local storage (larger quota, not synced across devices)
// ---------------------------------------------------------------------------

/**
 * Reads one or more keys from chrome.storage.local.
 */
export async function localGet<K extends keyof LocalStorageSchema>(
  keys: K[],
): Promise<Pick<LocalStorageSchema, K>> {
  if (!isExtensionContext()) return {} as Pick<LocalStorageSchema, K>;
  return new Promise((resolve) => {
    chrome.storage.local.get(keys as string[], (result) => {
      resolve(result as Pick<LocalStorageSchema, K>);
    });
  });
}

/**
 * Writes one or more keys to chrome.storage.local.
 */
export async function localSet(data: Partial<LocalStorageSchema>): Promise<void> {
  if (!isExtensionContext()) return;
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Removes one or more keys from chrome.storage.local.
 */
export async function localRemove(keys: (keyof LocalStorageSchema)[]): Promise<void> {
  if (!isExtensionContext()) return;
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys as string[], resolve);
  });
}

// ---------------------------------------------------------------------------
// Draft persistence helpers (convenience wrappers with 12h TTL auto-expiry)
// ---------------------------------------------------------------------------

/** Persists the clinical tab's input text as a draft. */
export async function saveClinicalDraft(inputText: string): Promise<void> {
  await localSet({ clinicalDraft: { inputText, lastUpdated: Date.now() } });
}

/**
 * Loads the previously saved clinical draft, if any.
 * Auto-purges and returns null if older than 12 hours (DRAFT_TTL_MS) or missing timestamp.
 */
export async function loadClinicalDraft(): Promise<string | null> {
  const { clinicalDraft } = await localGet(['clinicalDraft']);
  if (!clinicalDraft) return null;

  const now = Date.now();
  if (!clinicalDraft.lastUpdated || now - clinicalDraft.lastUpdated > DRAFT_TTL_MS) {
    await localRemove(['clinicalDraft']);
    return null;
  }
  return clinicalDraft.inputText ?? null;
}

/** Persists the research tab's raw text as a draft. */
export async function saveResearchDraft(rawText: string): Promise<void> {
  await localSet({ researchDraft: { rawText, lastUpdated: Date.now() } });
}

/**
 * Loads the previously saved research draft, if any.
 * Auto-purges and returns null if older than 12 hours (DRAFT_TTL_MS) or missing timestamp.
 */
export async function loadResearchDraft(): Promise<string | null> {
  const { researchDraft } = await localGet(['researchDraft']);
  if (!researchDraft) return null;

  const now = Date.now();
  if (!researchDraft.lastUpdated || now - researchDraft.lastUpdated > DRAFT_TTL_MS) {
    await localRemove(['researchDraft']);
    return null;
  }
  return researchDraft.rawText ?? null;
}

// ---------------------------------------------------------------------------
// Patient session wiper (1-Click Panic Button)
// ---------------------------------------------------------------------------

/**
 * Wipes all active patient drafts, session token maps, and synthesis caches.
 * Does NOT delete user preferences, Gemini API keys, or Supabase credentials.
 */
export async function clearAllPatientSessions(): Promise<void> {
  // 1. Wipe clinical and research drafts from local storage
  await localRemove(['clinicalDraft', 'researchDraft']);

  // 2. Wipe chrome.storage.session (in-memory token maps for cloud synthesizer)
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    try {
      await new Promise<void>((resolve) => {
        if (typeof chrome.storage.session.clear === 'function') {
          chrome.storage.session.clear(() => resolve());
        } else {
          resolve();
        }
      });
    } catch (e) {
      console.warn('[chromeStorage] Failed to clear session storage:', e);
    }
  }

  // 3. Clear all cached clinical synthesis analyses & entities
  await clearClinicalCache();
}
