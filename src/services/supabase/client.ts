/**
 * client.ts
 * Supabase integration for internize.ai.
 * Reads Supabase credentials from chrome.storage.sync and provides
 * a typed push function for FHIR Bundle upsert.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { FhirBundle } from '../../types/fhir';
import type { SupabaseConfig } from '../../types/research';

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

/**
 * Loads Supabase config from chrome.storage.sync.
 * Returns null if running outside extension context or if not configured.
 */
export async function loadSupabaseConfig(): Promise<SupabaseConfig | null> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      resolve(null);
      return;
    }
    chrome.storage.sync.get(['supabaseConfig'], (result) => {
      const config = result.supabaseConfig as SupabaseConfig | undefined;
      if (config?.url && config?.anonKey) {
        resolve(config);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Saves Supabase config to chrome.storage.sync.
 */
export async function saveSupabaseConfig(config: SupabaseConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      resolve();
      return;
    }
    chrome.storage.sync.set({ supabaseConfig: config }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

let _cachedClient: SupabaseClient | null = null;
let _cachedUrl = '';
let _cachedKey = '';

function getClient(url: string, anonKey: string): SupabaseClient {
  if (_cachedClient && url === _cachedUrl && anonKey === _cachedKey) {
    return _cachedClient;
  }
  _cachedClient = createClient(url, anonKey);
  _cachedUrl = url;
  _cachedKey = anonKey;
  return _cachedClient;
}

// ---------------------------------------------------------------------------
// Row shape stored in Supabase
// ---------------------------------------------------------------------------

export interface FhirBundleRow {
  id: string;
  bundle_type: string;
  resource_count: number;
  generated_at: string;
  payload: Record<string, unknown>;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Push function
// ---------------------------------------------------------------------------

export interface SupabasePushResult {
  success: boolean;
  rowId?: string;
  error?: string;
}

/**
 * Upserts a FHIR Bundle into the configured Supabase table.
 * Uses the Bundle `id` as the primary key for idempotent upserts.
 *
 * @param bundle    The assembled FHIR R4 Transaction Bundle.
 * @param config    Supabase credentials (loaded from storage or passed directly).
 */
export async function pushBundleToSupabase(
  bundle: FhirBundle,
  config: SupabaseConfig,
): Promise<SupabasePushResult> {
  if (!config.url || !config.anonKey) {
    return { success: false, error: 'Supabase URL or anon key is missing. Configure in Settings.' };
  }

  const client = getClient(config.url, config.anonKey);
  const tableName = config.tableName ?? 'fhir_bundles';

  const row: FhirBundleRow = {
    id: bundle.id ?? `bundle-${Date.now()}`,
    bundle_type: bundle.type,
    resource_count: bundle.entry.length,
    generated_at: new Date().toISOString(),
    payload: bundle as unknown as Record<string, unknown>,
  };

  const { data, error } = await client
    .from(tableName)
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, rowId: (data as { id: string } | null)?.id };
}

/**
 * Tests connectivity by performing a lightweight schema check.
 */
export async function testSupabaseConnection(config: SupabaseConfig): Promise<SupabasePushResult> {
  if (!config.url || !config.anonKey) {
    return { success: false, error: 'Missing credentials.' };
  }
  try {
    const client = getClient(config.url, config.anonKey);
    const tableName = config.tableName ?? 'fhir_bundles';
    const { error } = await client.from(tableName).select('id').limit(1);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
