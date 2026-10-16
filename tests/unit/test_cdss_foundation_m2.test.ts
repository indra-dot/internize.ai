import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CDSS_CALCULATORS_DB,
  CDSS_SUITES,
} from '../../src/services/clinical/cdss/cdssRegistry';
import {
  bunToMmol,
  bunToUreum,
  calculateBmi,
  calculateBsa,
  calculateCkdEpi2021,
  calculateCockcroftGaultCrCl,
  calculateDevineIbw,
  calculateDosingWeight,
  cholesterolMgToMmol,
  cholesterolMmolToMg,
  detectRenalLabType,
  ft4NgDlToPmolL,
  ft4PmolLToNgDl,
  glucoseMgToMmol,
  glucoseMmolToMg,
  RSUP_NGOERAH_LFT_NORMS,
  triglycerideMgToMmol,
  triglycerideMmolToMg,
  ureumRsToMmol,
  ureumToBun,
} from '../../src/services/clinical/cdss/unitConverters';
import {
  SAMPLE_COMORBID_WARD,
  SpPdWorkflowPanel,
} from '../../src/features/clinical/SpPdWorkflowPanel';

describe('Milestone 2: CDSS Foundation, Smart Unit Converters & Zero-Fake-Fallbacks', () => {
  // ── 1. Indonesian Hospital Lab Unit Converters ─────────────────────────────
  describe('Indonesian Hospital Lab Unit Converters (Ureum RS vs BUN vs mmol/L)', () => {
    it('converts Serum Ureum (mg/dL) to BUN (mg/dL) with factor 2.14', () => {
      // 42.8 mg/dL Ureum / 2.14 = 20.0 mg/dL BUN
      expect(ureumToBun(42.8)).toBe(20.0);
      expect(ureumToBun(0)).toBe(0);
    });

    it('converts BUN (mg/dL) to Serum Ureum (mg/dL) with factor 2.14', () => {
      // 20 mg/dL BUN * 2.14 = 42.8 mg/dL Ureum
      expect(bunToUreum(20.0)).toBe(42.8);
      expect(bunToUreum(0)).toBe(0);
    });

    it('converts Serum Ureum RS (mg/dL) to Urea (mmol/L) with factor 6.006', () => {
      // 60.06 mg/dL Ureum / 6.006 = 10.0 mmol/L
      expect(ureumRsToMmol(60.06)).toBe(10.0);
      expect(ureumRsToMmol(0)).toBe(0);
    });

    it('converts BUN (mg/dL) to Urea (mmol/L) with factor 2.801', () => {
      // 28.01 mg/dL BUN / 2.801 = 10.0 mmol/L
      expect(bunToMmol(28.01)).toBe(10.0);
      expect(bunToMmol(0)).toBe(0);
    });

    it('auto-detects Ureum vs BUN from raw clinical text', () => {
      expect(detectRenalLabType('Lab RS: Ureum 65 mg/dL, Kreatinin 1.8 mg/dL')).toBe('UREUM');
      expect(detectRenalLabType('Hasil Lab: BUN 28 mg/dL, SCr 1.4 mg/dL')).toBe('BUN');
      expect(detectRenalLabType('Pemeriksaan Darah Lengkap tanpa fungsi ginjal')).toBe('UNKNOWN');
    });

    it('converts Glucose, Cholesterol, Triglycerides, and FT4 accurately', () => {
      expect(glucoseMgToMmol(180)).toBe(10.0);
      expect(glucoseMmolToMg(10.0)).toBe(180.0);

      expect(cholesterolMgToMmol(193.35)).toBe(5.0);
      expect(cholesterolMmolToMg(5.0)).toBe(193.4);

      expect(triglycerideMgToMmol(177.14)).toBe(2.0);
      expect(triglycerideMmolToMg(2.0)).toBe(177.1);

      expect(ft4NgDlToPmolL(1.0)).toBe(12.87);
      expect(ft4PmolLToNgDl(12.87)).toBe(1.0);
    });

    it('provides RSUP Prof. Ngoerah reference norms for LFT and proteins', () => {
      expect(RSUP_NGOERAH_LFT_NORMS.totalBilirubin.max).toBe(1.2);
      expect(RSUP_NGOERAH_LFT_NORMS.astSgot.max).toBe(34);
      expect(RSUP_NGOERAH_LFT_NORMS.altSgpt.max).toBe(55);
      expect(RSUP_NGOERAH_LFT_NORMS.albumin.min).toBe(3.4);
    });
  });

  // ── 2. Anthropometry, Dosing Weight, and BSA Formulas ──────────────────────
  describe('Anthropometry, Dosing Weight, and BSA Equations', () => {
    it('calculates Devine IBW correctly for male and female', () => {
      // Male 170 cm (66.93 in): 50 + 2.3 * 6.93 = 65.9 kg
      const maleIbw = calculateDevineIbw(170, 'male');
      expect(maleIbw).toBeGreaterThanOrEqual(65.5);
      expect(maleIbw).toBeLessThanOrEqual(66.5);

      // Female 160 cm (62.99 in): 45.5 + 2.3 * 2.99 = 52.4 kg
      const femaleIbw = calculateDevineIbw(160, 'female');
      expect(femaleIbw).toBeGreaterThanOrEqual(52.0);
      expect(femaleIbw).toBeLessThanOrEqual(52.8);
    });

    it('calculates BMI correctly', () => {
      // 70 kg, 170 cm -> 70 / (1.7^2) = 24.2
      expect(calculateBmi(70, 170)).toBe(24.2);
    });

    it('selects proper Dosing Weight (TBW vs IBW vs ABW) based on obesity', () => {
      // Underweight / actual < IBW -> returns TBW
      const under = calculateDosingWeight(50, 175, 'male');
      expect(under.type).toBe('TBW');
      expect(under.dosingWeight).toBe(50);

      // Obese BMI >= 30 -> returns ABW (IBW + 0.4 * (TBW - IBW))
      const obese = calculateDosingWeight(100, 165, 'male');
      expect(obese.type).toBe('ABW');
      expect(obese.dosingWeight).toBeLessThan(100);
      expect(obese.dosingWeight).toBeGreaterThan(obese.ibw);

      // Normal non-obese -> returns IBW
      const normal = calculateDosingWeight(68, 170, 'male');
      expect(normal.type).toBe('IBW');
    });

    it('calculates 4-formula BSA (Mosteller, Du Bois, Boyd, Gehan)', () => {
      const bsa = calculateBsa(170, 70);
      // Average adult BSA around 1.80 - 1.85 m2
      expect(bsa.mosteller).toBeGreaterThan(1.75);
      expect(bsa.mosteller).toBeLessThan(1.90);
      expect(bsa.duBois).toBeGreaterThan(1.75);
      expect(bsa.boyd).toBeGreaterThan(1.75);
      expect(bsa.gehanGeorge).toBeGreaterThan(1.75);
    });

    it('calculates Cockcroft-Gault CrCl and CKD-EPI 2021 race-free eGFR', () => {
      // Male 60yo, 70kg, SCr 1.0 -> ((140-60)*70)/(72*1) = 77.8 mL/min
      const crcl = calculateCockcroftGaultCrCl(60, 70, 1.0, 'male');
      expect(crcl).toBe(77.8);

      const ckd = calculateCkdEpi2021(60, 1.0, 'male');
      expect(ckd.egfr).toBeGreaterThan(80);
      expect(ckd.stage).toBe('G2');
    });
  });

  // ── 3. Universal CDSS Registry ────────────────────────────────────────────
  describe('Universal CDSS Registry Structure & Suite Coverage', () => {
    it('contains all 8 suites from drguswib ecosystem', () => {
      expect(CDSS_SUITES.HOM.name).toBe('AdjustrHOM');
      expect(CDSS_SUITES.GEH.name).toBe('adjustr-GEH v2.2');
      expect(CDSS_SUITES.CALC_MED.name).toBe('Calc-Med Pro');
      expect(CDSS_SUITES.FLUID.name).toBe('adjustr-fluid Pro');
      expect(CDSS_SUITES.ADJUSTR_IO.name).toBe('ADJUSTR.IO');
      expect(CDSS_SUITES.EMD.name).toBe('adjustrEMD Pro');
      expect(CDSS_SUITES.RHEUMA.name).toBe('RheumaTools');
      expect(CDSS_SUITES.PREOP.name).toBe('Pre-Op & Geriatri');
    });

    it('contains core diagnostic & emergency calculators with guardrails', () => {
      const plasmic = CDSS_CALCULATORS_DB.find((c) => c.id === 'hom-plasmic');
      expect(plasmic).toBeDefined();
      expect(plasmic?.guardrails?.[0]).toContain('DILARANG transfusi trombosit');

      const dka = CDSS_CALCULATORS_DB.find((c) => c.id === 'emd-dka-tracker');
      expect(dka).toBeDefined();
      expect(dka?.guardrails?.[0]).toContain('K+ < 3.5');

      const myxedema = CDSS_CALCULATORS_DB.find((c) => c.id === 'emd-myxedema');
      expect(myxedema).toBeDefined();
      expect(myxedema?.guardrails?.[0]).toContain('Hidrokortison');
    });
  });

  // ── 4. Zero Fake Fallbacks Verification in UI ─────────────────────────────
  describe('Zero Fake Fallbacks (No arbitrary 33 / 3.5 / 15 numbers)', () => {
    it('renders "Data Kurang" badge without fake fallback numbers when data is absent', () => {
      // In text without age/SpO2/labs, ARISCAT/Caprini/IMPROVE data is incomplete
      const minimalText =
        'Konsul TS Bedah: Rencana tindakan operasi laparotomi. Mohon evaluasi toleransi operasi.';
      const html = ReactDOMServer.renderToString(
        React.createElement(SpPdWorkflowPanel, {
          inputText: minimalText,
        }),
      );

      // Should NOT contain arbitrary fake fallback text like "33 points" for ARISCAT or "15 points" for Caprini
      expect(html).not.toContain('33 points');
      expect(html).not.toContain('15 points');

      // Should contain honest "Data Kurang" indicators and warnings
      expect(html).toContain('Data Kurang');
      expect(html).toContain('Data Kurang (Lengkapi di Form PPK/CDSS)');
      expect(html).toContain('Stratifikasi Risiko Tindakan Operatif');
    });

    it('calculates genuine scores when patient data is present without reverting to static defaults', () => {
      // In SAMPLE_COMORBID_WARD (Age 58, SpO2 97%, Hb 10.8, Cr 1.9, Plt 210k):
      // ARISCAT is genuinely 3 points (Age 51-80 = 3), Caprini is 1 point (Age 58 = 1)
      const html = ReactDOMServer.renderToString(
        React.createElement(SpPdWorkflowPanel, {
          inputText: SAMPLE_COMORBID_WARD,
        }),
      );

      // Must NOT contain old arbitrary defaults 33 points or 15 points
      expect(html).not.toContain('33 points');
      expect(html).not.toContain('15 points');

      // Must contain calculated genuine scores
      expect(html).toContain('3 points');
      expect(html).toContain('1 points');
    });
  });
});
