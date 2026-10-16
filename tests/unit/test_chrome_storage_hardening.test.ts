import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_TTL_MS,
  clearAllPatientSessions,
  loadClinicalDraft,
  loadResearchDraft,
  saveClinicalDraft,
  saveResearchDraft,
} from '../../src/services/storage/chromeStorage';
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
} from '../../src/services/supabase/client';
import type { SupabaseConfig } from '../../src/types/research';

// ─── Chrome Storage Mock Implementation ──────────────────────────────────────

class MockStorageArea {
  private store = new Map<string, any>();

  get(keys: string[] | string | null, callback: (result: Record<string, any>) => void): void {
    const result: Record<string, any> = {};
    if (keys === null) {
      for (const [k, v] of this.store.entries()) {
        result[k] = v;
      }
    } else {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        if (this.store.has(k)) {
          result[k] = this.store.get(k);
        }
      }
    }
    setTimeout(() => callback(result), 0);
  }

  set(items: Record<string, any>, callback?: () => void): void {
    for (const [k, v] of Object.entries(items)) {
      this.store.set(k, v);
    }
    if (callback) setTimeout(callback, 0);
  }

  remove(keys: string[] | string, callback?: () => void): void {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      this.store.delete(k);
    }
    if (callback) setTimeout(callback, 0);
  }

  clear(callback?: () => void): void {
    this.store.clear();
    if (callback) setTimeout(callback, 0);
  }

  _inspect(key: string): any {
    return this.store.get(key);
  }

  _has(key: string): boolean {
    return this.store.has(key);
  }

  _seed(key: string, value: any): void {
    this.store.set(key, value);
  }
}

