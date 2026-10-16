/**
 * internize.ai — adjustrEMD Engine (Endokrin & Metabolik Emergency)
 * Ported directly from drguswib adjustrEMD CDSS.
 * 100% on-device deterministic execution (Zero Egress Invariant).
 */

import { GuardrailAlert } from './types';

// ==========================================
// 1. BURCH-WARTOFSKY POINT SCALE (BWPS)
// ==========================================

export interface BwpsInput {
  tempCelsius: number; // e.g. 38.5
  cnsDysfunction: 'none' | 'mild_agitation' | 'delirium_psychosis' | 'seizure_coma';
  giDysfunction: 'none' | 'diarrhea_nausea_vomiting' | 'jaundice';
  heartRate: number; // bpm
  congestiveHeartFailure: 'none' | 'mild_pedal_edema' | 'moderate_bibasilar_rales' | 'severe_pulmonary_edema';
  atrialFibrillation: boolean;
  precipitatingEventHistory: boolean;
}

export interface BwpsResult {
  totalScore: number;
  interpretation: 'Highly suggestive of Thyroid Storm' | 'Impending Thyroid Storm' | 'Unlikely Thyroid Storm';
  alerts: GuardrailAlert[];
  regimenRecommendation: string;
  cpptFormat: string;
}

export function calculateBwps(input: BwpsInput): BwpsResult {
  let score = 0;

  // Temperature
  if (input.tempCelsius >= 40.0) score += 30;
  else if (input.tempCelsius >= 39.5) score += 25;
  else if (input.tempCelsius >= 39.0) score += 20;
  else if (input.tempCelsius >= 38.4) score += 15;
  else if (input.tempCelsius >= 37.8) score += 10;
  else if (input.tempCelsius >= 37.2) score += 5;

  // CNS
  if (input.cnsDysfunction === 'seizure_coma') score += 30;
  else if (input.cnsDysfunction === 'delirium_psychosis') score += 20;
  else if (input.cnsDysfunction === 'mild_agitation') score += 10;

  // GI-Hepatic
  if (input.giDysfunction === 'jaundice') score += 20;
  else if (input.giDysfunction === 'diarrhea_nausea_vomiting') score += 10;

  // Heart Rate
  if (input.heartRate >= 140) score += 25;
  else if (input.heartRate >= 130) score += 20;
  else if (input.heartRate >= 120) score += 15;
  else if (input.heartRate >= 110) score += 10;
  else if (input.heartRate >= 100) score += 5;

  // Congestive Heart Failure
  if (input.congestiveHeartFailure === 'severe_pulmonary_edema') score += 15;
  else if (input.congestiveHeartFailure === 'moderate_bibasilar_rales') score += 10;
  else if (input.congestiveHeartFailure === 'mild_pedal_edema') score += 5;

  // Atrial Fibrillation
  if (input.atrialFibrillation) score += 10;

  // Precipitating Event
  if (input.precipitatingEventHistory) score += 10;

  let interpretation: 'Highly suggestive of Thyroid Storm' | 'Impending Thyroid Storm' | 'Unlikely Thyroid Storm' = 'Unlikely Thyroid Storm';
  const alerts: GuardrailAlert[] = [];
  let regimen = '';

  if (score >= 45) {
    interpretation = 'Highly suggestive of Thyroid Storm';
    regimen = 'CITO Protokol Multimodal Krisis Tiroid: 1) Blok sintesis: PTU 200 mg q4h (loading 600-1000 mg) oral/NGT, 2) Blok rilis: Lugol 8 tetes q6h atau SSKI 5 tetes q6h (diberikan 1 JAM SETELAH PTU), 3) Blok perifer & simpatis: Propranolol 60-80 mg q4h oral atau Esmolol IV, 4) Kortikosteroid: Hidrokortison 100 mg IV q8h.';
    alerts.push({
      severity: 'danger',
      title: 'Krisis Tiroid Mengancam Jiwa (BWPS ≥ 45)',
      message: 'Segera rawat ICU / HCU. Mulai terapi multimodal tanpa menunggu hasil lab fT4/TSH. Lugol / larutan iodin WAJIB diberikan minimal 1 jam setelah antitiroid (PTU) untuk mencegah efek Jod-Basedow.',
    });
  } else if (score >= 25) {
    interpretation = 'Impending Thyroid Storm';
    regimen = 'Tirotoksikosis Berat / Impending Storm: Observasi ketat di HCU, hidrasi adekuat, mulai antitiroid oral (PTU / Methimazole) dan beta-blocker (Propranolol).';
    alerts.push({
      severity: 'warning',
      title: 'Impending Thyroid Storm (BWPS 25 - 44)',
      message: 'Risiko dekompensasi akut menjadi badai tiroid penuh. Lakukan evaluasi faktor pemicu (infeksi, operasi, penghentian obat tiroid).',
    });
  } else {
    interpretation = 'Unlikely Thyroid Storm';
    regimen = 'Krisis tiroid kecil kemungkinan. Evaluasi etiologi takikardia atau demam lainnya.';
  }

  let cppt = `[adjustrEMD CDSS] BURCH-WARTOFSKY POINT SCALE (BWPS) TIROID\n`;
  cppt += `Total Skor: ${score} poin -> ${interpretation}\n`;
  cppt += `Rincian Komponen:\n`;
  cppt += `- Suhu: ${input.tempCelsius}°C | HR: ${input.heartRate} bpm | AF: ${input.atrialFibrillation ? 'Ya' : 'Tidak'}\n`;
  cppt += `- Status SSP: ${input.cnsDysfunction} | GI: ${input.giDysfunction} | Dekompensasi Kordis: ${input.congestiveHeartFailure}\n`;
  cppt += `- Riwayat Pemicu: ${input.precipitatingEventHistory ? 'Ya' : 'Tidak'}\n`;
  cppt += `Rekomendasi Tatalaksana: ${regimen}`;

  return {
    totalScore: score,
    interpretation,
    alerts,
    regimenRecommendation: regimen,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 2. MYXEDEMA COMA DIAGNOSTIC SCORE
// ==========================================

export interface MyxedemaInput {
  tempScore: number;       // Hypothermia: <32.2 (20), 32.2-33.3 (15), 33.4-35 (10)
  cnsScore: number;        // CNS: somnolence/lethargy (10), stupor (20), coma (30)
  giScore: number;         // GI: anorexia/constipation (5), ileus/megacolon (15)
  hrScore: number;         // Bradycardia: 50-59 (10), <50 (20)
  bpScore: number;         // Hypotension: SBP <100 (10), shock (20)
  naScore: number;         // Hyponatremia: 130-134 (5), 120-129 (10), <120 (15)
  hypoglycemia?: boolean;  // 5 pts
  hypoventilation?: boolean; // 10 pts
  pericardialEffusion?: boolean; // 10 pts
  precipitatingEvent?: boolean; // 10 pts
}

export interface MyxedemaResult {
  totalScore: number;
  interpretation: 'Diagnostik Koma Miksedema' | 'Risiko Tinggi / Sugestif Koma Miksedema' | 'Koma Miksedema Tidak Mungkin';
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateMyxedemaScore(input: MyxedemaInput): MyxedemaResult {
  let score =
    (input.tempScore || 0) +
    (input.cnsScore || 0) +
    (input.giScore || 0) +
    (input.hrScore || 0) +
    (input.bpScore || 0) +
    (input.naScore || 0);

  if (input.hypoglycemia) score += 5;
  if (input.hypoventilation) score += 10;
  if (input.pericardialEffusion) score += 10;
  if (input.precipitatingEvent) score += 10;

  let interpretation: 'Diagnostik Koma Miksedema' | 'Risiko Tinggi / Sugestif Koma Miksedema' | 'Koma Miksedema Tidak Mungkin' = 'Koma Miksedema Tidak Mungkin';
  const alerts: GuardrailAlert[] = [];

  // INVARIANT GUARDRAIL: Hydrocortisone BEFORE Levothyroxine
  alerts.push({
    severity: 'danger',
    title: 'CRITICAL INVARIANT: Hidrokortison Wajib Masuk SEBELUM Levotiroksin',
    message: 'Wajib memberikan Hidrokortison IV 100 mg SEBELUM terapi Levotiroksin! Pemberian hormon tiroid sebelum steroid dapat mempercepat klirens kortisol dan memicu KRISIS ADRENAL AKUT FATAL pada insufisiensi adrenal sekunder/subklinis penyerta.',
  });

  if (score >= 60) {
    interpretation = 'Diagnostik Koma Miksedema';
  } else if (score >= 25) {
    interpretation = 'Risiko Tinggi / Sugestif Koma Miksedema';
  }

  let cppt = `[adjustrEMD CDSS] MYXEDEMA COMA DIAGNOSTIC SCORE\n`;
  cppt += `Total Skor: ${score} poin -> ${interpretation}\n`;
  cppt += `Rekomendasi Terapi:\n`;
  cppt += `1. STEROID PERTAMA: Hidrokortison 100 mg IV bolus, lalu 50-100 mg q6-8h IV.\n`;
  cppt += `2. HORMON TIROID: Levotiroksin (L-T4) loading 200-400 mcg IV (atau via NGT), dilanjutkan 50-100 mcg/hari.\n`;
  cppt += `3. SUPPORTIF: Pemanasan pasif (selimut, hindari active warming cepat karena vasodilatasi shock), ventilasi mekanik bila hipoventilasi, dan koreksi hiponatremia hati-hati.`;

  return {
    totalScore: score,
    interpretation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 3. DKA SEVERITY & ADA RESOLUTION TRACKER
// ==========================================

export interface DkaInput {
  venousPh: number;
  serumHco3: number;
  bloodGlucose: number;
  anionGap: number;
  serumPotassium: number;
  mentalStatus: 'alert' | 'drowsy' | 'stupor_coma';
}

export interface DkaResult {
  severity: 'DKA Berat (Severe)' | 'DKA Sedang (Moderate)' | 'DKA Ringan (Mild)' | 'Non-Acidotic';
  isResolved: boolean;
  resolutionStatus: string;
  criteriaStatus: {
    glucoseBelow200: boolean;
    hco3AtLeast18: boolean;
    phAbove730: boolean;
    anionGapNormal: boolean;
  };
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function evaluateDkaStatus(input: DkaInput): DkaResult {
  const { venousPh, serumHco3, bloodGlucose, anionGap, serumPotassium, mentalStatus } = input;

  // 1. Severity Stratification
  let severity: 'DKA Berat (Severe)' | 'DKA Sedang (Moderate)' | 'DKA Ringan (Mild)' | 'Non-Acidotic' = 'Non-Acidotic';

  if (venousPh < 7.00 || serumHco3 < 10 || mentalStatus === 'stupor_coma') {
    severity = 'DKA Berat (Severe)';
  } else if (venousPh < 7.25 || serumHco3 < 15 || mentalStatus === 'drowsy') {
    severity = 'DKA Sedang (Moderate)';
  } else if (venousPh <= 7.30 || serumHco3 <= 18) {
    severity = 'DKA Ringan (Mild)';
  }

  // 2. ADA Resolution Criteria
  const glucoseBelow200 = bloodGlucose < 200;
  const hco3AtLeast18 = serumHco3 >= 18;
  const phAbove730 = venousPh > 7.30;
  const anionGapNormal = anionGap <= 12;

  let acidBaseResolvedCount = 0;
  if (hco3AtLeast18) acidBaseResolvedCount++;
  if (phAbove730) acidBaseResolvedCount++;
  if (anionGapNormal) acidBaseResolvedCount++;

  const isResolved = glucoseBelow200 && acidBaseResolvedCount >= 2;
  const resolutionStatus = isResolved
    ? 'Resolusi Tercapai (Siap Bridging ke Insulin Subkutan)'
    : 'Belum Resolusi (Lanjutkan Drip Insulin IV & Rehidrasi)';

  // 3. Kalium Guardrail
  const alerts: GuardrailAlert[] = [];
  if (serumPotassium < 3.5) {
    alerts.push({
      severity: 'danger',
      title: 'PERINGATAN KRITIS: TAHAN INSULIN (K < 3.5 mEq/L)',
      message: `Kadar Kalium saat ini ${serumPotassium} mEq/L. Dilarang memulai atau melanjutkan drip insulin karena insulin mendorong kalium masuk ke intraseluler dan dapat memicu henti jantung mendadak (aritmia letal)! Koreksi KCl 20-30 mEq/jam hingga Kalium serum mencapai ≥ 3.5 mEq/L baru insulin boleh dimulai.`,
    });
  }

  let cppt = `[adjustrEMD CDSS] DKA SEVERITY & ADA RESOLUTION TRACKER\n`;
  cppt += `Stratifikasi: ${severity}\n`;
  cppt += `Hasil Lab: GDS ${bloodGlucose} mg/dL | pH Vena ${venousPh} | HCO3 ${serumHco3} mEq/L | AG ${anionGap} | K ${serumPotassium} mEq/L | Sensorium: ${mentalStatus}\n`;
  cppt += `Status Resolusi ADA: ${resolutionStatus}\n`;
  cppt += `- Kriteria GDS < 200 mg/dL: ${glucoseBelow200 ? 'Terpenuhi' : 'Belum'}\n`;
  cppt += `- Kriteria Asam-Basa (Min 2): HCO3 ≥18 (${hco3AtLeast18 ? 'Ya' : 'Tdk'}), pH >7.30 (${phAbove730 ? 'Ya' : 'Tdk'}), AG ≤12 (${anionGapNormal ? 'Ya' : 'Tdk'})\n`;
  if (alerts.length > 0) {
    cppt += `- Peringatan Keselamatan: ${alerts[0].title} — ${alerts[0].message}\n`;
  }

  return {
    severity,
    isResolved,
    resolutionStatus,
    criteriaStatus: {
      glucoseBelow200,
      hco3AtLeast18,
      phAbove730,
      anionGapNormal,
    },
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 4. HIPOGLIKEMIA BERAT & RUMUS 30 D40%
// ==========================================

export interface HypoglycemiaResult {
  bloodGlucoseMgDl: number;
  targetMgDl: number;
  perkeniFlakon: number;
  perkeniInstruction: string;
  rumus30Flakon: number;
  dextroseGrams: number;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateHypoglycemiaD40(
  bloodGlucoseMgDl: number,
  targetMgDl = 100,
  isUnconscious = true
): HypoglycemiaResult {
  let perkeniFlakon = 0;
  let perkeniInstruction = '';

  if (bloodGlucoseMgDl < 50) {
    perkeniFlakon = 2;
    perkeniInstruction = 'Bolus D40% 50 cc (2 flakon) IV bolus lambat';
  } else if (bloodGlucoseMgDl < 70) {
    perkeniFlakon = 1;
    perkeniInstruction = 'Bolus D40% 25 cc (1 flakon) IV bolus lambat';
  } else {
    perkeniFlakon = 0;
    perkeniInstruction = 'Tidak memerlukan bolus D40% (GDS ≥ 70 mg/dL)';
  }

  const delta = Math.max(0, targetMgDl - bloodGlucoseMgDl);
  const rumus30Flakon = Math.round((delta / 30) * 10) / 10;
  const dextroseGrams = Math.round(rumus30Flakon * 10);

  const alerts: GuardrailAlert[] = [];
  if (isUnconscious) {
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Penurunan Kesadaran (Risiko Aspirasi)',
      message: 'Pasien tidak sadar / somnolen / stupor DILARANG diberikan asupan glukosa oral, air gula, atau permen karena risiko aspirasi pulmonal fatal! Gunakan akses intravena D40% atau Glucagon IM.',
    });
  }

  let cppt = `[adjustrEMD CDSS] TATALAKSANA HIPOGLIKEMIA BERAT (D40%)\n`;
  cppt += `GDS Awal: ${bloodGlucoseMgDl} mg/dL | Target: ${targetMgDl} mg/dL | Kesadaran: ${isUnconscious ? 'Menurun' : 'Compos Mentis'}\n`;
  cppt += `- Rekomendasi Protokol PERKENI: ${perkeniInstruction}\n`;
  cppt += `- Formula Rumus 30: ${rumus30Flakon.toFixed(1)} Flakon D40% (~${dextroseGrams} gram Dekstrosa Murni)\n`;
  cppt += `- Pemantauan: Cek GDS ulang 15-30 menit paska-bolus. Lanjutkan infus rumatan Dextrose 10% bila GDS belum stabil.`;

  return {
    bloodGlucoseMgDl,
    targetMgDl,
    perkeniFlakon,
    perkeniInstruction,
    rumus30Flakon,
    dextroseGrams,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 5. INSULIN BASAL-BOLUS TDD REGIMEN BUILDER
// ==========================================

export interface BasalBolusResult {
  weightKg: number;
  dosingFactor: number;
  totalDailyDoseUnits: number;
  basalDailyUnits: number;
  prandialPerMealUnits: number;
  cpptFormat: string;
}

export function calculateBasalBolusTdd(weightKg: number, dosingFactor = 0.5): BasalBolusResult {
  const tdd = Math.round(weightKg * dosingFactor);
  const basal = Math.round(tdd * 0.5);
  const prandial = Math.round((tdd * 0.5) / 3);

  let cppt = `[adjustrEMD CDSS] INISIASI INSULIN BASAL-BOLUS TDD\n`;
  cppt += `BB: ${weightKg} kg | Faktor Dosis: ${dosingFactor} U/kg/hari\n`;
  cppt += `Total Daily Dose (TDD): ${tdd} Unit/hari\n`;
  cppt += `- Basal (Glargine / Detemir): ${basal} Unit 1x sehari (malam jam 22.00)\n`;
  cppt += `- Bolus Prandial (Aspart / Lispro): 3 x ${prandial} Unit sebelum makan pagi, siang, malam`;

  return {
    weightKg,
    dosingFactor,
    totalDailyDoseUnits: tdd,
    basalDailyUnits: basal,
    prandialPerMealUnits: prandial,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 6. KARDIOMETABOLIK: TyG, HOMA-IR, FRIEDEWALD, AIP
// ==========================================

export interface MetabolicMarkersInput {
  triglyceridesMgDl?: number;
  fastingGlucoseMgDl?: number;
  fastingInsulinUuMl?: number;
  totalCholesterolMgDl?: number;
  hdlMgDl?: number;
}

export interface MetabolicMarkersResult {
  tygIndex?: number;
  homaIr?: number;
  friedewaldLdlMgDl?: number;
  isFriedewaldValid: boolean;
  aipIndex?: number;
  aipRiskLevel?: 'Low' | 'Intermediate' | 'High (High sdLDL)';
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateMetabolicMarkers(input: MetabolicMarkersInput): MetabolicMarkersResult {
  const { triglyceridesMgDl, fastingGlucoseMgDl, fastingInsulinUuMl, totalCholesterolMgDl, hdlMgDl } = input;
  const alerts: GuardrailAlert[] = [];

  // 1. TyG Index: ln(TG * FBG) / 2
  let tygIndex: number | undefined;
  if (triglyceridesMgDl && fastingGlucoseMgDl && triglyceridesMgDl > 0 && fastingGlucoseMgDl > 0) {
    tygIndex = Math.round((Math.log(triglyceridesMgDl * fastingGlucoseMgDl) / 2) * 100) / 100;
  }

  // 2. HOMA-IR: (Insulin * FBG) / 405
  let homaIr: number | undefined;
  if (fastingInsulinUuMl && fastingGlucoseMgDl && fastingInsulinUuMl > 0 && fastingGlucoseMgDl > 0) {
    homaIr = Math.round(((fastingInsulinUuMl * fastingGlucoseMgDl) / 405) * 100) / 100;
  }

  // 3. Friedewald LDL: TC - HDL - (TG / 5)
  let friedewaldLdlMgDl: number | undefined;
  let isFriedewaldValid = true;

  if (totalCholesterolMgDl && hdlMgDl && triglyceridesMgDl !== undefined) {
    if (triglyceridesMgDl > 400) {
      isFriedewaldValid = false;
      alerts.push({
        severity: 'warning',
        title: 'Formula Friedewald Tidak Valid (Trigliserida > 400 mg/dL)',
        message: 'Kadar trigliserida melebihi 400 mg/dL membuat estimasi LDL Friedewald tidak akurat. Wajib melakukan pemeriksaan LDL Direk (Direct LDL) dari laboratorium.',
      });
    } else {
      const calcLdl = totalCholesterolMgDl - hdlMgDl - (triglyceridesMgDl / 5);
      if (calcLdl < 0) {
        isFriedewaldValid = false;
        alerts.push({
          severity: 'warning',
          title: 'Hasil Estimasi LDL Negatif (< 0 mg/dL)',
          message: 'Hasil perhitungan LDL menghasilkan angka negatif. Sampel laboratorium memerlukan verifikasi atau pengukuran direct LDL.',
        });
      } else {
        friedewaldLdlMgDl = Math.round(calcLdl * 10) / 10;
      }
    }
  }

  // 4. AIP (Atherogenic Index of Plasma): log10((TG / 88.57) / (HDL / 38.67))
  let aipIndex: number | undefined;
  let aipRiskLevel: 'Low' | 'Intermediate' | 'High (High sdLDL)' | undefined;

  if (triglyceridesMgDl && hdlMgDl && triglyceridesMgDl > 0 && hdlMgDl > 0) {
    const tgMmol = triglyceridesMgDl / 88.57;
    const hdlMmol = hdlMgDl / 38.67;
    aipIndex = Math.round(Math.log10(tgMmol / hdlMmol) * 1000) / 1000;

    if (aipIndex > 0.21) aipRiskLevel = 'High (High sdLDL)';
    else if (aipIndex >= 0.11) aipRiskLevel = 'Intermediate';
    else aipRiskLevel = 'Low';
  }

  let cppt = `[adjustrEMD CDSS] PROFIL KARDIOMETABOLIK & RESISTENSI INSULIN\n`;
  if (tygIndex !== undefined) cppt += `- TyG Index: ${tygIndex.toFixed(2)} (Ambang resistensi insulin: > 4.5)\n`;
  if (homaIr !== undefined) cppt += `- HOMA-IR: ${homaIr.toFixed(2)} (Resistensi insulin signifikan bila > 2.5)\n`;
  if (friedewaldLdlMgDl !== undefined) cppt += `- Estimasi LDL-C (Friedewald): ${friedewaldLdlMgDl.toFixed(1)} mg/dL\n`;
  if (aipIndex !== undefined) cppt += `- Atherogenic Index of Plasma (AIP): ${aipIndex.toFixed(3)} (${aipRiskLevel})\n`;

  return {
    tygIndex,
    homaIr,
    friedewaldLdlMgDl,
    isFriedewaldValid,
    aipIndex,
    aipRiskLevel,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 7. ASCVD 10-YEAR RISK & TARGET LDL
// ==========================================

export interface AscvdInput {
  age: number;
  gender: 'male' | 'female';
  systolicBp: number;
  isHypertensionTreated: boolean;
  totalCholesterol: number;
  hdlCholesterol: number;
  hasDiabetes: boolean;
  isSmoker: boolean;
}

export interface AscvdResult {
  estimatedRiskPercent: number;
  riskCategory: 'Low Risk' | 'Borderline Risk' | 'Intermediate Risk' | 'High / Very High Risk';
  targetLdlMgDl: string;
  statinRecommendation: string;
  cpptFormat: string;
}

export function calculateAscvd10Yr(input: AscvdInput): AscvdResult {
  const { age, gender, systolicBp, isHypertensionTreated, totalCholesterol, hdlCholesterol, hasDiabetes, isSmoker } = input;

  let estRisk = 0;
  if (gender === 'male') {
    estRisk =
      age * 0.4 +
      totalCholesterol * 0.05 -
      hdlCholesterol * 0.08 +
      systolicBp * (isHypertensionTreated ? 0.08 : 0.04) +
      (hasDiabetes ? 8.0 : 0) +
      (isSmoker ? 7.5 : 0) -
      22;
  } else {
    estRisk =
      age * 0.35 +
      totalCholesterol * 0.04 -
      hdlCholesterol * 0.07 +
      systolicBp * (isHypertensionTreated ? 0.07 : 0.035) +
      (hasDiabetes ? 7.0 : 0) +
      (isSmoker ? 6.5 : 0) -
      20;
  }

  const clampedRisk = Math.round(Math.max(1.0, Math.min(65.0, estRisk)) * 10) / 10;

  let riskCategory: 'Low Risk' | 'Borderline Risk' | 'Intermediate Risk' | 'High / Very High Risk' = 'Low Risk';
  let targetLdl = '< 100 - 115 mg/dL';
  let statin = 'Gaya hidup sehat / evaluasi berkala';

  if (clampedRisk >= 20.0 || hasDiabetes) {
    riskCategory = 'High / Very High Risk';
    targetLdl = '< 55 - 70 mg/dL';
    statin = 'Statin Intensitas Tinggi (Atorvastatin 40-80 mg atau Rosuvastatin 20-40 mg)';
  } else if (clampedRisk >= 7.5) {
    riskCategory = 'Intermediate Risk';
    targetLdl = '< 70 - 100 mg/dL';
    statin = 'Statin Intensitas Sedang (Atorvastatin 20 mg atau Simvastatin 20-40 mg)';
  } else if (clampedRisk >= 5.0) {
    riskCategory = 'Borderline Risk';
    targetLdl = '< 100 mg/dL';
    statin = 'Diskusi risiko bersama / pertimbangkan statin intensitas sedang bila ada faktor penguat risiko';
  }

  let cppt = `[adjustrEMD CDSS] ESTIMASI RISIKO ASCVD 10 TAHUN (AHA/ACC)\n`;
  cppt += `Estimasi Risiko ASCVD: ${clampedRisk.toFixed(1)}% (${riskCategory})\n`;
  cppt += `Target LDL-C: ${targetLdl}\n`;
  cppt += `Rekomendasi Terapi Statin: ${statin}`;

  return {
    estimatedRiskPercent: clampedRisk,
    riskCategory,
    targetLdlMgDl: targetLdl,
    statinRecommendation: statin,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 8. KONVERSI HBA1C KE EAG
// ==========================================

export function calculateHbA1cToEag(hba1c: number): {
  eagMgDl: number;
  eagMmolL: number;
  cpptFormat: string;
} {
  const eagMgDl = Math.round(28.7 * hba1c - 46.7);
  const eagMmolL = Math.round((1.59 * hba1c - 2.59) * 10) / 10;

  let cppt = `[adjustrEMD CDSS] KONVERSI ESTIMATED AVERAGE GLUCOSE (eAG)\n`;
  cppt += `Kadar HbA1c: ${hba1c}%\n`;
  cppt += `Estimasi Rerata Glukosa Darah (eAG): ${eagMgDl} mg/dL (${eagMmolL} mmol/L)`;

  return {
    eagMgDl,
    eagMmolL,
    cpptFormat: cppt.trim(),
  };
}
