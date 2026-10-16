/**
 * internize.ai — Milestone 3 CDSS Unit Tests
 * Testing ADJUSTR.IO (36 antimicrobials) and Calc-Med & adjustrFluid Engines.
 */

import { describe, it, expect } from 'vitest';
import {
  ANTIMICROBIAL_DATABASE,
  getAntimicrobialList,
  getAntimicrobialByKey,
  calculateRenalDosing,
} from '../../src/services/clinical/cdss/adjustrIoEngine';
import {
  calculateVasoactiveSyringePump,
  calculateBridgingInsulin,
  analyzeAbg,
  calculateHollidaySegar,
  calculateHyponatremiaAdrogue,
  calculateHypernatremiaFwd,
  calculatePotassiumManagement,
  calculateCorrectedCalcium,
  calculateMagnesiumRepletion,
  calculatePhosphateRepletion,
  calculateBunCrRatio,
  evaluateAeiouHdIndications,
} from '../../src/services/clinical/cdss/calcMedFluidEngine';

describe('Milestone 3 — ADJUSTR.IO Engine (36 Antimicrobials)', () => {
  it('contains exactly 36 curated antimicrobial drug profiles', () => {
    const list = getAntimicrobialList();
    expect(list.length).toBe(36);
    expect(Object.keys(ANTIMICROBIAL_DATABASE).length).toBe(36);

    const keys = list.map((d) => d.key);
    expect(keys).toContain('meropenem');
    expect(keys).toContain('vancomycin');
    expect(keys).toContain('piperacillin-tazobactam');
    expect(keys).toContain('cefepime');
    expect(keys).toContain('amikacin');
    expect(keys).toContain('fluconazole');
    expect(keys).toContain('acyclovir-iv');
  });

  it('calculates Meropenem renal dosing correctly across CrCl breakpoints', () => {
    // Normal CrCl >= 50
    const resNormal = calculateRenalDosing('meropenem', {
      age: 45,
      weightKg: 65,
      heightCm: 170,
      serumCreatinine: 0.9,
      gender: 'male',
    });
    expect(resNormal.crCl).toBeGreaterThanOrEqual(50);
    expect(resNormal.recommendedDose).toContain('1 g IV q8h');
    expect(resNormal.matchedAdjustmentLabel).toContain('CrCl ≥ 50');

    // Moderate CKD CrCl 35 mL/min
    const resMod = calculateRenalDosing('meropenem', {
      age: 70,
      weightKg: 60,
      heightCm: 165,
      serumCreatinine: 1.8,
      gender: 'male',
      customCrCl: 35,
    });
    expect(resMod.recommendedDose).toBe('1 g IV q12h');

    // Severe CKD CrCl 15 mL/min
    const resSev = calculateRenalDosing('meropenem', {
      age: 70,
      weightKg: 60,
      heightCm: 165,
      serumCreatinine: 3.5,
      gender: 'male',
      customCrCl: 15,
    });
    expect(resSev.recommendedDose).toBe('500 mg IV q12h');
    expect(resSev.alerts.some((a) => a.title.includes('Neurotoksisitas'))).toBe(true);

    // End-Stage CrCl < 10 mL/min
    const resEsrd = calculateRenalDosing('meropenem', {
      age: 70,
      weightKg: 60,
      heightCm: 165,
      serumCreatinine: 6.0,
      gender: 'male',
      customCrCl: 8,
    });
    expect(resEsrd.recommendedDose).toBe('500 mg IV q24h');
    expect(resEsrd.ihdRecommendation).toContain('post-HD');
    expect(resEsrd.crrtRecommendation).toBeDefined();
    expect(resEsrd.cpptFormat).toContain('[ADJUSTR.IO CDSS]');
  });

  it('triggers nephrotoxicity and loading dose alerts for Vancomycin', () => {
    const resVanco = calculateRenalDosing('vancomycin', {
      age: 65,
      weightKg: 70,
      heightCm: 168,
      serumCreatinine: 2.2,
      gender: 'male',
      customCrCl: 35,
    });

    expect(resVanco.loadingDoseRecommendation).toBeDefined();
    expect(resVanco.alerts.some((a) => a.title.includes('Loading Dose'))).toBe(true);
    expect(resVanco.alerts.some((a) => a.title.includes('Nefrotoksisitas'))).toBe(true);
  });
});

