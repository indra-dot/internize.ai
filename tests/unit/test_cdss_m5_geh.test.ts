/**
 * internize.ai — Milestone 5 CDSS Unit Tests
 * Testing adjustr-GEH v2.2 Engine (Gastroentero-Hepatologi)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGbs,
  calculateOakland,
  calculateCtp,
  calculateMeldTrio,
  calculateSaag,
  calculateRFactor,
  calculateDeRitis,
  calculateFib4AndApri,
  calculateMaddrey,
  calculateBisap,
  calculateTg18,
} from '../../src/services/clinical/cdss/adjustrGehEngine';

describe('Milestone 5 — adjustr-GEH: GI Bleeding Risk Stratification', () => {
  it('identifies Low Risk safe outpatient when GBS = 0', () => {
    const resLow = calculateGbs({
      bunValue: 5.0, // normal < 6.5 mmol/L
      bunUnit: 'mmol',
      hemoglobin: 14.5,
      gender: 'male',
      systolicBp: 125,
      heartRate: 75,
      hasMelena: false,
      hasSyncope: false,
      hasHepaticDisease: false,
      hasHeartFailure: false,
    });

    expect(resLow.totalScore).toBe(0);
    expect(resLow.riskCategory).toBe('Low Risk (Safe Outpatient)');
  });

  it('identifies High Risk UGIB when GBS >= 6 and triggers CITO endoscopy alert', () => {
    // Severe anemia Hb 8.5 (6), BUN 12 mmol (4), SBP 95 (2), HR 105 (1), Melena (1) = 14 pts
    const resHigh = calculateGbs({
      bunValue: 12.0,
      bunUnit: 'mmol',
      hemoglobin: 8.5,
      gender: 'male',
      systolicBp: 95,
      heartRate: 105,
      hasMelena: true,
      hasSyncope: false,
      hasHepaticDisease: false,
      hasHeartFailure: false,
    });

    expect(resHigh.totalScore).toBeGreaterThanOrEqual(6);
    expect(resHigh.riskCategory).toBe('High Risk (Urgent Endoscopy / ICU)');
    expect(resHigh.alerts.some((a) => a.title.includes('GBS Tinggi'))).toBe(true);
    expect(resHigh.cpptFormat).toContain('GLASGOW-BLATCHFORD SCORE');
  });

  it('evaluates Oakland score for lower GI bleeding safe discharge threshold', () => {
    // Young female, normal vitals, Hb 14.0 -> Score <= 8
    const resSafe = calculateOakland({
      age: 32,
      gender: 'female',
      priorLgibAdmission: false,
      dreBloodPresent: false,
      heartRate: 78,
      systolicBp: 125,
      hemoglobin: 14.0,
    });

    expect(resSafe.isSafeDischarge).toBe(true);
    expect(resSafe.interpretation).toContain('Aman Rawat Jalan');

    // Severe bleed elderly -> Score > 8
    const resAdmit = calculateOakland({
      age: 75,
      gender: 'male',
      priorLgibAdmission: true,
      dreBloodPresent: true,
      heartRate: 115,
      systolicBp: 85,
      hemoglobin: 8.0,
    });
    expect(resAdmit.isSafeDischarge).toBe(false);
  });
});

describe('Milestone 5 — adjustr-GEH: Cirrhosis, MELD Trio & Ascites', () => {
  it('calculates Child-Turcotte-Pugh (CTP) score and classes correctly', () => {
    // Grade 3 CTP: HE 3, Ascites 3, Bili 4.0 (3), Alb 2.2 (3), INR 2.5 (3) = 15 pts (Class C)
    const resCtpC = calculateCtp({
      hepaticEncephalopathyGrade: 3,
      ascitesGrade: 3,
      totalBilirubin: 4.0,
      serumAlbumin: 2.2,
      inr: 2.5,
    });

    expect(resCtpC.totalScore).toBe(15);
    expect(resCtpC.ctpClass).toBe('Class C');
    expect(resCtpC.compensationStatus).toContain('Decompensated');

    // Class A: 1+1+1+1+1 = 5
    const resCtpA = calculateCtp({
      hepaticEncephalopathyGrade: 1,
      ascitesGrade: 1,
      totalBilirubin: 1.2,
      serumAlbumin: 4.0,
      inr: 1.1,
    });
    expect(resCtpA.totalScore).toBe(5);
    expect(resCtpA.ctpClass).toBe('Class A');
  });

  it('calculates MELD Trio (Original, MELD-Na, MELD 3.0) with female sex weight', () => {
    const resMale = calculateMeldTrio({
      totalBilirubinMgDl: 2.5,
      serumCreatinineMgDl: 1.8,
      inr: 1.9,
      serumSodiumMeqL: 130,
      serumAlbuminGDl: 2.8,
      gender: 'male',
      hasDialysisInPastWeek: false,
    });

    const resFemale = calculateMeldTrio({
      totalBilirubinMgDl: 2.5,
      serumCreatinineMgDl: 1.8,
      inr: 1.9,
      serumSodiumMeqL: 130,
      serumAlbuminGDl: 2.8,
      gender: 'female',
      hasDialysisInPastWeek: false,
    });

    expect(resMale.meldOriginal).toBeGreaterThan(6);
    expect(resMale.meldNa).toBeGreaterThan(resMale.meldOriginal); // hyponatremia increases MELD-Na
    // MELD 3.0 gives female sex +1.33 adjustment
    expect(resFemale.meld30).toBeGreaterThanOrEqual(resMale.meld30);
  });

  it('evaluates SAAG and identifies SBP when PMN >= 250/uL', () => {
    // Serum Alb 3.0, Ascites Alb 1.2 -> SAAG = 1.8 (Portal HTN)
    // WBC 1000, PMN 60% -> PMN = 600/uL (SBP Diagnostic!)
    const res = calculateSaag({
      serumAlbuminGDl: 3.0,
      ascitesAlbuminGDl: 1.2,
      ascitesTotalProteinGDl: 1.5,
      ascitesWbcPerUl: 1000,
      ascitesPmnPercent: 60,
    });

    expect(res.saag).toBe(1.8);
    expect(res.portalHypertension).toBe(true);
    expect(res.absolutePmnPerUl).toBe(600);
    expect(res.isSbpDiagnostic).toBe(true);
    expect(res.sbpRecommendation).toContain('Cefotaxime');
    expect(res.sbpRecommendation).toContain('Albumin');
    expect(res.alerts.some((a) => a.title.includes('SPONTANEOUS BACTERIAL PERITONITIS'))).toBe(true);
  });
});

describe('Milestone 5 — adjustr-GEH: DILI, Fibrosis & Pancreatobiliary', () => {
  it('calculates R-Factor for DILI pattern and detects Hy Law with mortality warning', () => {
    // ALT 600 (ULN 40 -> 15x), ALP 100 (ULN 100 -> 1x), Total Bili 4.5 mg/dL
    // R = 15 / 1 = 15 (Hepatocellular)
    // Hy's Law: ALT >= 3x ULN and Bili >= 2x ULN and ALP < 2x ULN -> Positive!
    const resDili = calculateRFactor({
      altValue: 600,
      altUln: 40,
      alpValue: 100,
      alpUln: 100,
      totalBilirubinMgDl: 4.5,
    });

    expect(resDili.pattern).toBe('Hepatocellular');
    expect(resDili.rRatio).toBe(15);
    expect(resDili.isHysLawPositive).toBe(true);
    expect(resDili.alerts.some((a) => a.title.includes("Hy's Law"))).toBe(true);
  });

  it('calculates De Ritis ratio and distinguishes ALD from viral/NAFLD', () => {
    // AST 240, ALT 100 -> Ratio 2.4 (> 2.0: ALD)
    const resAld = calculateDeRitis(240, 100);
    expect(resAld.ratio).toBe(2.4);
    expect(resAld.interpretation).toContain('Alcoholic Liver Disease');

    // AST 40, ALT 80 -> Ratio 0.5 (< 1.0: NAFLD / viral)
    const resNafld = calculateDeRitis(40, 80);
    expect(resNafld.ratio).toBe(0.5);
    expect(resNafld.interpretation).toContain('NAFLD');
  });

  it('calculates non-invasive fibrosis FIB-4 and APRI', () => {
    // Age 55, AST 70, ALT 60, Plt 110,000 (110)
    // FIB-4 = (55 * 70) / (110 * sqrt(60)) = 3850 / (110 * 7.746) = 3850 / 852 = 4.51 (High Risk > 2.67)
    const res = calculateFib4AndApri({
      age: 55,
      astValue: 70,
      altValue: 60,
      plateletsPerUl: 110000,
    });

    expect(res.fib4).toBeGreaterThan(2.67);
    expect(res.fib4Risk).toBe('High Fibrosis / Cirrhosis Risk');
  });

  it('calculates Maddrey Discriminant Function for alcoholic hepatitis and steroid indication', () => {
    // PT patient 22s, control 12s, Bili 8.0 mg/dL -> dF = 4.6 * (22 - 12) + 8 = 46 + 8 = 54 (>= 32: Severe)
    const resSevere = calculateMaddrey(22, 12, 8.0);
    expect(resSevere.discriminantFunction).toBe(54);
    expect(resSevere.isSevere).toBe(true);
    expect(resSevere.steroidIndication).toContain('Prednisolon 40 mg');
    expect(resSevere.alerts.some((a) => a.title.includes('Maddrey dF ≥ 32'))).toBe(true);
  });

  it('evaluates BISAP for acute pancreatitis and Tokyo Guidelines 2018 (TG18)', () => {
    // BISAP 4 criteria: BUN > 25, GCS < 15, SIRS, Pleural effusion = 4 pts
    const resBisap = calculateBisap({
      bunAbove25MgDlOrMmol: true,
      impairedMentalStatus: true,
      sirsCriteriaCountAtLeast2: true,
      ageAbove60: false,
      pleuralEffusionPresent: true,
    });

    expect(resBisap.totalScore).toBe(4);
    expect(resBisap.riskCategory).toBe('High In-Hospital Mortality Risk');
    expect(resBisap.alerts.some((a) => a.title.includes('BISAP ≥ 3'))).toBe(true);

    // TG18 Severe Cholangitis with organ failure -> Grade III
    const resTg18 = calculateTg18({
      type: 'cholangitis',
      hasLocalSigns: true,
      hasSystemicSigns: true,
      hasImagingConfirmation: true,
      hasOrganDysfunction: true,
    });

    expect(resTg18.severityGrade).toBe('Grade III (Severe)');
    expect(resTg18.recommendation).toContain('CITO Dekompresi Bilier');
  });
});
