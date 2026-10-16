/**
 * internize.ai — Milestone 4 CDSS Unit Tests
 * Testing adjustrEMD Engine (Endokrin & Metabolik Emergency)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBwps,
  calculateMyxedemaScore,
  evaluateDkaStatus,
  calculateHypoglycemiaD40,
  calculateBasalBolusTdd,
  calculateMetabolicMarkers,
  calculateAscvd10Yr,
  calculateHbA1cToEag,
} from '../../src/services/clinical/cdss/adjustrEmdEngine';

describe('Milestone 4 — adjustrEMD: Burch-Wartofsky & Myxedema', () => {
  it('calculates Burch-Wartofsky score and identifies thyroid storm with multimodal protocol', () => {
    // 39.2 C (20), delirium (20), diarrhea (10), HR 135 (20), mild CHF (5), AF (10), precipitant (10) = 95 pts
    const resStorm = calculateBwps({
      tempCelsius: 39.2,
      cnsDysfunction: 'delirium_psychosis',
      giDysfunction: 'diarrhea_nausea_vomiting',
      heartRate: 135,
      congestiveHeartFailure: 'mild_pedal_edema',
      atrialFibrillation: true,
      precipitatingEventHistory: true,
    });

    expect(resStorm.totalScore).toBeGreaterThanOrEqual(45);
    expect(resStorm.interpretation).toBe('Highly suggestive of Thyroid Storm');
    expect(resStorm.regimenRecommendation).toContain('PTU');
    expect(resStorm.regimenRecommendation).toContain('Lugol');
    expect(resStorm.alerts.some((a) => a.title.includes('Badai Tiroid') || a.title.includes('Krisis Tiroid'))).toBe(true);
  });

  it('calculates Myxedema Coma score and enforces Hydrocortisone-before-Levothyroxine invariant', () => {
    const resMyx = calculateMyxedemaScore({
      tempScore: 20, // hypothermia < 32.2
      cnsScore: 20,  // stupor
      giScore: 15,   // ileus
      hrScore: 20,   // severe bradycardia
      bpScore: 20,   // shock
      naScore: 15,   // hyponatremia < 120
      hypoglycemia: true,
      hypoventilation: true,
    });

    expect(resMyx.totalScore).toBeGreaterThanOrEqual(60);
    expect(resMyx.interpretation).toBe('Diagnostik Koma Miksedema');
    // Mandatory invariant check
    const invariantAlert = resMyx.alerts.find((a) => a.title.includes('Hidrokortison Wajib Masuk SEBELUM'));
    expect(invariantAlert).toBeDefined();
    expect(invariantAlert?.severity).toBe('danger');
    expect(resMyx.cpptFormat).toContain('STEROID PERTAMA');
  });
});

describe('Milestone 4 — adjustrEMD: DKA Severity & ADA Resolution Tracker', () => {
  it('identifies Severe DKA and triggers Kalium hold-insulin guardrail when K < 3.5', () => {
    const resDka = evaluateDkaStatus({
      venousPh: 6.95,
      serumHco3: 6,
      bloodGlucose: 450,
      anionGap: 24,
      serumPotassium: 3.1, // Hypokalemia!
      mentalStatus: 'stupor_coma',
    });

    expect(resDka.severity).toBe('DKA Berat (Severe)');
    expect(resDka.isResolved).toBe(false);
    // Kalium guardrail
    const kAlert = resDka.alerts.find((a) => a.title.includes('TAHAN INSULIN'));
    expect(kAlert).toBeDefined();
    expect(kAlert?.severity).toBe('danger');
    expect(resDka.cpptFormat).toContain('TAHAN INSULIN');
  });

  it('confirms ADA resolution when blood glucose < 200 and acid-base criteria are met', () => {
    const resResolved = evaluateDkaStatus({
      venousPh: 7.35,
      serumHco3: 19,
      bloodGlucose: 160,
      anionGap: 10,
      serumPotassium: 4.2,
      mentalStatus: 'alert',
    });

    expect(resResolved.isResolved).toBe(true);
    expect(resResolved.resolutionStatus).toContain('Resolusi Tercapai');
    expect(resResolved.criteriaStatus.glucoseBelow200).toBe(true);
    expect(resResolved.criteriaStatus.hco3AtLeast18).toBe(true);
    expect(resResolved.criteriaStatus.phAbove730).toBe(true);
    expect(resResolved.criteriaStatus.anionGapNormal).toBe(true);
  });
});

describe('Milestone 4 — adjustrEMD: Hypoglycemia Rumus 30 & Basal-Bolus TDD', () => {
  it('calculates Rumus 30 and Perkeni flakons for hypoglycemia with aspiration alert', () => {
    // GDS 40 mg/dL unconscious -> 2 flakon Perkeni
    const resHypo = calculateHypoglycemiaD40(40, 100, true);
    expect(resHypo.perkeniFlakon).toBe(2);
    expect(resHypo.perkeniInstruction).toContain('Bolus D40% 50 cc');
    // Delta = 60 -> 60 / 30 = 2 flakons (~20g dextrose)
    expect(resHypo.rumus30Flakon).toBe(2);
    expect(resHypo.dextroseGrams).toBe(20);
    expect(resHypo.alerts.some((a) => a.title.includes('Risiko Aspirasi'))).toBe(true);
  });

  it('calculates Basal-Bolus TDD regimen correctly', () => {
    // 60 kg patient with 0.5 U/kg factor -> 30 U TDD
    const res = calculateBasalBolusTdd(60, 0.5);
    expect(res.totalDailyDoseUnits).toBe(30);
    expect(res.basalDailyUnits).toBe(15);
    expect(res.prandialPerMealUnits).toBe(5);
    expect(res.cpptFormat).toContain('Glargine');
  });
});

describe('Milestone 4 — adjustrEMD: Cardiometabolic & ASCVD', () => {
  it('calculates TyG Index, HOMA-IR, and enforces Friedewald TG > 400 guardrail', () => {
    // TyG: TG 200, FBG 100 -> ln(20000)/2 = 9.903/2 = 4.95
    // HOMA-IR: Insulin 15, FBG 100 -> 1500 / 405 = 3.70
    const resValid = calculateMetabolicMarkers({
      triglyceridesMgDl: 200,
      fastingGlucoseMgDl: 100,
      fastingInsulinUuMl: 15,
      totalCholesterolMgDl: 220,
      hdlMgDl: 40,
    });

    expect(resValid.tygIndex).toBeCloseTo(4.95, 1);
    expect(resValid.homaIr).toBeCloseTo(3.70, 1);
    // Friedewald: 220 - 40 - (200 / 5) = 140
    expect(resValid.friedewaldLdlMgDl).toBe(140);
    expect(resValid.isFriedewaldValid).toBe(true);

    // Severe Hypertriglyceridemia TG 480 mg/dL -> Friedewald invalid guardrail
    const resHighTg = calculateMetabolicMarkers({
      triglyceridesMgDl: 480,
      totalCholesterolMgDl: 250,
      hdlMgDl: 35,
    });
    expect(resHighTg.isFriedewaldValid).toBe(false);
    expect(resHighTg.friedewaldLdlMgDl).toBeUndefined();
    expect(resHighTg.alerts.some((a) => a.title.includes('Friedewald Tidak Valid'))).toBe(true);
  });

  it('calculates ASCVD 10-year risk and sets high-risk target for diabetic patient', () => {
    const res = calculateAscvd10Yr({
      age: 58,
      gender: 'male',
      systolicBp: 145,
      isHypertensionTreated: true,
      totalCholesterol: 230,
      hdlCholesterol: 38,
      hasDiabetes: true,
      isSmoker: false,
    });

    expect(res.riskCategory).toBe('High / Very High Risk');
    expect(res.targetLdlMgDl).toBe('< 55 - 70 mg/dL');
    expect(res.statinRecommendation).toContain('Statin Intensitas Tinggi');
  });

  it('converts HbA1c to estimated average glucose (eAG)', () => {
    // 7.0% -> 28.7 * 7 - 46.7 = 200.9 - 46.7 = 154 mg/dL
    const res = calculateHbA1cToEag(7.0);
    expect(res.eagMgDl).toBe(154);
    expect(res.eagMmolL).toBeCloseTo(8.5, 0);
  });
});
