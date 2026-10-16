import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_TTL_MS,
  clearAllPatientSessions,
  loadClinicalDraft,
  loadResearchDraft,
  saveClinicalDraft,
  saveResearchDraft,
  localGet,
  localSet,
  syncGet,
  syncSet,
} from '../../src/services/storage/chromeStorage';
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
  pushBundleToSupabase,
  testSupabaseConnection,
} from '../../src/services/supabase/client';
import {
  runGuardrail,
  runMarkdownGuardrail,
  scanForLeakage,
  extractTokens,
  reidentifyOutput,
  reidentifyMarkdown,
  LEAKAGE_PATTERNS,
  type SpPdSynthesisOutput,
} from '../../src/services/clinical/cloudGuardrail';
import type { SupabaseConfig } from '../../src/types/research';

// ─── Chrome Storage Mock Implementation for Adversarial Harness ──────────────

class MockStorageArea {
  public store = new Map<string, any>();
  public failNext = false;
  public failError: Error | null = null;

  get(keys: string[] | string | null, callback: (result: Record<string, any>) => void): void {
    if (this.failNext) {
      this.failNext = false;
      throw this.failError || new Error('Simulated storage.get failure');
    }
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
    if (this.failNext) {
      this.failNext = false;
      throw this.failError || new Error('Simulated storage.set failure');
    }
    for (const [k, v] of Object.entries(items)) {
      this.store.set(k, v);
    }
    if (callback) setTimeout(callback, 0);
  }

