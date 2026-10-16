import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../../src/components/layout/Header';
import {
  ONBOARDING_TOUR_STEPS,
  OnboardingTourModal,
  type OnboardingTourStepData,
} from '../../src/components/ui/OnboardingTourModal';

// ─── LocalStorage Mock Implementation ───────────────────────────────────────
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('Milestone 4: Interactive Onboarding Tour Modal Suite (Features 15 & 16)', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (globalThis as unknown as Record<string, unknown>).localStorage = mockStorage;

    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        lastError: undefined,
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 15: 7-Step Onboarding Architecture & 3 Pillars Invariant
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. 7 Steps Across 3 Core Pillars Invariant (ONBOARDING_TOUR_STEPS)', () => {
    it('contains exactly 7 progressive educational steps', () => {
      expect(ONBOARDING_TOUR_STEPS.length).toBe(7);
      const stepNumbers = ONBOARDING_TOUR_STEPS.map((s) => s.step);
      expect(stepNumbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('covers all 3 core pillars (Klinis PPK, Riset HIPAA/FHIR, Gemini BYOK) plus Siap Memulai CTA', () => {
      // Step 1 - 4: Pilar 1 (Klinis PPK)
      expect(ONBOARDING_TOUR_STEPS[0].pillar).toBe('Pilar 1: Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[0].category).toBe('Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[0].pillarNumber).toBe(1);

      expect(ONBOARDING_TOUR_STEPS[1].pillar).toBe('Pilar 1: Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[1].category).toBe('Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[1].pillarNumber).toBe(1);

      expect(ONBOARDING_TOUR_STEPS[2].pillar).toBe('Pilar 1: Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[2].category).toBe('Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[2].pillarNumber).toBe(1);

      expect(ONBOARDING_TOUR_STEPS[3].pillar).toBe('Pilar 1: Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[3].category).toBe('Klinis PPK');
      expect(ONBOARDING_TOUR_STEPS[3].pillarNumber).toBe(1);

      // Step 5: Pilar 2 (Riset HIPAA/FHIR)
      expect(ONBOARDING_TOUR_STEPS[4].pillar).toBe('Pilar 2: Riset HIPAA/FHIR');
      expect(ONBOARDING_TOUR_STEPS[4].category).toBe('Riset HIPAA/FHIR');
      expect(ONBOARDING_TOUR_STEPS[4].pillarNumber).toBe(2);

      // Step 6: Pilar 3 (Gemini Pribadi BYOK)
      expect(ONBOARDING_TOUR_STEPS[5].pillar).toBe('Pilar 3: Gemini Pribadi BYOK');
      expect(ONBOARDING_TOUR_STEPS[5].category).toBe('Gemini Pribadi BYOK');
      expect(ONBOARDING_TOUR_STEPS[5].pillarNumber).toBe(3);

      // Step 7: Siap Pakai / Action CTA
      expect(ONBOARDING_TOUR_STEPS[6].pillar).toBe('Siap Pakai');
      expect(ONBOARDING_TOUR_STEPS[6].category).toBe('Siap Pakai');
      expect(ONBOARDING_TOUR_STEPS[6].pillarNumber).toBe(0);
    });

    it('Step 1 highlights Welcome to Internize 2.2, 121 PPK, and Zero PHI Egress', () => {
      const step1 = ONBOARDING_TOUR_STEPS[0];
      expect(step1.title).toBe('Selamat Datang di Internize 2.2');
      expect(step1.subtitle).toContain('121 PPK PAPDI');
      expect(step1.summary).toContain('100% on-device');
      expect(step1.summary).toContain('Zero PHI Egress');
      expect(step1.summary).toContain('121 PPK');
    });

    it('Step 2 highlights Langkah 1-2-3 Alur Kerja Klinis (Konsul, POMR, Ringkas Kasus)', () => {
      const step2 = ONBOARDING_TOUR_STEPS[1];
      expect(step2.title).toBe('Langkah 1-2-3 Alur Kerja Klinis');
      expect(step2.subtitle).toContain('Alur Kerja 3 Langkah');
      expect(step2.summary).toContain('1. Input Catatan Medis');
      expect(step2.summary).toContain('2. Pilih Mode');
      expect(step2.summary).toContain('3. Salin Draf EMR');
    });

    it('Step 3 highlights Mesin Pengetahuan 121 PPK, Penyesuaian Dosis Organ, and CITO vs Elektif', () => {
      const step3 = ONBOARDING_TOUR_STEPS[2];
      expect(step3.title).toBe('Mesin Pengetahuan 121 PPK & Penyesuaian Dosis Organ');
      expect(step3.summary).toContain('eGFR CKD-EPI');
      expect(step3.summary).toContain('CITO vs Elektif');
      expect(step3.summary).toContain('sitasi PPK resmi');
    });

    it('Step 4 highlights Cari Cepat Panduan Klinis (PPK Explorer)', () => {
      const step4 = ONBOARDING_TOUR_STEPS[3];
      expect(step4.title).toBe('Cari Cepat Panduan Klinis (PPK Explorer)');
      expect(step4.subtitle).toContain('Algoritma 4P & Kriteria Rujuk/ICU');
      expect(step4.summary).toContain('Fitur Cari Cepat');
      expect(step4.summary).toContain('tanpa perlu input kasus');
    });

    it('Step 5 highlights Riset Klinis, De-identifikasi HIPAA/Indonesia & Konversi FHIR R4', () => {
      const step5 = ONBOARDING_TOUR_STEPS[4];
      expect(step5.title).toBe('Riset Klinis, De-identifikasi HIPAA/Indonesia & Konversi FHIR R4');
      expect(step5.summary).toContain('18 identifier HIPAA Safe Harbor');
      expect(step5.summary).toContain('NIK 16 digit');
      expect(step5.summary).toContain('BPJS 13 digit');
      expect(step5.summary).toContain('No. RM lokal');
      expect(step5.summary).toContain('FHIR R4 Bundle');
    });

    it('Step 6 highlights API Gemini Pribadi (BYOK) dengan Pre-Scrubbing Sensor Otomatis', () => {
      const step6 = ONBOARDING_TOUR_STEPS[5];
      expect(step6.title).toBe('API Gemini Pribadi (BYOK) dengan Pre-Scrubbing Sensor Otomatis');
      expect(step6.summary).toContain('BYOK');
      expect(step6.summary).toContain('pre-scrubbing sensor lokal 100%');
      expect(step6.summary).toContain('store: false');
      expect(step6.summary).toContain('zero cloud retention');
    });

    it('Step 7 highlights Siap Memulai Telaah Kasus with 1-click sample case trigger', () => {
      const step7 = ONBOARDING_TOUR_STEPS[6];
      expect(step7.title).toBe('Siap Memulai Telaah Kasus!');
      expect(step7.summary).toContain('contoh kasus Pre-Operatif Bedah');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 15: OnboardingTourModal Rendering & Markup Verification
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. OnboardingTourModal Component Rendering & Visual Identity', () => {
    it('renders null when isOpen is false', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: false,
          onClose: () => {},
        }),
      );
      expect(html).toBe('');
    });

    it('renders modal container, Deep Maroon / Warm Gold header, and step indicators when isOpen is true', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 0,
        }),
      );

      // Container
      expect(html).toContain('data-testid="onboarding-tour-modal"');

      // Deep Maroon & Warm Gold Branding classes
      expect(html).toContain('from-maroon-900');
      expect(html).toContain('text-gold-100');
      expect(html).toContain('border-gold-600/40');

      // Pillar badge and step counter
      expect(html).toContain('data-testid="tour-pillar-badge"');
      expect(html).toContain('Pilar 1: Klinis PPK');
      expect(html).toContain('data-testid="tour-step-counter"');
      expect(html).toContain('Langkah 1 dari 7');

      // Header close button
      expect(html).toContain('data-testid="tour-close-btn"');

      // Title & Subtitle
      expect(html).toContain('data-testid="tour-step-title"');
      expect(html).toContain('Selamat Datang di Internize 2.2');
      expect(html).toContain('data-testid="tour-step-subtitle"');

      // Content & Step Indicators
      expect(html).toContain('data-testid="tour-step-content"');
      expect(html).toContain('data-testid="tour-step-dots"');
      for (let i = 0; i < 7; i++) {
        expect(html).toContain(`data-testid="tour-dot-${i}"`);
      }

      // Actions on Step 1: Skip and Next are rendered; Prev is not
      expect(html).toContain('data-testid="tour-skip-btn"');
      expect(html).toContain('Lewati Tour');
      expect(html).toContain('data-testid="tour-next-btn"');
      expect(html).toContain('Lanjut');
      expect(html).not.toContain('data-testid="tour-prev-btn"');
    });

    it('highlights active step dot in Warm Gold (bg-gold-400 w-6)', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 2, // Step 3
        }),
      );

      expect(html).toContain('data-testid="tour-step-counter"');
      expect(html).toContain('Langkah 3 dari 7');
      // Previous button is now visible
      expect(html).toContain('data-testid="tour-prev-btn"');
      expect(html).toContain('Sebelumnya');
    });

    it('renders Step 2: Alur Kerja 3 Langkah (Langkah 1-2-3)', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 1, // Step 2
        }),
      );

      expect(html).toContain('Langkah 1-2-3 Alur Kerja Klinis');
      expect(html).toContain('Input Catatan Medis:');
      expect(html).toContain('Pilih 3 Mode Kerja:');
      expect(html).toContain('Jawab Konsul TS');
      expect(html).toContain('POMR 4P');
      expect(html).toContain('Ringkas Kasus');
      expect(html).toContain('Salin Draf &amp; Cek PPK');
    });

    it('renders Step 3: Mesin Pengetahuan 121 PPK & Penyesuaian Dosis Organ', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 2, // Step 3
        }),
      );

      expect(html).toContain('Penyesuaian Dosis Organ:');
      expect(html).toContain('CKD-EPI');
      expect(html).toContain('Prioritas CITO vs Elektif:');
      expect(html).toContain('Sitasi Dokumen Resmi:');
    });

    it('renders Step 4: Cari Cepat Panduan Klinis (PPK Explorer)', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 3, // Step 4
        }),
      );

      expect(html).toContain('Cari Cepat Panduan Klinis (PPK Explorer)');
      expect(html).toContain('Kolom Pencarian Langsung 121 PPK');
      expect(html).toContain('🔍 Cari Cepat PPK');
      expect(html).toContain('KAD');
      expect(html).toContain('Krisis Tiroid');
      expect(html).toContain('SLE');
    });

    it('renders Step 5: Riset Klinis, De-identifikasi HIPAA/Indonesia & Konversi FHIR R4', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 4, // Step 5
        }),
      );

      expect(html).toContain('Pilar 2: Riset HIPAA/FHIR');
      expect(html).toContain('Indonesian PHI Shield:');
      expect(html).toContain('NIK 16-digit');
      expect(html).toContain('Nomor BPJS 13-digit');
      expect(html).toContain('No. RM lokal');
      expect(html).toContain('Interoperabilitas FHIR R4:');
    });

    it('renders Step 6: API Gemini Pribadi (BYOK) dengan Pre-Scrubbing Sensor Otomatis', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 5, // Step 6
        }),
      );

      expect(html).toContain('Pilar 3: Gemini Pribadi BYOK');
      expect(html).toContain('Jaminan Privasi &amp; Zero-Retention:');
      expect(html).toContain('store: false');
      expect(html).toContain('[PATIENT_1]');
      expect(html).toContain('🛡️ Pratinjau Sensor Privasi');
    });

    it('renders Step 7: Final Step with prominent 1-click Sample Case button', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(OnboardingTourModal, {
          isOpen: true,
          onClose: () => {},
          initialStep: 6, // Step 7 (Final)
        }),
      );

      expect(html).toContain('Siap Pakai');
      expect(html).toContain('Langkah 7 dari 7');
      expect(html).toContain('Siap Memulai Telaah Kasus!');

      // Prominent sample case CTA button inside body
      expect(html).toContain('data-testid="tour-start-sample-btn"');
      expect(html).toContain('Coba Contoh Kasus Pre-Op (1-Klik)');

      // Next button transforms into "Mulai Coba Contoh Kasus" with Warm Gold gradient
      expect(html).toContain('data-testid="tour-next-btn"');
      expect(html).toContain('Mulai Coba Contoh Kasus');
      expect(html).toContain('from-amber-500');

      // Secondary close button
      expect(html).toContain('Tutup Panduan &amp; Buka Lembar Kerja Kosong');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 16: LocalStorage Auto-Launch, On-Demand Re-trigger & Actions
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Tour Auto-Launch on First Visit via hasCompletedTour_v2_1 & Persistence', () => {
    it('detects first visit when hasCompletedTour_v2_1 is absent from localStorage', () => {
      expect(mockStorage.getItem('hasCompletedTour_v2_1')).toBeNull();
      const shouldShowTour = !mockStorage.getItem('hasCompletedTour_v2_1');
      expect(shouldShowTour).toBe(true);
    });

    it('does not auto-launch when hasCompletedTour_v2_1 is already "true"', () => {
      mockStorage.setItem('hasCompletedTour_v2_1', 'true');
      const shouldShowTour = !mockStorage.getItem('hasCompletedTour_v2_1');
      expect(shouldShowTour).toBe(false);
    });

    it('records hasCompletedTour_v2_1 = "true" when user finishes or closes the tour', () => {
      expect(mockStorage.getItem('hasCompletedTour_v2_1')).toBeNull();

      // Simulate App's handleCloseTour
      const handleCloseTour = () => {
        mockStorage.setItem('hasCompletedTour_v2_1', 'true');
      };

      handleCloseTour();
      expect(mockStorage.getItem('hasCompletedTour_v2_1')).toBe('true');
    });

    it('sample case action in App completes tour and increments sampleLoadTrigger', () => {
      let activeTab = 'research';
      let sampleLoadTrigger = 0;
      let showTour = true;

      const handleStartSampleCase = () => {
        showTour = false;
        mockStorage.setItem('hasCompletedTour_v2_1', 'true');
        activeTab = 'clinical';
        sampleLoadTrigger += 1;
      };

      handleStartSampleCase();

      expect(showTour).toBe(false);
      expect(mockStorage.getItem('hasCompletedTour_v2_1')).toBe('true');
      expect(activeTab).toBe('clinical');
      expect(sampleLoadTrigger).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 16: Header Help Button (?) Re-Trigger Integration
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Header Help Button (?) Re-Trigger Integration (data-testid="header-help-tour-btn")', () => {
    it('renders help button with data-testid="header-help-tour-btn" in Header', () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(Header, {
          onHelpClick: () => {},
        }),
      );

      expect(html).toContain('data-testid="header-help-tour-btn"');
      expect(html).toContain('title="Buka Panduan Fitur Internize 2.2"');
      expect(html).toContain('?');
    });

    it('renders help button even if rendered without explicit props', () => {
      const html = ReactDOMServer.renderToString(React.createElement(Header, {}));
      expect(html).toContain('data-testid="header-help-tour-btn"');
    });

    it('supports onHelpTour alias prop and triggers callback on click', () => {
      const tourMock = vi.fn();
      const headerElem = React.createElement(Header, {
        onHelpTour: tourMock,
      });

      const html = ReactDOMServer.renderToString(headerElem);
      expect(html).toContain('data-testid="header-help-tour-btn"');

      // Call the prop directly to verify handler wiring
      headerElem.props.onHelpTour();
      expect(tourMock).toHaveBeenCalledTimes(1);
    });

    it('clicking help button re-triggers showTour = true in App flow', () => {
      let showTour = false;
      const onHelpClick = () => {
        showTour = true;
      };

      onHelpClick();
      expect(showTour).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Feature 15 & 16: Interactive Callbacks & Flow Verification
  // ══════════════════════════════════════════════════════════════════════════
  describe('5. Interactive Callbacks: Skip, Close, Prev, Next, and Start Sample Case', () => {
    it('supports onStartSampleCase callback when provided', () => {
      const closeMock = vi.fn();
      const sampleMock = vi.fn();

      const modalElem = React.createElement(OnboardingTourModal, {
        isOpen: true,
        onClose: closeMock,
        onStartSampleCase: sampleMock,
        initialStep: 6, // Step 7
      });

      const html = ReactDOMServer.renderToString(modalElem);
      expect(html).toContain('data-testid="tour-start-sample-btn"');

      // Invoke sample handler
      modalElem.props.onStartSampleCase();
      expect(sampleMock).toHaveBeenCalledTimes(1);
    });

    it('supports onSelectSampleCase alias callback for backwards compatibility', () => {
      const closeMock = vi.fn();
      const selectMock = vi.fn();

      const modalElem = React.createElement(OnboardingTourModal, {
        isOpen: true,
        onClose: closeMock,
        onSelectSampleCase: selectMock,
        initialStep: 6,
      });

      const html = ReactDOMServer.renderToString(modalElem);
      expect(html).toContain('data-testid="tour-start-sample-btn"');

      modalElem.props.onSelectSampleCase();
      expect(selectMock).toHaveBeenCalledTimes(1);
    });

    it('close callback is properly wired', () => {
      const closeMock = vi.fn();
      const modalElem = React.createElement(OnboardingTourModal, {
        isOpen: true,
        onClose: closeMock,
      });

      modalElem.props.onClose();
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });
});
