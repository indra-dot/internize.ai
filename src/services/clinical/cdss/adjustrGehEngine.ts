/**
 * internize.ai — adjustr-GEH v2.2 Engine (Gastroentero-Hepatologi)
 * Ported directly from drguswib adjustr-GEH CDSS.
 * 100% on-device deterministic execution (Zero Egress Invariant).
 */

import { GuardrailAlert } from './types';
import { ureumRsToMmol, bunToMmol } from './unitConverters';

// ==========================================
// 1. GI BLEEDING: GLASGOW-BLATCHFORD SCORE (GBS)
// ==========================================

export interface GbsInput {
  bunValue: number;
  bunUnit: 'mmol' | 'bun_mg' | 'ureum_rs';
  hemoglobin: number;
  gender: 'male' | 'female';
  systolicBp: number;
  heartRate: number;
  hasMelena: boolean;
  hasSyncope: boolean;
  hasHepaticDisease: boolean;
  hasHeartFailure: boolean;
}

export interface GbsResult {
  totalScore: number;
  riskCategory: 'Low Risk (Safe Outpatient)' | 'Intermediate Risk' | 'High Risk (Urgent Endoscopy / ICU)';
  interventionRisk: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateGbs(input: GbsInput): GbsResult {
  let bunMmol = input.bunValue;
  if (input.bunUnit === 'bun_mg') {
    bunMmol = bunToMmol(input.bunValue);
  } else if (input.bunUnit === 'ureum_rs') {
    bunMmol = ureumRsToMmol(input.bunValue);
  }

  let score = 0;

  // BUN
  if (bunMmol >= 25.0) score += 6;
  else if (bunMmol >= 10.0) score += 4;
  else if (bunMmol >= 8.0) score += 3;
  else if (bunMmol >= 6.5) score += 2;

  // Hemoglobin
  if (input.gender === 'male') {
    if (input.hemoglobin < 10.0) score += 6;
    else if (input.hemoglobin < 12.0) score += 3;
    else if (input.hemoglobin < 13.0) score += 1;
  } else {
    if (input.hemoglobin < 10.0) score += 6;
    else if (input.hemoglobin < 12.0) score += 1;
  }

  // SBP
  if (input.systolicBp < 90) score += 3;
  else if (input.systolicBp < 100) score += 2;
  else if (input.systolicBp < 110) score += 1;

  // Pulse
  if (input.heartRate >= 100) score += 1;

  // Clinical criteria
  if (input.hasMelena) score += 1;
  if (input.hasSyncope) score += 2;
  if (input.hasHepaticDisease) score += 2;
  if (input.hasHeartFailure) score += 2;

  let riskCategory: 'Low Risk (Safe Outpatient)' | 'Intermediate Risk' | 'High Risk (Urgent Endoscopy / ICU)' = 'Intermediate Risk';
  let interventionRisk = 'Kebutuhan intervensi endoskopi/transfusi ~15-30%';
  const alerts: GuardrailAlert[] = [];

  if (score === 0) {
    riskCategory = 'Low Risk (Safe Outpatient)';
    interventionRisk = 'Risiko intervensi / mortalitas sangat rendah (< 0.5%). Aman rawat jalan.';
  } else if (score >= 6) {
    riskCategory = 'High Risk (Urgent Endoscopy / ICU)';
    interventionRisk = 'Risiko intervensi hemostasis endoskopi / transfusi > 50%. Rawat intensif/HCU.';
    alerts.push({
      severity: 'danger',
      title: 'Peringatan GBS Tinggi (≥ 6 Poin)',
      message: 'Perdarahan saluran cerna atas berisiko tinggi. Pasang 2 jalur IV kanula besar (16-18G), mulai PPI bolus 80 mg dilanjutkan infus kontinu 8 mg/jam, siapkan PRC 2-4 labu, dan konsul cito Endoskopi Saluran Cerna dalam 24 jam.',
    });
  }

  let cppt = `[adjustr-GEH CDSS] GLASGOW-BLATCHFORD SCORE (GBS)\n`;
  cppt += `Total Skor GBS: ${score} poin -> ${riskCategory}\n`;
  cppt += `Stratifikasi Intervensi: ${interventionRisk}\n`;
  cppt += `Data Klinis: Hb ${input.hemoglobin} g/dL | BUN ${bunMmol.toFixed(1)} mmol/L | TD ${input.systolicBp} mmHg | Nadi ${input.heartRate} x/m | Melena: ${input.hasMelena ? 'Ya' : 'Tdk'} | Sinkop: ${input.hasSyncope ? 'Ya' : 'Tdk'}`;

  return {
    totalScore: score,
    riskCategory,
    interventionRisk,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 2. LOWER GI BLEEDING: OAKLAND SCORE
// ==========================================

export interface OaklandInput {
  age: number;
  gender: 'male' | 'female';
  priorLgibAdmission: boolean;
  dreBloodPresent: boolean;
  heartRate: number;
  systolicBp: number;
  hemoglobin: number;
}

export function calculateOakland(input: OaklandInput): {
  totalScore: number;
  isSafeDischarge: boolean;
  interpretation: string;
  cpptFormat: string;
} {
  let score = 0;

  // Age
  if (input.age >= 70) score += 2;
  else if (input.age >= 40) score += 1;

  // Gender
  if (input.gender === 'male') score += 1;

  // Prior admission
  if (input.priorLgibAdmission) score += 1;

  // DRE blood
  if (input.dreBloodPresent) score += 1;

  // Heart Rate
  if (input.heartRate >= 110) score += 3;
  else if (input.heartRate >= 90) score += 2;
  else if (input.heartRate >= 70) score += 1;

  // SBP
  if (input.systolicBp < 80) score += 6;
  else if (input.systolicBp < 90) score += 5;
  else if (input.systolicBp < 100) score += 4;
  else if (input.systolicBp < 120) score += 3;
  else if (input.systolicBp < 130) score += 2;

  // Hemoglobin
  if (input.hemoglobin < 7.0) score += 22;
  else if (input.hemoglobin < 9.0) score += 17;
  else if (input.hemoglobin < 11.0) score += 13;
  else if (input.hemoglobin < 13.0) score += 8;
  else if (input.hemoglobin < 16.0) score += 4;

  const isSafeDischarge = score <= 8;
  const interpretation = isSafeDischarge
    ? 'Aman Rawat Jalan (Oakland Score ≤ 8, probabilitas luaran aman ≥ 95%)'
    : 'Perlu Rawat Inap / Evaluasi Lanjutan (Oakland Score > 8)';

  let cppt = `[adjustr-GEH CDSS] OAKLAND SCORE (LOWER GI BLEEDING)\n`;
  cppt += `Total Skor Oakland: ${score} poin -> ${interpretation}`;

  return {
    totalScore: score,
    isSafeDischarge,
    interpretation,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 3. CHILD-TURCOTTE-PUGH (CTP) SCORE
// ==========================================

export interface CtpInput {
  hepaticEncephalopathyGrade: 1 | 2 | 3; // 1: None, 2: Grade 1-2, 3: Grade 3-4
  ascitesGrade: 1 | 2 | 3;               // 1: None, 2: Mild/diuretic-responsive, 3: Moderate-severe/refractory
  totalBilirubin: number;               // mg/dL: <2 (1), 2-3 (2), >3 (3)
  serumAlbumin: number;                 // g/dL: >3.5 (1), 2.8-3.5 (2), <2.8 (3)
  inr: number;                          // <1.7 (1), 1.7-2.3 (2), >2.3 (3)
}

export interface CtpResult {
  totalScore: number;
  ctpClass: 'Class A' | 'Class B' | 'Class C';
  compensationStatus: string;
  oneYearSurvival: string;
  perioperativeMortality: string;
  cpptFormat: string;
}

export function calculateCtp(input: CtpInput): CtpResult {
  let score = 0;
  score += input.hepaticEncephalopathyGrade;
  score += input.ascitesGrade;

  // Bilirubin
  if (input.totalBilirubin > 3.0) score += 3;
  else if (input.totalBilirubin >= 2.0) score += 2;
  else score += 1;

  // Albumin
  if (input.serumAlbumin < 2.8) score += 3;
  else if (input.serumAlbumin <= 3.5) score += 2;
  else score += 1;

  // INR
  if (input.inr > 2.3) score += 3;
  else if (input.inr >= 1.7) score += 2;
  else score += 1;

  let ctpClass: 'Class A' | 'Class B' | 'Class C' = 'Class A';
  let compensationStatus = 'Well-Compensated Cirrhosis';
  let oneYearSurvival = '100%';
  let perioperativeMortality = '~10%';

  if (score >= 10) {
    ctpClass = 'Class C';
    compensationStatus = 'Decompensated Cirrhosis (Severe)';
    oneYearSurvival = '45%';
    perioperativeMortality = '~70-80%';
  } else if (score >= 7) {
    ctpClass = 'Class B';
    compensationStatus = 'Decompensated Cirrhosis (Significant Functional Compromise)';
    oneYearSurvival = '80%';
    perioperativeMortality = '~30%';
  }

  let cppt = `[adjustr-GEH CDSS] CHILD-TURCOTTE-PUGH (CTP) SCORE\n`;
  cppt += `Total Skor: ${score} poin -> ${ctpClass} (${compensationStatus})\n`;
  cppt += `Prognosis: Survival 1 Tahun ${oneYearSurvival} | Mortalitas Perioperatif ${perioperativeMortality}`;

  return {
    totalScore: score,
    ctpClass,
    compensationStatus,
    oneYearSurvival,
    perioperativeMortality,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 4. MELD TRIO (ORIGINAL, MELD-Na, MELD 3.0)
// ==========================================

export interface MeldTrioInput {
  totalBilirubinMgDl: number;
  serumCreatinineMgDl: number;
  inr: number;
  serumSodiumMeqL: number;
  serumAlbuminGDl: number;
  gender: 'male' | 'female';
  hasDialysisInPastWeek: boolean;
}

export interface MeldTrioResult {
  meldOriginal: number;
  meldNa: number;
  meld30: number;
  ninetyDayMortality: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateMeldTrio(input: MeldTrioInput): MeldTrioResult {
  const { totalBilirubinMgDl, serumCreatinineMgDl, inr, serumSodiumMeqL, serumAlbuminGDl, gender, hasDialysisInPastWeek } = input;

  // Clamped variables for original MELD
  const crAdj = hasDialysisInPastWeek ? 4.0 : Math.min(4.0, Math.max(1.0, serumCreatinineMgDl));
  const biliAdj = Math.max(1.0, totalBilirubinMgDl);
  const inrAdj = Math.max(1.0, inr);

  const meldRaw = 9.57 * Math.log(crAdj) + 3.78 * Math.log(biliAdj) + 11.20 * Math.log(inrAdj) + 6.43;
  const meldOriginal = Math.min(40, Math.max(6, Math.round(meldRaw)));

  // MELD-Na (UNOS/OPTN 2016)
  const naAdj = Math.min(137, Math.max(125, serumSodiumMeqL));
  let meldNa = meldOriginal;
  if (meldOriginal > 11) {
    const meldNaRaw = meldOriginal + 1.32 * (137 - naAdj) - 0.033 * meldOriginal * (137 - naAdj);
    meldNa = Math.min(40, Math.max(6, Math.round(meldNaRaw)));
  }

  // MELD 3.0 (OPTN 2021)
  const crAdjMeld3 = hasDialysisInPastWeek ? 3.0 : Math.min(3.0, Math.max(1.0, serumCreatinineMgDl));
  const albAdj = Math.min(3.5, Math.max(1.5, serumAlbuminGDl));
  const isFemale = gender === 'female' ? 1 : 0;

  const meld3Raw =
    1.33 * isFemale +
    4.56 * Math.log(biliAdj) +
    0.82 * (137 - naAdj) -
    0.24 * (137 - naAdj) * Math.log(biliAdj) +
    9.09 * Math.log(inrAdj) +
    11.14 * Math.log(crAdjMeld3) +
    1.85 * (3.5 - albAdj) -
    1.83 * (3.5 - albAdj) * Math.log(crAdjMeld3) +
    6.0;
  const meld30 = Math.min(40, Math.max(6, Math.round(meld3Raw)));

  let ninetyDayMortality = '< 2%';
  if (meldNa >= 30) ninetyDayMortality = '> 50%';
  else if (meldNa >= 20) ninetyDayMortality = '~20%';
  else if (meldNa >= 10) ninetyDayMortality = '~6%';

  const alerts: GuardrailAlert[] = [];
  if (meldNa >= 25 || meld30 >= 25) {
    alerts.push({
      severity: 'danger',
      title: 'MELD Tinggi (≥ 25 Poin) — Prioritas Transplantasi Hepar',
      message: 'Mortalitas 90 hari sangat signifikan. Evaluasi komplikasi hipertensi portal, sindrom hepatorenal (HRS), atau peritonitis bakterial spontan (SBP). Pertimbangkan konsultasi tim transplantasi hepar.',
    });
  }

  let cppt = `[adjustr-GEH CDSS] MELD TRIO (LIVER FAILURE STRATIFICATION)\n`;
  cppt += `- Original MELD (2002) : ${meldOriginal}\n`;
  cppt += `- MELD-Na (UNOS 2016)  : ${meldNa} (Mortalitas 90 Hari: ${ninetyDayMortality})\n`;
  cppt += `- MELD 3.0 (OPTN 2021) : ${meld30} (Dengan koreksi gender wanita & albumin)\n`;

  return {
    meldOriginal,
    meldNa,
    meld30,
    ninetyDayMortality,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 5. SAAG & ABSOLUTE PMN (SBP)
// ==========================================

export interface SaagInput {
  serumAlbuminGDl: number;
  ascitesAlbuminGDl: number;
  ascitesTotalProteinGDl?: number;
  ascitesWbcPerUl?: number;
  ascitesPmnPercent?: number; // e.g. 50%
}

export interface SaagResult {
  saag: number;
  portalHypertension: boolean;
  classification: string;
  absolutePmnPerUl?: number;
  isSbpDiagnostic: boolean;
  sbpRecommendation?: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateSaag(input: SaagInput): SaagResult {
  const saag = Math.round((input.serumAlbuminGDl - input.ascitesAlbuminGDl) * 100) / 100;
  const portalHypertension = saag >= 1.1;

  let classification = '';
  if (portalHypertension) {
    if (input.ascitesTotalProteinGDl !== undefined) {
      classification = input.ascitesTotalProteinGDl < 2.5
        ? 'High SAAG (≥ 1.1) + Low Protein (< 2.5): Sugestif Sirosis Hepatis'
        : 'High SAAG (≥ 1.1) + High Protein (≥ 2.5): Sugestif Gagal Jantung Kanan / Budd-Chiari';
    } else {
      classification = 'High SAAG (≥ 1.1): Hipertensi Portal Positif';
    }
  } else {
    classification = 'Low SAAG (< 1.1): Bukan Hipertensi Portal (Karsinomatosis Peritoneal / TB Peritoneal / Sindrom Nefrotik)';
  }

  let absolutePmn: number | undefined;
  let isSbpDiagnostic = false;
  let sbpRecommendation: string | undefined;
  const alerts: GuardrailAlert[] = [];

  if (input.ascitesWbcPerUl !== undefined && input.ascitesPmnPercent !== undefined) {
    absolutePmn = Math.round(input.ascitesWbcPerUl * (input.ascitesPmnPercent / 100));
    if (absolutePmn >= 250) {
      isSbpDiagnostic = true;
      sbpRecommendation = 'CITO Terapi SBP: Cefotaxime 2 g q8h IV (atau Ceftriaxone 2 g q24h) + Albumin 1.5 g/kgBB pada hari ke-1 dan 1.0 g/kgBB pada hari ke-3 untuk mencegah sindrom hepatorenal.';
      alerts.push({
        severity: 'danger',
        title: 'DIAGNOSTIK SPONTANEOUS BACTERIAL PERITONITIS (PMN ≥ 250/µL)',
        message: `Hitung PMN asites ${absolutePmn}/µL menegakkan diagnosis SBP. Segera berikan antibiotik sefalosporin generasi 3 IV dan infus Albumin dosis tinggi untuk menurunkan mortalitas dan mencegah gagal ginjal HRS.`,
      });
    }
  }

  let cppt = `[adjustr-GEH CDSS] ANALISIS CAIRAN ASITES (SAAG & SBP)\n`;
  cppt += `Albumin Serum: ${input.serumAlbuminGDl} | Albumin Asites: ${input.ascitesAlbuminGDl} -> SAAG: ${saag.toFixed(2)} g/dL\n`;
  cppt += `Interpretasi: ${classification}\n`;
  if (absolutePmn !== undefined) {
    cppt += `Hitung PMN Absolut: ${absolutePmn}/µL (${isSbpDiagnostic ? 'DIAGNOSTIK SBP' : 'Bukan SBP'})\n`;
  }
  if (sbpRecommendation) {
    cppt += `Tatalaksana: ${sbpRecommendation}`;
  }

  return {
    saag,
    portalHypertension,
    classification,
    absolutePmnPerUl: absolutePmn,
    isSbpDiagnostic,
    sbpRecommendation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 6. R-FACTOR (DILI PATTERN) & HY'S LAW
// ==========================================

export interface RFactorInput {
  altValue: number;
  altUln: number;
  alpValue: number;
  alpUln: number;
  totalBilirubinMgDl?: number;
}

export function calculateRFactor(input: RFactorInput): {
  rRatio: number;
  pattern: 'Hepatocellular' | 'Mixed' | 'Cholestatic';
  isHysLawPositive: boolean;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  const altRatio = input.altValue / input.altUln;
  const alpRatio = input.alpValue / input.alpUln;
  const rRatio = alpRatio > 0 ? Math.round((altRatio / alpRatio) * 100) / 100 : 0;

  let pattern: 'Hepatocellular' | 'Mixed' | 'Cholestatic' = 'Mixed';
  if (rRatio >= 5.0) pattern = 'Hepatocellular';
  else if (rRatio <= 2.0) pattern = 'Cholestatic';

  // Hy's Law: ALT >= 3x ULN AND Total Bili >= 2x ULN with ALP not predominantly elevated
  let isHysLawPositive = false;
  const alerts: GuardrailAlert[] = [];

  if (
    altRatio >= 3.0 &&
    input.totalBilirubinMgDl !== undefined &&
    input.totalBilirubinMgDl >= 2.0 &&
    alpRatio < 2.0
  ) {
    isHysLawPositive = true;
    alerts.push({
      severity: 'danger',
      title: "Peringatan Positif Hukum Hy (Hy's Law Positive)",
      message: "Kombinasi ALT ≥ 3x ULN dan Bilirubin ≥ 2x ULN tanpa kolestasis predominan mengindikasikan Drug-Induced Liver Injury (DILI) berat dengan mortalitas ~10%. Hentikan obat hepatotoksik penyebab segera!",
    });
  }

  let cppt = `[adjustr-GEH CDSS] R-FACTOR & DILI PATTERN\n`;
  cppt += `Rasio R: ${rRatio.toFixed(2)} -> Pola Cedera: ${pattern}\n`;
  cppt += `- ALT Ratio: ${altRatio.toFixed(1)}x ULN | ALP Ratio: ${alpRatio.toFixed(1)}x ULN\n`;
  if (isHysLawPositive) {
    cppt += `- Status Hy's Law: POSITIF (Risiko mortalitas DILI berat ~10%)\n`;
  }

  return {
    rRatio,
    pattern,
    isHysLawPositive,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 7. DE RITIS RATIO (AST / ALT)
// ==========================================

export function calculateDeRitis(astValue: number, altValue: number): {
  ratio: number;
  interpretation: string;
  cpptFormat: string;
} {
  const ratio = altValue > 0 ? Math.round((astValue / altValue) * 100) / 100 : 0;

  let interpretation = 'Normal / Non-spesifik';
  if (ratio > 2.0) {
    interpretation = 'Sangat Sugestif Alcoholic Liver Disease (ALD) / Sirosis Dekompensata';
  } else if (ratio > 1.0) {
    interpretation = 'Sugestif Sirosis Hepatis Lanjut atau Iskemia Akut';
  } else {
    interpretation = 'Sugestif NAFLD / Viral Hepatitis Akut (ALT > AST)';
  }

  let cppt = `[adjustr-GEH CDSS] DE RITIS RATIO (AST / ALT)\n`;
  cppt += `AST ${astValue} U/L | ALT ${altValue} U/L -> Rasio De Ritis: ${ratio.toFixed(2)}\n`;
  cppt += `Interpretasi: ${interpretation}`;

  return {
    ratio,
    interpretation,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 8. NON-INVASIVE FIBROSIS: FIB-4 & APRI
// ==========================================

export interface Fib4Input {
  age: number;
  astValue: number;
  altValue: number;
  plateletsPerUl: number; // e.g. 150000 or 150
  astUln?: number;
}

export function calculateFib4AndApri(input: Fib4Input): {
  fib4: number;
  fib4Risk: 'Low Fibrosis Risk' | 'Indeterminate' | 'High Fibrosis / Cirrhosis Risk';
  apri: number;
  apriRisk: 'Low Risk' | 'Significant Fibrosis / Cirrhosis';
  cpptFormat: string;
} {
  const { age, astValue, altValue } = input;
  // normalize platelets to 10^9/L (e.g. 150)
  const plt = input.plateletsPerUl > 1000 ? input.plateletsPerUl / 1000 : input.plateletsPerUl;
  const uln = input.astUln ?? 35;

  const fib4 = plt > 0 && altValue > 0 ? (age * astValue) / (plt * Math.sqrt(altValue)) : 0;
  const fib4Rounded = Math.round(fib4 * 100) / 100;

  let fib4Risk: 'Low Fibrosis Risk' | 'Indeterminate' | 'High Fibrosis / Cirrhosis Risk' = 'Indeterminate';
  if (fib4Rounded < 1.30) fib4Risk = 'Low Fibrosis Risk';
  else if (fib4Rounded > 2.67) fib4Risk = 'High Fibrosis / Cirrhosis Risk';

  // APRI: (AST / ULN) * 100 / Plt
  const apri = plt > 0 ? ((astValue / uln) * 100) / plt : 0;
  const apriRounded = Math.round(apri * 100) / 100;

  const apriRisk = apriRounded > 1.0 ? 'Significant Fibrosis / Cirrhosis' : 'Low Risk';

  let cppt = `[adjustr-GEH CDSS] NON-INVASIVE FIBROSIS SCORES\n`;
  cppt += `- FIB-4 Score : ${fib4Rounded.toFixed(2)} -> ${fib4Risk}\n`;
  cppt += `- APRI Score  : ${apriRounded.toFixed(2)} -> ${apriRisk}`;

  return {
    fib4: fib4Rounded,
    fib4Risk,
    apri: apriRounded,
    apriRisk,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 9. MADDREY DISCRIMINANT FUNCTION (ALCOHOLIC HEPATITIS)
// ==========================================

export function calculateMaddrey(
  patientPtSeconds: number,
  controlPtSeconds: number,
  totalBilirubinMgDl: number
): {
  discriminantFunction: number;
  isSevere: boolean;
  steroidIndication: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  const df = 4.6 * (patientPtSeconds - controlPtSeconds) + totalBilirubinMgDl;
  const roundedDf = Math.round(df * 10) / 10;
  const isSevere = roundedDf >= 32.0;

  const alerts: GuardrailAlert[] = [];
  let steroidIndication = '';

  if (isSevere) {
    steroidIndication = 'Indikasi Kortikosteroid (Prednisolon 40 mg/hari oral selama 28 hari) bila tidak ada infeksi aktif atau perdarahan GI.';
    alerts.push({
      severity: 'danger',
      title: 'Hepatitis Alkoholik Berat (Maddrey dF ≥ 32)',
      message: 'Mortalitas 30 hari tanpa terapi ~30-50%. Mulai Prednisolon 40 mg/hari p.o. (atau N-Acetylcysteine kombinasi). Hitung skor Lille pada hari ke-7 untuk menilai respons steroid.',
    });
  } else {
    steroidIndication = 'Hepatitis alkoholik ringan-sedang; steroid tidak diindikasikan. Lanjutkan suportif & nutrisi.';
  }

  let cppt = `[adjustr-GEH CDSS] MADDREY'S DISCRIMINANT FUNCTION (dF)\n`;
  cppt += `Nilai dF: ${roundedDf.toFixed(1)} -> ${isSevere ? 'Severe Alcoholic Hepatitis' : 'Mild-Moderate'}\n`;
  cppt += `Rekomendasi Terapi: ${steroidIndication}`;

  return {
    discriminantFunction: roundedDf,
    isSevere,
    steroidIndication,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 10. ACUTE PANCREATITIS: BISAP SCORE
// ==========================================

export interface BisapInput {
  bunAbove25MgDlOrMmol: boolean; // BUN > 25 mg/dL (> 8.9 mmol/L)
  impairedMentalStatus: boolean; // GCS < 15
  sirsCriteriaCountAtLeast2: boolean;
  ageAbove60: boolean;
  pleuralEffusionPresent: boolean;
}

export function calculateBisap(input: BisapInput): {
  totalScore: number;
  mortalityRisk: string;
  riskCategory: 'Low Risk' | 'High In-Hospital Mortality Risk';
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  let score = 0;
  if (input.bunAbove25MgDlOrMmol) score++;
  if (input.impairedMentalStatus) score++;
  if (input.sirsCriteriaCountAtLeast2) score++;
  if (input.ageAbove60) score++;
  if (input.pleuralEffusionPresent) score++;

  let mortalityRisk = '< 1%';
  let riskCategory: 'Low Risk' | 'High In-Hospital Mortality Risk' = 'Low Risk';
  const alerts: GuardrailAlert[] = [];

  if (score >= 3) {
    riskCategory = 'High In-Hospital Mortality Risk';
    mortalityRisk = score === 3 ? '~5-8%' : score === 4 ? '~12-19%' : '> 22%';
    alerts.push({
      severity: 'danger',
      title: 'Pankreatitis Akut Berat (BISAP ≥ 3)',
      message: 'Risiko kegagalan organ dan nekrosis pankreas sangat tinggi. Rawat intensif/ICU, lakukan resusitasi cairan kristaloid terarah (Ringer Laktat), dan monitor serial hematokrit & kreatinin.',
    });
  }

  let cppt = `[adjustr-GEH CDSS] BISAP SCORE (ACUTE PANCREATITIS)\n`;
  cppt += `Total Skor BISAP: ${score} poin -> ${riskCategory} (Mortalitas: ${mortalityRisk})\n`;

  return {
    totalScore: score,
    mortalityRisk,
    riskCategory,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 11. BILIARY INFECTION: TOKYO GUIDELINES 2018 (TG18)
// ==========================================

export interface Tg18Input {
  type: 'cholecystitis' | 'cholangitis';
  hasLocalSigns: boolean;     // Murphy's sign / RUQ pain/mass
  hasSystemicSigns: boolean;  // Fever / elevated CRP / leukocytosis
  hasImagingConfirmation: boolean;
  hasOrganDysfunction: boolean; // Cardiovasc, neuro, resp, renal, hepatic, hemostasis
  isGrade2Complicated?: boolean; // Elevated WBC >18k, palpable RUQ mass, >72h, biliary peritonitis
}

export function calculateTg18(input: Tg18Input): {
  isDefiniteDiagnosis: boolean;
  severityGrade: 'Grade I (Mild)' | 'Grade II (Moderate)' | 'Grade III (Severe)' | 'Not Meeting Diagnostic Criteria';
  recommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  const isDefiniteDiagnosis = input.hasLocalSigns && input.hasSystemicSigns && input.hasImagingConfirmation;
  let severityGrade: 'Grade I (Mild)' | 'Grade II (Moderate)' | 'Grade III (Severe)' | 'Not Meeting Diagnostic Criteria' = 'Not Meeting Diagnostic Criteria';
  let recommendation = '';
  const alerts: GuardrailAlert[] = [];

  if (!isDefiniteDiagnosis && !(input.hasLocalSigns && input.hasSystemicSigns)) {
    return {
      isDefiniteDiagnosis: false,
      severityGrade: 'Not Meeting Diagnostic Criteria',
      recommendation: 'Kriteria diagnostik TG18 belum terpenuhi.',
      alerts: [],
      cpptFormat: `[adjustr-GEH CDSS] TOKYO GUIDELINES 2018 (TG18): Kriteria diagnostik belum terpenuhi.`,
    };
  }

  if (input.hasOrganDysfunction) {
    severityGrade = 'Grade III (Severe)';
    recommendation = input.type === 'cholangitis'
      ? 'CITO Dekompresi Bilier (ERCP / PTBD) + Antibiotik IV Spektrum Luas + ICU support'
      : 'CITO Drainase Kandung Empedu (Percutaneous Cholecystostomy) / Bedah Emergensi';
    alerts.push({
      severity: 'danger',
      title: `TG18 Grade III (Severe ${input.type === 'cholangitis' ? 'Kolangitis' : 'Kolesistitis'})`,
      message: 'Terdapat disfungsi organ vital. Pasien memerlukan tindakan dekompresi bilier CITO dan resusitasi intensif.',
    });
  } else if (input.isGrade2Complicated) {
    severityGrade = 'Grade II (Moderate)';
    recommendation = input.type === 'cholangitis'
      ? 'Early Biliary Drainage (ERCP elektif dini < 48 jam) + Antibiotik IV'
      : 'Kolesistektomi Laparoskopi Dini (< 72 jam onset)';
  } else {
    severityGrade = 'Grade I (Mild)';
    recommendation = 'Antibiotik IV suportif + kolesistektomi elektif / konservatif';
  }

  let cppt = `[adjustr-GEH CDSS] TOKYO GUIDELINES 2018 (${input.type.toUpperCase()})\n`;
  cppt += `Status: ${severityGrade}\n`;
  cppt += `Rekomendasi Tindakan: ${recommendation}`;

  return {
    isDefiniteDiagnosis,
    severityGrade,
    recommendation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}