describe('Milestone 3 — Calc-Med Vasoactive Syringe Pump & Bridging Insulin', () => {
  it('calculates Norepinephrine syringe pump titration table correctly', () => {
    const res = calculateVasoactiveSyringePump({
      drugType: 'norepinephrine',
      patientWeightKg: 50,
      drugMg: 4,
      diluentVolumeMl: 50,
    });

    // conc = (4 * 1000) / 50 = 80 mcg/mL
    expect(res.concentrationMcgPerMl).toBe(80);
    // rate for 0.1 mcg/kg/min = (0.1 * 50 * 60) / 80 = 3.75 -> 3.8 mL/hr
    const row01 = res.doseTable.find((r) => r.dose === 0.1);
    expect(row01?.rateMlPerHr).toBe(3.8);

    // rate for 0.5 mcg/kg/min = (0.5 * 50 * 60) / 80 = 18.75 -> 18.8 mL/hr
    const row05 = res.doseTable.find((r) => r.dose === 0.5);
    expect(row05?.rateMlPerHr).toBe(18.8);
    expect(res.cpptFormat).toContain('TITRASI SYRINGE PUMP NOREPINEFRIN');
  });

  it('calculates 24-hour bridging insulin transition with 80% TDD rule', () => {
    // 24 hours of 2 IU/hr drip = 48 IU total
    const hourlyDrips = Array(24).fill(2);
    const res = calculateBridgingInsulin(hourlyDrips);

    expect(res.totalDrip24hUnits).toBe(48);
    // 80% of 48 = 38.4 IU
    expect(res.totalSubcutaneousTddUnits).toBe(38.4);
    // 50% basal = 19.2 IU
    expect(res.basalInsulinUnits).toBe(19.2);
    // 3 meals prandial = 19.2 / 3 = 6.4 IU
    expect(res.prandialPerMealUnits).toBe(6.4);
    expect(res.cpptFormat).toContain('BRIDGING INSULIN');
  });
});

describe('Milestone 3 — Arterial Blood Gas (ABG / BGA) Analyzer', () => {
  it('validates Henderson equation and identifies Pure AGMA with Winter compensation', () => {
    // pH 7.20, pCO2 25, HCO3 10, Na 140, Cl 100, Alb 4.0
    // Winter exp pCO2 = 1.5 * 10 + 8 = 23 +- 2 (range 21 - 25) -> Adequate
    // AG = 140 - (100 + 10) = 30 (AGMA)
    // delta AG = 30 - 12 = 18; delta HCO3 = 24 - 10 = 14; delta ratio = 18 / 14 = 1.29 (Pure AGMA)
    const res = analyzeAbg({
      ph: 7.2,
      pco2: 25,
      hco3: 10,
      na: 140,
      cl: 100,
      albumin: 4.0,
      pao2: 95,
      fio2: 21,
    });

    expect(res.isValidHenderson).toBe(true);
    expect(res.primaryDisorder).toBe('Asidosis Metabolik');
    expect(res.compensationStatus).toBe('Kompensasi Respiratorik Adekuat');
    expect(res.anionGapType).toBe('AGMA');
    expect(res.correctedAnionGap).toBe(30);
    expect(res.deltaRatio).toBeCloseTo(1.29, 1);
    expect(res.deltaRatioInterpretation).toContain('AGMA Murni');
  });

  it('triggers severe acidemia alert and calculates bicarbonate deficit when pH < 7.1', () => {
    const res = analyzeAbg({
      ph: 7.05,
      pco2: 20,
      hco3: 6,
      na: 135,
      cl: 98,
      albumin: 3.5,
      patientWeightKg: 60,
    });

    expect(res.bicarbonateDeficitMeq).toBeDefined();
    // deficit = 0.5 * 60 * (15 - 6) = 270 mEq
    expect(res.bicarbonateDeficitMeq).toBe(270);
    expect(res.alerts.some((a) => a.title.includes('Asidemia Ekstrem'))).toBe(true);
  });
});