describe('Storage Hardening: TTL Expiry, Session Wipe & Supabase Local Confinement', () => {
  let mockLocal: MockStorageArea;
  let mockSync: MockStorageArea;
  let mockSession: MockStorageArea;

  beforeEach(() => {
    mockLocal = new MockStorageArea();
    mockSync = new MockStorageArea();
    mockSession = new MockStorageArea();

    (globalThis as any).chrome = {
      storage: {
        local: mockLocal,
        sync: mockSync,
        session: mockSession,
      },
      runtime: {
        lastError: undefined,
      },
    };
  });

  // ─── 1. Draft 12-Hour TTL Auto-Expiry ──────────────────────────────────────

  describe('Draft 12-Hour TTL Auto-Expiry', () => {
    it('S1.1: exports DRAFT_TTL_MS equal to 12 hours (43,200,000 ms)', () => {
      expect(DRAFT_TTL_MS).toBe(12 * 60 * 60 * 1000);
      expect(DRAFT_TTL_MS).toBe(43_200_000);
    });

    it('S1.2: saves and retrieves clinical draft within 12 hours', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await saveClinicalDraft('Pasien Tn. Budi, keluhan demam 3 hari');

      // 1 hour later
      vi.spyOn(Date, 'now').mockReturnValue(now + 1 * 60 * 60 * 1000);
      const draft = await loadClinicalDraft();

      expect(draft).toBe('Pasien Tn. Budi, keluhan demam 3 hari');
      expect(mockLocal._has('clinicalDraft')).toBe(true);

      vi.restoreAllMocks();
    });

    it('S1.3: retrieves clinical draft right at 11 hours 59 minutes', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await saveClinicalDraft('Draf batas waktu aman');

      // 11 hours 59 minutes later
      vi.spyOn(Date, 'now').mockReturnValue(now + (12 * 60 * 60 * 1000 - 60 * 1000));
      const draft = await loadClinicalDraft();

      expect(draft).toBe('Draf batas waktu aman');
      expect(mockLocal._has('clinicalDraft')).toBe(true);

      vi.restoreAllMocks();
    });

    it('S1.4: auto-purges clinical draft and returns null after 12 hours', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await saveClinicalDraft('Data sensitif pasien bangsal');

      // 12 hours and 1 millisecond later
      vi.spyOn(Date, 'now').mockReturnValue(now + DRAFT_TTL_MS + 1);
      const draft = await loadClinicalDraft();

      expect(draft).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      vi.restoreAllMocks();
    });

    it('S1.5: auto-purges draft with missing or corrupt lastUpdated timestamp', async () => {
      mockLocal._seed('clinicalDraft', { inputText: 'Orphan draft without timestamp' });

      const draft = await loadClinicalDraft();
      expect(draft).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
    });

    it('S1.6: returns null when no clinical draft exists in storage', async () => {
      const draft = await loadClinicalDraft();
      expect(draft).toBeNull();
    });

    it('S1.7: saves and retrieves research draft within 12 hours', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await saveResearchDraft('Patient 45yo male admitted with Hb 6.5 g/dL');

      // 6 hours later
      vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 60 * 1000);
      const draft = await loadResearchDraft();

      expect(draft).toBe('Patient 45yo male admitted with Hb 6.5 g/dL');
      expect(mockLocal._has('researchDraft')).toBe(true);

      vi.restoreAllMocks();
    });

    it('S1.8: auto-purges research draft and returns null after 12 hours', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await saveResearchDraft('Expired research narrative');

      // 13 hours later
      vi.spyOn(Date, 'now').mockReturnValue(now + 13 * 60 * 60 * 1000);
      const draft = await loadResearchDraft();

      expect(draft).toBeNull();
      expect(mockLocal._has('researchDraft')).toBe(false);

      vi.restoreAllMocks();
    });
  });

  // ─── 2. 1-Click Panic Wiper: clearAllPatientSessions ───────────────────────

  describe('1-Click Session Panic Wiper (clearAllPatientSessions)', () => {
    it('S2.1: wipes both clinical and research drafts from local storage', async () => {
      mockLocal._seed('clinicalDraft', { inputText: 'Clinical text', lastUpdated: Date.now() });
      mockLocal._seed('researchDraft', { rawText: 'Research text', lastUpdated: Date.now() });

      await clearAllPatientSessions();

      expect(mockLocal._has('clinicalDraft')).toBe(false);
      expect(mockLocal._has('researchDraft')).toBe(false);
    });

    it('S2.2: clears chrome.storage.session', async () => {
      mockSession._seed('cloudSynthTokenMap', { '[PATIENT_1]': 'Tn. Budi Santoso' });

      await clearAllPatientSessions();

      expect(mockSession._has('cloudSynthTokenMap')).toBe(false);
    });

    it('S2.3: clears cached clinical synthesis analyses', async () => {
      mockLocal._seed('internize_synth_cache_v1_hash123', { summary_one_liner: 'Cached result' });

      await clearAllPatientSessions();

      expect(mockLocal._has('internize_synth_cache_v1_hash123')).toBe(false);
    });

    it('S2.4: does NOT delete userPreferences or credentials', async () => {
      mockSync._seed('userPreferences', { autoReceiveHighlight: true, defaultTab: 'clinical' });
      mockLocal._seed('supabaseConfig', { url: 'https://test.supabase.co', anonKey: 'key123' });

      await clearAllPatientSessions();

      expect(mockSync._inspect('userPreferences')).toEqual({
        autoReceiveHighlight: true,
        defaultTab: 'clinical',
      });
      expect(mockLocal._inspect('supabaseConfig')).toEqual({
        url: 'https://test.supabase.co',
        anonKey: 'key123',
      });
    });

    it('S2.5: runs cleanly even when chrome.storage.session is unavailable', async () => {
      (globalThis as any).chrome.storage.session = undefined;
      mockLocal._seed('clinicalDraft', { inputText: 'Draft', lastUpdated: Date.now() });

      await expect(clearAllPatientSessions()).resolves.not.toThrow();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
    });
  });

  // ─── 3. Supabase Local Confinement & Zero-Friction Auto-Migration ──────────

  describe('Supabase Local Storage Confinement & Migration', () => {
    const sampleConfig: SupabaseConfig = {
      url: 'https://xyzhospital.supabase.co',
      anonKey: 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_testing_purposes',
      tableName: 'fhir_bundles',
    };

    it('S3.1: saveSupabaseConfig writes to local storage and removes legacy sync copy', async () => {
      // Suppose old sync copy exists
      mockSync._seed('supabaseConfig', sampleConfig);

      await saveSupabaseConfig(sampleConfig);

      expect(mockLocal._inspect('supabaseConfig')).toEqual(sampleConfig);
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('S3.2: loadSupabaseConfig reads directly from local storage when present', async () => {
      mockLocal._seed('supabaseConfig', sampleConfig);

      const loaded = await loadSupabaseConfig();

      expect(loaded).toEqual(sampleConfig);
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('S3.3: loadSupabaseConfig auto-migrates from sync to local when local is empty', async () => {
      mockSync._seed('supabaseConfig', sampleConfig);

      const loaded = await loadSupabaseConfig();

      // Successfully returned
      expect(loaded).toEqual(sampleConfig);
      // Migrated to local
      expect(mockLocal._inspect('supabaseConfig')).toEqual(sampleConfig);
      // Deleted from sync
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('S3.4: returns null when neither local nor sync has configuration', async () => {
      const loaded = await loadSupabaseConfig();
      expect(loaded).toBeNull();
    });
  });
});