  remove(keys: string[] | string, callback?: () => void): void {
    if (this.failNext) {
      this.failNext = false;
      throw this.failError || new Error('Simulated storage.remove failure');
    }
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      this.store.delete(k);
    }
    if (callback) setTimeout(callback, 0);
  }

  clear(callback?: () => void): void {
    if (this.failNext) {
      this.failNext = false;
      throw this.failError || new Error('Simulated storage.clear failure');
    }
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

// ─── Fixture Helpers ─────────────────────────────────────────────────────────

function makeValidSynthesisOutput(overrides: Record<string, unknown> = {}): SpPdSynthesisOutput {
  return {
    summary_one_liner: 'Pasien [PATIENT_1] No. RM [MRN_1] dengan CHF NYHA III dan HT Grade 2',
    problem_list: [
      {
        priority: 1,
        division: 'Kardiologi',
        diagnosis: 'CHF NYHA III',
        evidence_rationale: 'Sesak napas, kardiomegali, edema pada [PATIENT_1]',
        differential_diagnoses: ['PPOK eksaserbasi'],
        urgency: 'high',
      },
    ],
    pertinent_negatives: ['Nyeri dada disangkal'],
    cross_specialty_safety_alerts: {
      renal_risk: 'Evaluasi kreatinin sebelum ACEi',
      hepatic_risk: 'Fungsi hepar aman',
      cardiac_qtc_risk: 'Risiko rendah',
      bleeding_hemostasis_risk: 'Trombosit normal',
    },
    soap_note: {
      subjective: 'Pasien [PATIENT_1] mengeluh sesak napas',
      objective: 'TD 150/90, HR 88, RM [MRN_1]',
      assessment: 'CHF NYHA III',
      plan: {
        diagnostik: ['EKG', 'Foto toraks'],
        terapeutik: ['Furosemide 1x40mg IV'],
        monitoring: ['Balans cairan'],
        edukasi: ['Batasi asupan garam'],
      },
    },
    ...overrides,
  };
}

const VALID_SANITIZED_TEXT = `Pasien [PATIENT_1] No. RM [MRN_1]`;

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: Empirical Adversarial Challenge (Challenger 2)
// ══════════════════════════════════════════════════════════════════════════════

describe('Challenger 2: Storage Hardening Adversarial Verification', () => {
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

  // ─── 1. TTL Boundary Conditions ───────────────────────────────────────────

  describe('1. 12-Hour TTL Boundary Conditions & Clock Edge Cases', () => {
    const BASE_TIME = 1_700_000_000_000;

    it('TTL.1: Exact boundary (12h 00m 00s 000ms): draft is retained (<= 12h)', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME);
      await saveClinicalDraft('Tepat 12 jam');

      // Advance by exactly DRAFT_TTL_MS (43,200,000 ms)
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS);
      const draft = await loadClinicalDraft();

      expect(draft).toBe('Tepat 12 jam');
      expect(mockLocal._has('clinicalDraft')).toBe(true);
      vi.restoreAllMocks();
    });

    it('TTL.2: 1ms before expiry (11h 59m 59s 999ms): draft is retained', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME);
      await saveClinicalDraft('1ms sebelum batas');

      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS - 1);
      const draft = await loadClinicalDraft();

      expect(draft).toBe('1ms sebelum batas');
      expect(mockLocal._has('clinicalDraft')).toBe(true);
      vi.restoreAllMocks();
    });

    it('TTL.3: 1ms after expiry (12h 00m 00s 001ms): draft is immediately purged', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME);
      await saveClinicalDraft('1ms setelah batas');

      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS + 1);
      const draft = await loadClinicalDraft();

      expect(draft).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
      vi.restoreAllMocks();
    });

    it('TTL.4: 12h 01m later: draft is purged', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME);
      await saveClinicalDraft('12 jam 1 menit');

      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS + 60_000);
      const draft = await loadClinicalDraft();

      expect(draft).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
      vi.restoreAllMocks();
    });

    it('TTL.5: Corrupted timestamp cases (NaN, string, null, undefined, boolean, object)', async () => {
      // 5a. null timestamp
      mockLocal._seed('clinicalDraft', { inputText: 'Data A', lastUpdated: null });
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      // 5b. undefined timestamp
      mockLocal._seed('clinicalDraft', { inputText: 'Data B', lastUpdated: undefined });
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      // 5c. 0 timestamp
      mockLocal._seed('clinicalDraft', { inputText: 'Data C', lastUpdated: 0 });
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      // 5d. NaN timestamp
      mockLocal._seed('clinicalDraft', { inputText: 'Data D', lastUpdated: NaN });
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      // 5e. String timestamp "corrupt"
      mockLocal._seed('clinicalDraft', { inputText: 'Data E', lastUpdated: 'corrupted_string' });
      // Evaluates: now - "corrupted_string" = NaN. Check behavior:
      const resE = await loadClinicalDraft();
      // If NaN > DRAFT_TTL_MS evaluates to false, resE might not be purged unless type-checked!
      // Challenger check:
      console.log('  [EMPIRICAL] String timestamp behavior:', resE);

      // 5f. ISO date string "2026-10-16T12:00:00Z"
      mockLocal._seed('clinicalDraft', { inputText: 'Data F', lastUpdated: '2020-01-01T00:00:00Z' });
      const resF = await loadClinicalDraft();
      console.log('  [EMPIRICAL] ISO string timestamp behavior:', resF);

      // 5g. Entire draft is primitive or corrupted
      mockLocal._seed('clinicalDraft', 'just a string');
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);

      mockLocal._seed('clinicalDraft', 12345);
      expect(await loadClinicalDraft()).toBeNull();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
    });

    it('TTL.6: Research draft symmetric boundary check', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME);
      await saveResearchDraft('Research sample draft');

      // 11h59m
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS - 60_000);
      expect(await loadResearchDraft()).toBe('Research sample draft');

      // 12h01m
      vi.spyOn(Date, 'now').mockReturnValue(BASE_TIME + DRAFT_TTL_MS + 60_000);
      expect(await loadResearchDraft()).toBeNull();
      expect(mockLocal._has('researchDraft')).toBe(false);

      vi.restoreAllMocks();
    });
  });

  // ─── 2. clearAllPatientSessions Under Missing / Partial APIs ───────────────

  describe('2. clearAllPatientSessions Under Partial & Degraded Storage Environments', () => {
    it('API.1: Degraded environment where chrome.storage.session is undefined', async () => {
      (globalThis as any).chrome.storage.session = undefined;
      mockLocal._seed('clinicalDraft', { inputText: 'Draft', lastUpdated: Date.now() });
      mockLocal._seed('researchDraft', { rawText: 'Research', lastUpdated: Date.now() });

      await expect(clearAllPatientSessions()).resolves.not.toThrow();

      expect(mockLocal._has('clinicalDraft')).toBe(false);
      expect(mockLocal._has('researchDraft')).toBe(false);
    });

    it('API.2: Degraded environment where chrome.storage.session exists but clear() is not a function', async () => {
      (globalThis as any).chrome.storage.session = { get: vi.fn(), set: vi.fn() }; // no clear()
      mockLocal._seed('clinicalDraft', { inputText: 'Draft', lastUpdated: Date.now() });

      await expect(clearAllPatientSessions()).resolves.not.toThrow();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
    });

    it('API.3: chrome.storage.session.clear() throws synchronously', async () => {
      (globalThis as any).chrome.storage.session = {
        clear: () => {
          throw new Error('Quota or security error during session clear');
        },
      };
      mockLocal._seed('clinicalDraft', { inputText: 'Draft', lastUpdated: Date.now() });

      // Should catch error gracefully and still proceed to clear clinical cache
      await expect(clearAllPatientSessions()).resolves.not.toThrow();
      expect(mockLocal._has('clinicalDraft')).toBe(false);
    });

    it('API.4: Outside extension context (chrome is undefined)', async () => {
      (globalThis as any).chrome = undefined;

      // In browser/node without chrome extension APIs
      await expect(clearAllPatientSessions()).resolves.not.toThrow();
    });

    it('API.5: Preserves non-patient settings across clearAllPatientSessions', async () => {
      mockSync._seed('userPreferences', { autoReceiveHighlight: true, theme: 'dark' });
      mockLocal._seed('supabaseConfig', { url: 'https://test.supabase.co', anonKey: 'secret_key' });
      mockLocal._seed('geminiConfig', { apiKey: 'AIzaSyTestApiKey' });
      mockLocal._seed('clinicalDraft', { inputText: 'Sensitive patient note', lastUpdated: Date.now() });

      await clearAllPatientSessions();

      expect(mockLocal._has('clinicalDraft')).toBe(false);
      expect(mockSync._inspect('userPreferences')).toEqual({ autoReceiveHighlight: true, theme: 'dark' });
      expect(mockLocal._inspect('supabaseConfig')).toEqual({ url: 'https://test.supabase.co', anonKey: 'secret_key' });
      expect(mockLocal._inspect('geminiConfig')).toEqual({ apiKey: 'AIzaSyTestApiKey' });
    });
  });

  // ─── 3. Supabase Sync -> Local Migration Edge Cases ─────────────────────────

  describe('3. Supabase Sync -> Local Migration Edge Cases', () => {
    const validConfig: SupabaseConfig = {
      url: 'https://hospital.supabase.co',
      anonKey: 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_anon_key',
      tableName: 'fhir_bundles',
    };

    it('SUPA.1: Empty sync & empty local -> returns null safely', async () => {
      const result = await loadSupabaseConfig();
      expect(result).toBeNull();
      expect(mockLocal._has('supabaseConfig')).toBe(false);
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('SUPA.2: Existing valid local -> reads local directly and leaves sync untouched', async () => {
      mockLocal._seed('supabaseConfig', validConfig);
      mockSync._seed('supabaseConfig', { url: 'https://old.supabase.co', anonKey: 'old_key' });

      const loaded = await loadSupabaseConfig();

      expect(loaded).toEqual(validConfig);
      expect(mockLocal._inspect('supabaseConfig')).toEqual(validConfig);
      // Sync is left untouched until saveSupabaseConfig is invoked
      expect(mockSync._inspect('supabaseConfig')).toEqual({ url: 'https://old.supabase.co', anonKey: 'old_key' });
    });

    it('SUPA.3: Partial/invalid local config falls back to valid sync and migrates', async () => {
      // Local has corrupted entry with missing anonKey
      mockLocal._seed('supabaseConfig', { url: 'https://corrupt.supabase.co' });
      mockSync._seed('supabaseConfig', validConfig);

      const loaded = await loadSupabaseConfig();

      expect(loaded).toEqual(validConfig);
      // Local overwritten with valid config
      expect(mockLocal._inspect('supabaseConfig')).toEqual(validConfig);
      // Stale sync copy purged
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('SUPA.4: Corrupted sync data (string or non-object) -> returns null without throwing', async () => {
      mockSync._seed('supabaseConfig', 'malformed_json_string');

      const loaded = await loadSupabaseConfig();
      expect(loaded).toBeNull();
    });

    it('SUPA.5: saveSupabaseConfig strictly writes local and purges sync', async () => {
      mockSync._seed('supabaseConfig', { url: 'https://stale.supabase.co', anonKey: 'stale' });

      await saveSupabaseConfig(validConfig);

      expect(mockLocal._inspect('supabaseConfig')).toEqual(validConfig);
      expect(mockSync._has('supabaseConfig')).toBe(false);
    });

    it('SUPA.6: pushBundleToSupabase returns error gracefully if credentials missing', async () => {
      const dummyBundle: any = { resourceType: 'Bundle', type: 'transaction', entry: [] };
      const emptyConfig: SupabaseConfig = { url: '', anonKey: '' };

      const pushRes = await pushBundleToSupabase(dummyBundle, emptyConfig);
      expect(pushRes.success).toBe(false);
      expect(pushRes.error).toContain('missing');

      const testRes = await testSupabaseConnection(emptyConfig);
      expect(testRes.success).toBe(false);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: Cloud Guardrail Adversarial Verification (Challenger 2)
// ══════════════════════════════════════════════════════════════════════════════

describe('Challenger 2: Cloud Guardrail Adversarial Verification', () => {
  // ─── 4. Real Leaks vs Sanitized Tokens ────────────────────────────────────

  describe('4. Real Leaks vs Legitimate Sanitized Tokens', () => {
    it('LEAK.1: Unredacted 13-digit BPJS variants trip circuit breaker', () => {
      // Standard 13-digit integer
      expect(scanForLeakage('No BPJS: 0001234567890')).toContain('BPJS');
      // Hyphenated 4-4-5
      expect(scanForLeakage('Kartu BPJS: 0001-2345-67890')).toContain('BPJS');
      // Space separated 4-4-5
      expect(scanForLeakage('BPJS: 0001 2345 67890')).toContain('BPJS');
      // Prefixed No. Peserta
      expect(scanForLeakage('No. Peserta: 0001234567890')).toContain('BPJS');
      // Prefixed No Kartu
      expect(scanForLeakage('No. Kartu: 0001-2345-67890')).toContain('BPJS');
      // Prefixed BPJS TK
      expect(scanForLeakage('BPJS TK: 0001234567890')).toContain('BPJS');
    });

    it('LEAK.2: Sanitized BPJS tokens DO NOT trip circuit breaker', () => {
      expect(scanForLeakage('Pasien dengan [BPJS_1] terdaftar')).toBeNull();
      expect(scanForLeakage('No. Kartu: [BPJS_1]')).toBeNull();
      expect(scanForLeakage('BPJS Kesehatan: [BPJS_1]')).toBeNull();
      expect(scanForLeakage('No. Peserta: [HEALTH_PLAN_ID_1]')).toBeNull();
      expect(scanForLeakage('BPJS: [BPJS]')).toBeNull();
    });

    it('LEAK.3: Unredacted Indonesian phone numbers trip circuit breaker', () => {
      // 08xx unformatted
      expect(scanForLeakage('Telp 081234567890')).toContain('Indonesian phone');
      // 08xx hyphenated 4-4-4
      expect(scanForLeakage('Kontak: 0812-3456-7890')).toContain('Indonesian phone');
      // 08xx hyphenated 4-4-3
      expect(scanForLeakage('HP: 0812-345-6789')).toContain('Indonesian phone');
      // 08xx dot-separated
      expect(scanForLeakage('WA: 0812.3456.7890')).toContain('Indonesian phone');
      // +62 unformatted (12-digit mobile)
      expect(scanForLeakage('Call +628123456789')).toContain('Indonesian phone');
      // +62 unformatted (13-digit, trips either phone or BPJS breaker)
      expect(scanForLeakage('Call +6281234567890')).not.toBeNull();
      // +62 formatted with hyphens
      expect(scanForLeakage('Emergency: +62 812-3456-7890')).toContain('Indonesian phone');
      // +62 formatted with dots
      expect(scanForLeakage('Telp: +62.812.3456.7890')).toContain('Indonesian phone');
    });

    it('LEAK.4: Sanitized phone tokens DO NOT trip circuit breaker', () => {
      expect(scanForLeakage('Kontak darurat: [PHONE_1]')).toBeNull();
      expect(scanForLeakage('Telp: [PHONE]')).toBeNull();
      expect(scanForLeakage('Hubungi [PHONE_2] bila memburuk')).toBeNull();
    });

    it('LEAK.5: Unredacted Indonesian MRN patterns trip circuit breaker', () => {
      expect(scanForLeakage('Pasien No. RM: 12-34-56')).toContain('Indonesian MRN');
      expect(scanForLeakage('RM: 123456')).toContain('Indonesian MRN');
      expect(scanForLeakage('NRM: 998877')).toContain('Indonesian MRN');
      expect(scanForLeakage('Rekam Medis: 45.67.89')).toContain('Indonesian MRN');
      expect(scanForLeakage('Nomor Rekam Medis: 12/34/56')).toContain('Indonesian MRN');
      expect(scanForLeakage('No. RM 123456')).toContain('Indonesian MRN');
      expect(scanForLeakage('RM# 123456')).toContain('Indonesian MRN');
    });

    it('LEAK.6: Sanitized MRN tokens DO NOT trip circuit breaker', () => {
      expect(scanForLeakage('Pasien No. RM: [MRN_1]')).toBeNull();
      expect(scanForLeakage('No. RM [MRN_1]')).toBeNull();
      expect(scanForLeakage('RM: [MRN_1]')).toBeNull();
      expect(scanForLeakage('NRM: [MRN_1]')).toBeNull();
      expect(scanForLeakage('Rekam Medis: [MRN]')).toBeNull();
      expect(scanForLeakage('No. Rekam Medis: [MRN_2]')).toBeNull();
    });

    it('LEAK.7: Unredacted Patient Name Honorifics trip circuit breaker', () => {
      expect(scanForLeakage('Pasien Tn. Budi Santoso datang kontrol')).toContain('honorific');
      expect(scanForLeakage('Ny. Siti Aminah mengeluh pusing')).toContain('honorific');
      expect(scanForLeakage('Nn. Ratna dirawat')).toContain('honorific');
      expect(scanForLeakage('Sdr. Joko demam')).toContain('honorific');
      expect(scanForLeakage('Sdri. Maya batuk')).toContain('honorific');
      expect(scanForLeakage('Bp. Hendra kontrol poli')).toContain('honorific');
      expect(scanForLeakage('Bpk. Suparno kontrol')).toContain('honorific');
      expect(scanForLeakage('An. Dimas sesak')).toContain('honorific');
      expect(scanForLeakage('Ibu Kartini lemas')).toContain('honorific');
      // Case-insensitivity check
      expect(scanForLeakage('pasien tn. budi santoso')).toContain('honorific');
    });

    it('LEAK.8: Sanitized Patient Name tokens DO NOT trip circuit breaker', () => {
      expect(scanForLeakage('Pasien Tn. [PATIENT_1] datang kontrol')).toBeNull();
      expect(scanForLeakage('Ny. [PATIENT_1] lemas')).toBeNull();
      expect(scanForLeakage('An. [PATIENT_2] batuk')).toBeNull();
      expect(scanForLeakage('Ibu [PATIENT_3] sesak')).toBeNull();
      expect(scanForLeakage('Tn. [NAME_1] stabil')).toBeNull();
      expect(scanForLeakage('Ny. [NAME] dirawat')).toBeNull();
      expect(scanForLeakage('Sdr. [PATIENT_1]')).toBeNull();
    });

    it('LEAK.9: Anti-False-Positive tests (Clinical collision immunity)', () => {
      // Cardiology Regurgitasi Mitral (RM)
      expect(scanForLeakage('Murmur pansistolik ec RM moderate')).toBeNull();
      expect(scanForLeakage('Etiologi gagal jantung: RM severe + AS')).toBeNull();

      // Clinical Anemia abbreviations
      expect(scanForLeakage('Diagnosis: An. defisiensi besi')).toBeNull();
      expect(scanForLeakage('An. renal ec CKD Stage 5')).toBeNull();
      expect(scanForLeakage('An. aplastik terkonfirmasi BMP')).toBeNull();
      expect(scanForLeakage('An. hemolitik autoimun (AIHA)')).toBeNull();
      expect(scanForLeakage('An. normositik normokrom')).toBeNull();
      expect(scanForLeakage('An. mikrositik hipokrom')).toBeNull();

      // Anatomy terms
      expect(scanForLeakage('Nyeri akut pada ibu jari kaki dextra')).toBeNull();
      expect(scanForLeakage('Edema pada ibu jari')).toBeNull();

      // Visit times
      expect(scanForLeakage('Visit dokter pk 08.00 - 12.00')).toBeNull();
      expect(scanForLeakage('Pemeriksaan lab jam 08.30 WIB')).toBeNull();

      // Lab values & vital signs
      expect(scanForLeakage('Kalium: 3.8 mEq/L, Natrium 138 mmol/L')).toBeNull();
      expect(scanForLeakage('Trombosit: 154000 /uL, Leukosit: 11200 /mm3')).toBeNull();
      expect(scanForLeakage('GDS: 185 mg/dL, HbA1c: 7.8%')).toBeNull();
      expect(scanForLeakage('TD: 140/90 mmHg, HR: 88 x/mnt')).toBeNull();
    });
  });

  // ─── 5. Full Guardrail Integration: runGuardrail & runMarkdownGuardrail ────

  describe('5. Full Guardrail & Circuit Breaker Integration', () => {
    it('GUARD.1: runGuardrail blocks JSON when BPJS leaks into problem rationale', () => {
      const leakingOutput = makeValidSynthesisOutput();
      leakingOutput.problem_list[0].evidence_rationale = 'Pasien BPJS 0001234567890 datang sesak';

      const result = runGuardrail(leakingOutput, VALID_SANITIZED_TEXT);
      expect(result.status).toBe('phi_leak');
      expect(result.reason).toContain('BPJS');
      expect(result.output).toBeUndefined();
    });

    it('GUARD.2: runGuardrail blocks JSON when unredacted phone leaks into plan', () => {
      const leakingOutput = makeValidSynthesisOutput();
      leakingOutput.soap_note.plan.edukasi.push('Keluarga dapat dihubungi di 0812-3456-7890');

      const result = runGuardrail(leakingOutput, VALID_SANITIZED_TEXT);
      expect(result.status).toBe('phi_leak');
      expect(result.reason).toContain('Indonesian phone');
    });

    it('GUARD.3: runGuardrail blocks JSON when unredacted MRN leaks into summary', () => {
      const leakingOutput = makeValidSynthesisOutput({
        summary_one_liner: 'Pasien RM: 998811 masuk ICU',
      });

      const result = runGuardrail(leakingOutput, VALID_SANITIZED_TEXT);
      expect(result.status).toBe('phi_leak');
      expect(result.reason).toContain('Indonesian MRN');
    });

    it('GUARD.4: runGuardrail blocks JSON when honorific name leaks into subjective', () => {
      const leakingOutput = makeValidSynthesisOutput();
      leakingOutput.soap_note.subjective = 'Keluhan Tn. Budi Santoso sesak bertambah';

      const result = runGuardrail(leakingOutput, VALID_SANITIZED_TEXT);
      expect(result.status).toBe('phi_leak');
      expect(result.reason).toContain('honorific');
    });

    it('GUARD.5: runGuardrail trips token_leak when required sanitized token is missing', () => {
      const validOutput = makeValidSynthesisOutput();
      // Sanitized text contains [PATIENT_1] and [MRN_1], but output stripped [MRN_1]
      const strippedOutput = JSON.parse(
        JSON.stringify(validOutput).replace(/\[MRN_1\]/g, 'TERHAPUS')
      );

      const result = runGuardrail(strippedOutput, VALID_SANITIZED_TEXT);
      expect(result.status).toBe('token_leak');
      expect(result.reason).toContain('missing tokens: [MRN_1]');
    });

    it('GUARD.6: runMarkdownGuardrail trips immediately on Indonesian PHI leaks in markdown notes', () => {
      const baseNote = `
**RINGKASAN KLINIS (ONE-LINER)**
[PATIENT_1], [AGE_1], No RM [MRN_1] di [HOSPITAL_1]

**JAWABAN KONSUL & PRE-OPERATIVE CLEARANCE**
Status toleransi: LAIK OPERASI DENGAN CATATAN

**DAFTAR MASALAH AKTIF (PROBLEM LIST) & PERENCANAAN 4P**
1. Hipertensi

**CROSS-SPECIALTY SAFETY ALERTS (AUDIT KESELAMATAN LINTAS ORGAN)**
Aman
      `.trim();

      const sourceSanitized = '[PATIENT_1], [AGE_1], [MRN_1], [HOSPITAL_1]';

      // 6a. Clean note passes
      expect(runMarkdownGuardrail(baseNote, sourceSanitized, 'konsul').status).toBe('pass');

      // 6b. Leaked BPJS
      const leakBpjs = `${baseNote}\nBPJS: 0001234567890`;
      expect(runMarkdownGuardrail(leakBpjs, sourceSanitized, 'konsul').status).toBe('phi_leak');

      // 6c. Leaked phone
      const leakPhone = `${baseNote}\nNo HP: 0812-9988-7766`;
      expect(runMarkdownGuardrail(leakPhone, sourceSanitized, 'konsul').status).toBe('phi_leak');

      // 6d. Leaked MRN
      const leakMrn = `${baseNote}\nNomor Rekam Medis: 11-22-33`;
      expect(runMarkdownGuardrail(leakMrn, sourceSanitized, 'konsul').status).toBe('phi_leak');

      // 6e. Leaked Name
      const leakName = `${baseNote}\nPasien Ny. Siti Rahma`;
      expect(runMarkdownGuardrail(leakName, sourceSanitized, 'konsul').status).toBe('phi_leak');
    });

    it('GUARD.7: reidentifyOutput correctly swaps tokens without side-effects', () => {
      const validOutput = makeValidSynthesisOutput();
      const tokenMap = new Map<string, string>([
        ['[PATIENT_1]', 'Budi Santoso'],
        ['[MRN_1]', 'RM-123456'],
      ]);

      const reidentified = reidentifyOutput(validOutput, tokenMap);
      const str = JSON.stringify(reidentified);

      expect(str).toContain('Budi Santoso');
      expect(str).toContain('RM-123456');
      expect(str).not.toContain('[PATIENT_1]');
      expect(str).not.toContain('[MRN_1]');
    });
  });

  // ─── 6. Obfuscation & Boundary Adversarial Stress Tests ───────────────────

  describe('6. Obfuscation & Novel Attack Vectors', () => {
    it('OBF.1: BPJS formatted with dots (e.g. 0001.2345.67890)', () => {
      const dotBpjs = 'BPJS: 0001.2345.67890';
      const leak = scanForLeakage(dotBpjs);
      console.log('  [EMPIRICAL] Dot-formatted BPJS leak detection:', leak);
    });

    it('OBF.2: Phone formatted with area code in parentheses (e.g. (0812) 3456-7890)', () => {
      const parenPhone = 'Kontak: (0812) 3456-7890';
      const leak = scanForLeakage(parenPhone);
      console.log('  [EMPIRICAL] Parenthesis-formatted Indo phone leak detection:', leak);
    });

    it('OBF.3: Phone starting with 628 without plus (e.g. 628123456789)', () => {
      const raw628 = 'WA: 628123456789';
      const leak = scanForLeakage(raw628);
      console.log('  [EMPIRICAL] 628 without plus leak detection:', leak);
    });

    it('OBF.4: English MRN prefix (e.g. MRN: 12-34-56)', () => {
      const engMrn = 'Medical Record Number: 12-34-56';
      const leak = scanForLeakage(engMrn);
      console.log('  [EMPIRICAL] English MRN prefix leak detection:', leak);
    });
  });
});
