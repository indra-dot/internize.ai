/**
 * internize.ai — Milestone 6 CDSS Unit Tests
 * Testing AdjustrHOM (Hematologi-Onkologi) & RheumaTools (Reumatologi) Engines.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMascc,
  calculateCisne,
  evaluateCairoBishopTls,
  calculateCalvertCarboplatin,
  calculateKhorana,
  calculateFourTs,
  calculatePlasmic,
  calculateGanzoni,
  calculatePrcTransfusion,
} from '../../src/services/clinical/cdss/adjustrHomEngine';
import {
  evaluateAcrEularRa,
  calculateDas28Crp,
  calculateDas28Esr,
  calculateMexSledai,
  evaluateAcrEularGout,
  evaluateCasparCriteria,
} from '../../src/services/clinical/cdss/rheumaToolsEngine';

describe('Milestone 6 — AdjustrHOM: Febrile Neutropenia & TLS', () => {
  it('stratifies MASCC score and differentiates low-risk oral vs high-risk IV', () => {
    // Low risk: mild burden (5) + no hypo (5) + solid tumor (4) + no dehid (3) + outpt (3) + age<60 (2) = 22 pts (>=21)
    const resLow = calculateMascc({
      burdenOfIllness: 'none_or_mild',
      noHypotensionSbpAbove90: true,
      noCopd: false,
      solidTumorOrNoFungal: true,
      noDehydrationRequiringIv: true,
      outpatientAtOnset: true,
      ageBelow60: true,
    });
    expect(resLow.totalScore).toBe(22);
    expect(resLow.isLowRiskCandidate).toBe(true);
    expect(resLow.regimenRecommendation).toContain('oral');

    // High risk: severe burden (0) + hypotension + COPD = 0 pts
    const resHigh = calculateMascc({
      burdenOfIllness: 'severe_moribund',
      noHypotensionSbpAbove90: false,
      noCopd: false,
      solidTumorOrNoFungal: false,
      noDehydrationRequiringIv: false,
      outpatientAtOnset: false,
      ageBelow60: false,
    });
    expect(resHigh.totalScore).toBe(0);
    expect(resHigh.isLowRiskCandidate).toBe(false);
    expect(resHigh.alerts.some((a) => a.title.includes('Risiko Tinggi'))).toBe(true);
  });

  it('evaluates Cairo-Bishop TLS and identifies Clinical TLS with ICU hydration recommendation', () => {
    // Lab TLS: Uric acid 9.2 (>=8.0), K 6.4 (>=6.0), PO4 5.2 (>=4.5), Ca 6.8 (<=7.0) = 4 criteria
    // Clinical TLS: AKI present
    const res = evaluateCairoBishopTls({
      uricAcidMgDl: 9.2,
      potassiumMeqL: 6.4,
      phosphateMgDl: 5.2,
      calciumMgDl: 6.8,
      hasClinicalCreatinineRise: true,
      hasCardiacArrhythmia: false,
      hasSeizures: false,
    });

    expect(res.isLaboratoryTls).toBe(true);
    expect(res.isClinicalTls).toBe(true);
    expect(res.laboratoryCriteriaMet.length).toBe(4);
    expect(res.clinicalCriteriaMet.length).toBe(1);
    expect(res.recommendation).toContain('Rasburicase');
    expect(res.alerts.some((a) => a.title.includes('CLINICAL TLS') || a.title.includes('EMERGENSI TUMOR LYSIS'))).toBe(true);
  });

  it('calculates Calvert carboplatin dose and enforces 125 mL/min GFR safety cap', () => {
    // Normal CrCl 80 mL/min, Target AUC 5 -> Dose = 5 * (80 + 25) = 525 mg
    const resNormal = calculateCalvertCarboplatin(5, 80);
    expect(resNormal.effectiveCrCl).toBe(80);
    expect(resNormal.carboplatinDoseMg).toBe(525);
    expect(resNormal.isCrClCapped).toBe(false);

    // High CrCl 160 mL/min -> capped at 125 mL/min -> Dose = 5 * (125 + 25) = 750 mg
    const resCapped = calculateCalvertCarboplatin(5, 160);
    expect(resCapped.effectiveCrCl).toBe(125);
    expect(resCapped.carboplatinDoseMg).toBe(750);
    expect(resCapped.isCrClCapped).toBe(true);
  });
});

describe('Milestone 6 — AdjustrHOM: Khorana, 4Ts, PLASMIC, Ganzoni & PRC', () => {
  it('calculates Khorana VTE score in cancer patients', () => {
    // Stomach cancer (2) + Plt >= 350k (1) + Hb < 10 (1) = 4 pts (High Risk >= 3)
    const res = calculateKhorana({
      siteOfCancer: 'very_high',
      plateletCountAtLeast350k: true,
      hemoglobinBelow10OrEpo: true,
      leukocyteCountAbove11k: false,
      bmiAtLeast35: false,
    });

    expect(res.totalScore).toBe(4);
    expect(res.riskCategory).toBe('High Risk (≥ 3)');
    expect(res.prophylaxisRecommendation).toContain('tromboprofilaksis primer');
  });

  it('calculates 4Ts score for Heparin-Induced Thrombocytopenia (HIT)', () => {
    // 2 + 2 + 2 + 1 = 7 pts (High Probability 6-8)
    const res = calculateFourTs({
      thrombocytopeniaScore: 2,
      timingScore: 2,
      thrombosisScore: 2,
      otherCausesScore: 1,
    });

    expect(res.totalScore).toBe(7);
    expect(res.probability).toBe('High Probability (6-8)');
    expect(res.managementRecommendation).toContain('STOP SEMUA BENTUK HEPARIN');
    expect(res.alerts.some((a) => a.title.includes('Probabilitas Tinggi HIT'))).toBe(true);
  });

  it('calculates PLASMIC score for TTP and enforces NO PLATELET TRANSFUSION invariant', () => {
    // 7 criteria satisfied: Plt<30k (1), Hemolysis (1), No cancer (1), No transplant (1), MCV<90 (1), INR<1.5 (1), Cr<2.0 (1) = 7 pts
    const res = calculatePlasmic({
      plateletsBelow30k: true,
      hemolysisPresent: true,
      noActiveCancerInPastYear: true,
      noSolidOrganOrStemCellTransplant: true,
      mcvBelow90: true,
      inrBelow15: true,
      creatinineBelow20: true,
    });

    expect(res.totalScore).toBe(7);
    expect(res.riskCategory).toContain('High Risk');
    // Mandatory TTP invariant check: DO NOT TRANSFUSE PLATELETS!
    const contraindicationAlert = res.alerts.find((a) => a.title.includes('JANGAN TRANSFUSI TROMBOSIT'));
    expect(contraindicationAlert).toBeDefined();
    expect(contraindicationAlert?.severity).toBe('danger');
    expect(res.managementRecommendation).toContain('Plasma Exchange');
  });

  it('calculates Ganzoni iron deficit and PRC transfusion volumes accurately', () => {
    // 60 kg patient, actual Hb 7.0 g/dL -> Target 15 g/dL (Delta = 8 g/dL)
    // Ganzoni = 60 * 8 * 2.4 + 500 = 1152 + 500 = 1652 mg Fe (~17 ampoules)
    const resGanzoni = calculateGanzoni(60, 7.0, 15.0);
    expect(resGanzoni.totalIronDeficitMg).toBe(1652);
    expect(resGanzoni.ampoulesIronSucrose100mg).toBe(17);

    // PRC Transfusion: 60 kg patient, Hb 7.0 to Target 10.0 (Delta = 3 g/dL)
    // Vol = 3 * 60 * 3 = 540 mL (~3 bags)
    const resPrc = calculatePrcTransfusion(60, 7.0, 10.0);
    expect(resPrc.volumePrcMl).toBe(540);
    expect(resPrc.estimatedBagsPrc).toBe(3);
  });
});

describe('Milestone 6 — RheumaTools: RA, DAS28, MEX-SLEDAI, Gout & CASPAR', () => {
  it('evaluates ACR/EULAR 2010 RA Classification and DAS28-CRP', () => {
    // RA criteria: 4-10 small joints (3) + High positive serology (3) + abnormal CRP (1) + >= 6 weeks (1) = 8 pts (>=6)
    const resRa = evaluateAcrEularRa({
      jointInvolvement: '4_to_10_small',
      serology: 'high_positive',
      acutePhaseReactants: 'abnormal',
      durationOfSymptoms: 'at_least_6_weeks',
    });

    expect(resRa.totalScore).toBe(8);
    expect(resRa.isDefiniteRa).toBe(true);
    expect(resRa.recommendation).toContain('Metotreksat');

    // DAS28-CRP: TJC 8, SJC 4, CRP 15 mg/L, PGA 50 mm
    // formula = 0.56*sqrt(8) + 0.28*sqrt(4) + 0.36*ln(16) + 0.014*50 + 0.96
    // = 0.56*2.828 + 0.28*2 + 0.36*2.772 + 0.7 + 0.96 = 1.58 + 0.56 + 0.998 + 0.7 + 0.96 = 4.80 (Moderate)
    const resDas = calculateDas28Crp({
      tenderJointCount28: 8,
      swollenJointCount28: 4,
      crpMgL: 15,
      patientGlobalAssessment0To100: 50,
    });

    expect(resDas.score).toBeGreaterThan(3.2);
    expect(resDas.score).toBeLessThanOrEqual(5.1);
    expect(resDas.activityLevel).toBe('Moderate');
  });

  it('evaluates MEX-SLEDAI for lupus flare activity', () => {
    // Renal active (6) + Vasculitis (4) = 10 pts (Severe Flare >= 10)
    const resLupus = calculateMexSledai({
      renalActive: true,
      vasculitis: true,
    });

    expect(resLupus.totalScore).toBe(10);
    expect(resLupus.activityLevel).toBe('Aktivitas Berat / Flare Mayor');
    expect(resLupus.alerts.some((a) => a.title.includes('FLARE MAYOR LUPUS'))).toBe(true);
    expect(resLupus.recommendation).toContain('Metilprednisolon');
  });

  it('evaluates ACR/EULAR 2015 Gout classification and CASPAR PsA criteria', () => {
    // Gout: MTP1 (2) + 3 clinical chars (3) + recurrent (2) + Tophi (4) + Uric acid 10.5 (3) = 14 pts (>=8)
    const resGout = evaluateAcrEularGout({
      jointPattern: 'mtp1_involvement',
      clinicalCharacteristicsCount: 3,
      timeCourseTypicalEpisodes: 'recurrent_typical',
      clinicalTophiPresent: true,
      serumUricAcidMgDl: 10.5,
    });

    expect(resGout.totalScore).toBe(14);
    expect(resGout.isGoutClassified).toBe(true);
    expect(resGout.uricAcidTarget).toContain('< 5.0 mg/dL'); // tophaceous target
    expect(resGout.recommendation).toContain('Allopurinol');

    // CASPAR: Inflammatory articular disease (mandatory) + current psoriasis (2) + nail dystrophy (1) = 3 pts (>=3)
    const resCaspar = evaluateCasparCriteria({
      hasInflammatoryArticularDisease: true,
      currentPsoriasis: true,
      psoriaticNailDystrophy: true,
    });

    expect(resCaspar.totalScore).toBe(3);
    expect(resCaspar.isPsaClassified).toBe(true);
  });
});
