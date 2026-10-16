import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../../src/components/layout/Header';
import {
  CLINICAL_EXPLANATIONS,
  InfoTooltip,
} from '../../src/components/ui/Tooltip';
import {
  ClinicalServiceTab,
} from '../../src/features/clinical/ClinicalServiceTab';
import {
  SAMPLE_PREOP_CONSUL,
  SAMPLE_COMORBID_WARD,
  SpPdWorkflowPanel,
} from '../../src/features/clinical/SpPdWorkflowPanel';
import { SettingsTab } from '../../src/features/settings/SettingsTab';
import {
  InternalMedicineEngine,
  type SpPdSummaryResult,
} from '../../src/services/clinical/internalMedicineEngine';
import {
  clearAllPatientSessions,
  saveClinicalDraft,
  loadClinicalDraft,
} from '../../src/services/storage/chromeStorage';

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
}

describe('Milestone 3: Beginner User-Friendly UI Redesign Suite (Features 10-14)', () => {
  beforeEach(() => {
    const mockLocal = new MockStorageArea();
    const mockSync = new MockStorageArea();
    const mockSession = new MockStorageArea();

    (globalThis as any).chrome = {
      storage: {
        local: mockLocal,
        sync: mockSync,
        session: mockSession,
      },
      runtime: {
        lastError: undefined,
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 10: Langkah 1-2-3 Banner Visual Guide
  // ══════════════════════════════════════════════════════════════════════════
  describe('Feature 10: Langkah 1-2-3 Banner Guide in ClinicalServiceTab', () => {
    it('renders the Langkah 1-2-3 Banner container and title', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, { initialText: '' }),
      );

      expect(html).toContain('data-testid="langkah-123-banner"');
      expect(html).toContain('Alur Kerja Klinis 3 Langkah (Langkah 1-2-3)');
      expect(html).toContain('100% On-Device • 0 PHI Egress');
    });

    it('renders all 3 distinct workflow steps with plain Indonesian descriptions', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, { initialText: '' }),
      );

      // Langkah 1
      expect(html).toContain('data-testid="langkah-step-1"');
      expect(html).toContain('Input / Contoh Kasus');
      expect(html).toContain(
        'Tempel catatan, sorot di EMR, atau klik 1-klik contoh kasus.',
      );

      // Langkah 2
      expect(html).toContain('data-testid="langkah-step-2"');
      expect(html).toContain('Pilih Mode Telaah');
      expect(html).toContain(
        'Pilih: Jawab Konsul TS, POMR Bangsal, atau Ringkas Kasus.',
      );

      // Langkah 3
      expect(html).toContain('data-testid="langkah-step-3"');
      expect(html).toContain('Salin Draf &amp; Cek PPK');
      expect(html).toContain(
        'Salin ringkasan EMR &amp; telusuri algoritma 121 PPK RS.',
      );
    });

    it('indicates Step 1 as "Aktif" when input text is empty', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, { initialText: '' }),
      );

      expect(html).toContain('Aktif');
      expect(html).not.toContain('>Pilih Mode<');
    });

    it('transitions to Step 2 ("Pilih Mode") and Step 3 ready when input text is populated', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, {
          initialText: SAMPLE_PREOP_CONSUL,
        }),
      );

      expect(html).toContain('>Pilih Mode<');
      expect(html).toContain('Salin &amp; Cek');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 11: 3-Mode Workflow Switcher with Ringkas Kasus
  // ══════════════════════════════════════════════════════════════════════════
  describe('Feature 11: 3-Mode Workflow Switcher (Konsul | POMR | Ringkas)', () => {
    it('renders all 3 mode buttons in SpPdWorkflowPanel switcher', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(SpPdWorkflowPanel, {
          inputText: SAMPLE_PREOP_CONSUL,
        }),
      );

      expect(html).toContain('data-testid="mode-tab-konsul"');
      expect(html).toContain('Jawab Konsul TS');

      expect(html).toContain('data-testid="mode-tab-pomr"');
      expect(html).toContain('Periksa Pasien (POMR)');

      expect(html).toContain('data-testid="mode-tab-ringkas"');
      expect(html).toContain('Ringkas Kasus');
    });

    it('generates rich, deterministic case summary for Ringkas Kasus via engine', () => {
      const summary: SpPdSummaryResult =
        InternalMedicineEngine.generateCaseSummary(SAMPLE_PREOP_CONSUL);

      expect(summary).toBeDefined();
      expect(summary.fullDraftText).toBeDefined();
      expect(summary.fullDraftText.length).toBeGreaterThan(50);
      expect(summary.activeProblemList.length).toBeGreaterThan(0);
      expect(summary.criticalAbnormalLabs).toBeDefined();
    });

    it('identifies RPD, RPO, and Chief Complaint in case summary', () => {
      const summary: SpPdSummaryResult =
        InternalMedicineEngine.generateCaseSummary(SAMPLE_COMORBID_WARD);

      expect(summary.fullDraftText).toContain('=== RESUME MEDIS & RINGKASAN KASUS PENYAKIT DALAM (Sp.PD) ===');
      expect(summary.fullDraftText).toContain('DAFTAR MASALAH AKTIF');
      expect(summary.patientBrief || summary.chiefComplaint).toBeDefined();
    });

    it('includes Ringkas Kasus view elements: copy button, inject button, and content box', () => {
      const summary = InternalMedicineEngine.generateCaseSummary(SAMPLE_PREOP_CONSUL);
      expect(summary.fullDraftText).toContain('DAFTAR MASALAH AKTIF');
      expect(summary.fullDraftText).toContain('Sp.PD');

      const html = ReactDOMServer.renderToString(
        React.createElement(SpPdWorkflowPanel, {
          inputText: SAMPLE_PREOP_CONSUL,
        }),
      );
      expect(html).toContain('data-testid="mode-tab-ringkas"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 12: Tooltip with Plain Indonesian Explanations
  // ══════════════════════════════════════════════════════════════════════════
  describe('Feature 12: Tooltip.tsx & InfoTooltip Indonesian Explanations', () => {
    it('provides exact Indonesian explanation for POMR', () => {
      expect(CLINICAL_EXPLANATIONS.POMR).toBe(
        'Format rekam medis berbasis daftar masalah aktif pasien, membagi setiap diagnosis menjadi rencana 4P terstruktur.',
      );

      const html = ReactDOMServer.renderToString(
        React.createElement(InfoTooltip, { term: 'POMR' }),
      );
      expect(html).toContain('data-testid="tooltip-term-POMR"');
      expect(html).toContain(
        'Format rekam medis berbasis daftar masalah aktif pasien',
      );
    });

    it('provides exact Indonesian explanation for 4P', () => {
      expect(CLINICAL_EXPLANATIONS['4P']).toBe(
        '4 Pilar Rencana PAPDI: Pdx (Rencana Penunjang Diagnostik), Ptx (Terapi Obat & Dosis), Pmx (Target Pemantauan Lab & Klinis), Pex (Edukasi Pasien & Keluarga).',
      );

      const html = ReactDOMServer.renderToString(
        React.createElement(InfoTooltip, { term: '4P' }),
      );
      expect(html).toContain('data-testid="tooltip-term-4P"');
      expect(html).toContain('4 Pilar Rencana PAPDI');
    });

    it('provides exact Indonesian explanation for CROGE', () => {
      expect(CLINICAL_EXPLANATIONS.CROGE).toBe(
        'Mesin inferensi klinis deterministik 100% lokal di browser Anda (<15ms). Menghitung dosis dan mengecek kontraindikasi 121 PPK RS tanpa internet dan tanpa kirim data ke cloud.',
      );

      const html = ReactDOMServer.renderToString(
        React.createElement(InfoTooltip, { term: 'CROGE' }),
      );
      expect(html).toContain('data-testid="tooltip-term-CROGE"');
      expect(html).toContain(
        'Mesin inferensi klinis deterministik 100% lokal di browser Anda',
      );
    });

    it('provides exact Indonesian explanation for BYOK', () => {
      expect(CLINICAL_EXPLANATIONS.BYOK).toBe(
        'Gunakan API Key Google Gemini pribadi Anda (gratis via Google AI Studio). Seluruh identitas pasien disensor total secara lokal sebelum dikirim, dan Google tidak pernah menyimpan percakapan (store: false).',
      );

      const html = ReactDOMServer.renderToString(
        React.createElement(InfoTooltip, { term: 'BYOK' }),
      );
      expect(html).toContain('data-testid="tooltip-term-BYOK"');
      expect(html).toContain(
        'Gunakan API Key Google Gemini pribadi Anda (gratis via Google AI Studio)',
      );
    });

    it('supports custom content and custom labels', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(InfoTooltip, {
          content: 'Penjelasan kustom untuk pengujian.',
          label: 'Istilah Khusus',
        }),
      );
      expect(html).toContain('Istilah Khusus');
      expect(html).toContain('Penjelasan kustom untuk pengujian.');
    });

    it('is integrated into SettingsTab for BYOK and CROGE', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(SettingsTab, {}),
      );
      expect(html).toContain('data-testid="tooltip-term-BYOK"');
      expect(html).toContain('data-testid="tooltip-term-CROGE"');
    });

    it('is integrated into SpPdWorkflowPanel for CROGE, POMR, and 4P', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(SpPdWorkflowPanel, {
          inputText: SAMPLE_PREOP_CONSUL,
        }),
      );
      expect(html).toContain('data-testid="tooltip-term-CROGE"');
      expect(html).toContain('data-testid="tooltip-term-POMR"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 13: Prominent 1-Click Sample Button
  // ══════════════════════════════════════════════════════════════════════════
  describe('Feature 13: Prominent 1-Click Sample Case Button (Single Bottom Placement)', () => {
    it('renders exactly one prominent sample button in empty state without upper duplicate', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, { initialText: '' }),
      );

      // Single bottom button present
      expect(html).toContain('data-testid="empty-state-sample-preop-btn"');
      expect(html).toContain('Coba Contoh Kasus Pre-Op (1-Klik)');

      // Upper duplicate button removed
      expect(html).not.toContain('data-testid="prominent-sample-preop-btn"');
      // No duplicate bracketed text with extra lightning icon
      expect(html).not.toContain('[ ⚡ Coba Contoh Kasus Pre-Op (1-Klik) ]');
    });

    it('uses warm gold gradient styling and distinctive contrast', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ClinicalServiceTab, { initialText: '' }),
      );

      expect(html).toContain('from-amber-500');
      expect(html).toContain('via-amber-400');
      expect(html).toContain('to-amber-500');
      expect(html).toContain('text-maroon-950');
    });

    it('sample text SAMPLE_PREOP_CONSUL contains comprehensive Sp.PD pre-operative data', () => {
      expect(SAMPLE_PREOP_CONSUL).toContain('TD 170/100 mmHg');
      expect(SAMPLE_PREOP_CONSUL).toContain('Kalium: 1.87 mEq/L');
      expect(SAMPLE_PREOP_CONSUL).toContain('Trombosit: 54.000 /uL');
      expect(SAMPLE_PREOP_CONSUL).toContain('Metformin');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 14: Header Panic / Wipe Session Button ("Bersihkan Sesi")
  // ══════════════════════════════════════════════════════════════════════════
  describe('Feature 14: Header Panic / Wipe Session Button ("Bersihkan Sesi")', () => {
    it('renders "Bersihkan Sesi" panic button in Header', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(Header, {
          onClearSessionClick: () => {},
        }),
      );

      expect(html).toContain('data-testid="header-clear-session-btn"');
      expect(html).toContain('Bersihkan Sesi');
      expect(html).toContain('bg-rose-50');
      expect(html).toContain('text-rose-700');
    });

    it('calls onClearSessionClick callback when provided', () => {
      const clearMock = vi.fn();
      const headerElem = React.createElement(Header, {
        onClearSessionClick: clearMock,
      });
      const html = ReactDOMServer.renderToString(headerElem);
      expect(html).toContain('Bersihkan Sesi');
    });

    it('clearAllPatientSessions wipes clinical drafts and cached patient sessions', async () => {
      // 1. Seed draft
      await saveClinicalDraft('Pasien tes rahasia Ny. Siti NIK 3171012345678901');
      const loadedBefore = await loadClinicalDraft();
      expect(loadedBefore).toBe('Pasien tes rahasia Ny. Siti NIK 3171012345678901');

      // 2. Wipe sessions
      await clearAllPatientSessions();

      // 3. Verify wiped
      const loadedAfter = await loadClinicalDraft();
      expect(loadedAfter).toBeNull();
    });
  });
});