describe('Milestone 3 — adjustrFluid & Electrolyte Protocols', () => {
  it('calculates Holliday-Segar fluid maintenance with fever adjustment', () => {
    // 60 kg patient: 10*100 + 10*50 + 40*20 = 1000 + 500 + 800 = 2300 mL/day
    const resNormal = calculateHollidaySegar(60, 37);
    expect(resNormal.dailyMl).toBe(2300);
    expect(resNormal.hourlyMl).toBeCloseTo(95.8, 1);

    // With 39 C fever (+2 deg C -> +24%)
    const resFever = calculateHollidaySegar(60, 39);
    expect(resFever.dailyMl).toBe(Math.round(2300 * 1.24));
  });

  it('calculates Adrogué-Madias hyponatremia and enforces ODS guardrail', () => {
    // 60 kg male, Na 115, target rise 8 mEq/L (safe)
    const resSafe = calculateHyponatremiaAdrogue({
      weightKg: 60,
      gender: 'male',
      serumNa: 115,
      targetRise24h: 8,
      infusateType: 'nacl_3_percent',
    });
    expect(resSafe.isDangerOds).toBe(false);
    expect(resSafe.totalVolumeMl).toBeGreaterThan(0);
    expect(resSafe.hourlyRateMl).toBeGreaterThan(0);

    // Unsafe target rise 12 mEq/L (> 10 mEq/L/24h ceiling)
    const resUnsafe = calculateHyponatremiaAdrogue({
      weightKg: 60,
      gender: 'male',
      serumNa: 115,
      targetRise24h: 12,
      infusateType: 'nacl_3_percent',
    });
    expect(resUnsafe.isDangerOds).toBe(true);
    expect(resUnsafe.alerts.some((a) => a.title.includes('Batas Aman ODS'))).toBe(true);
  });

  it('calculates hypernatremia free water deficit correctly', () => {
    // 60 kg male (TBW = 36L), Na 160, target 140
    // FWD = 36 * (160/140 - 1) = 36 * 0.1428 = 5.14 L
    const res = calculateHypernatremiaFwd({
      weightKg: 60,
      gender: 'male',
      serumNa: 160,
      targetNa: 140,
    });
    expect(res.freeWaterDeficitLiters).toBeCloseTo(5.14, 1);
    expect(res.recommendedHourlyRateD5Ml).toBeGreaterThan(100);
  });

  it('handles hypokalemia and severe hyperkalemia protocols', () => {
    const resHypo = calculatePotassiumManagement(2.2);
    expect(resHypo.severity).toBe('Severe Hypokalemia');
    expect(resHypo.estimatedDeficitMeq).toBe(300);
    expect(resHypo.alerts.some((a) => a.title.includes('Hipokalemia Berat'))).toBe(true);

    const resHyper = calculatePotassiumManagement(6.8);
    expect(resHyper.severity).toBe('Severe Hyperkalemia');
    expect(resHyper.protocolRecommendation).toContain('Kalsium Glukonas 10%');
    expect(resHyper.protocolRecommendation).toContain('D40%');
    expect(resHyper.alerts.some((a) => a.title.includes('Mengancam Jiwa'))).toBe(true);
  });

  it('calculates corrected calcium using Payne formula', () => {
    // Total Ca 7.2 mg/dL, Albumin 2.0 g/dL -> Corr Ca = 7.2 + 0.8*(4 - 2) = 8.8 (Normal)
    const res = calculateCorrectedCalcium(7.2, 2.0);
    expect(res.correctedCa).toBe(8.8);
    expect(res.interpretation).toBe('Normal');

    // Total Ca 6.0, Albumin 3.0 -> Corr Ca = 6.0 + 0.8 = 6.8 (Hipokalsemia)
    const resHypo = calculateCorrectedCalcium(6.0, 3.0);
    expect(resHypo.correctedCa).toBe(6.8);
    expect(resHypo.interpretation).toBe('Hipokalsemia');
  });

  it('calculates BUN:Cr ratio with RSUP Ngoerah Ureum / 2.14 conversion and AEIOU Cito HD', () => {
    // RS Ureum 107 mg/dL -> BUN = 107 / 2.14 = 50 mg/dL. SCr 2.0 mg/dL -> Ratio = 25 (> 20: Prerenal)
    const resPrerenal = calculateBunCrRatio(107, 2.0, true);
    expect(resPrerenal.bunMgDl).toBeCloseTo(50, 0);
    expect(resPrerenal.ratio).toBe(25);
    expect(resPrerenal.classification).toBe('Prerenal Azotemia');

    // ATN case: BUN 16, SCr 2.0 -> Ratio 8 (< 10: ATN)
    const resAtn = calculateBunCrRatio(16, 2.0, false);
    expect(resAtn.ratio).toBe(8);
    expect(resAtn.classification).toBe('Intrinsic Renal / ATN');

    // AEIOU HD check
    const aeiouPositive = evaluateAeiouHdIndications({
      acidosisPhRefractory: true,
      electrolytesRefractoryHyperkalemia: true,
    });
    expect(aeiouPositive.isCitoHdIndicated).toBe(true);
    expect(aeiouPositive.positiveCriteria.length).toBe(2);
  });
});
