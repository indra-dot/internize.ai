/**
 * internize.ai — AdjustrHOM Engine (Hematologi & Onkologi Medik)
 * Ported directly from drguswib AdjustrHOM CDSS.
 * 100% on-device deterministic execution (Zero Egress Invariant).
 */

import { GuardrailAlert } from './types';

// ==========================================
// 1. FEBRILE NEUTROPENIA: MASCC & CISNE
// ==========================================

export interface MasccInput {
  burdenOfIllness: 'none_or_mild' | 'moderate' | 'severe_moribund'; // 5, 3, 0
  noHypotensionSbpAbove90: boolean; // +5
  noCopd: boolean;                  // +4
  solidTumorOrNoFungal: boolean;    // +4
  noDehydrationRequiringIv: boolean; // +3
  outpatientAtOnset: boolean;       // +3
  ageBelow60: boolean;              // +2
}

export function calculateMascc(input: MasccInput): {
  totalScore: number;
  riskCategory: 'Low Risk (MASCC ≥ 21)' | 'High Risk (MASCC < 21)';
  isLowRiskCandidate: boolean;
  regimenRecommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  let score = 0;
  if (input.burdenOfIllness === 'none_or_mild') score += 5;
  else if (input.burdenOfIllness === 'moderate') score += 3;

  if (input.noHypotensionSbpAbove90) score += 5;
  if (input.noCopd) score += 4;
  if (input.solidTumorOrNoFungal) score += 4;
  if (input.noDehydrationRequiringIv) score += 3;
  if (input.outpatientAtOnset) score += 3;
  if (input.ageBelow60) score += 2;

  const isLowRiskCandidate = score >= 21;
  const riskCategory = isLowRiskCandidate ? 'Low Risk (MASCC ≥ 21)' : 'High Risk (MASCC < 21)';

  let regimen = '';
  const alerts: GuardrailAlert[] = [];

  if (isLowRiskCandidate) {
    regimen = 'Pertimbangkan terapi oral rawat jalan (Amoksisilin-Klavulanat 3x625 mg + Siprofloksasin 2x500-750 mg) bila tanpa profilaksis kuinolon sebelumnya, kondisi klinis stabil, dan akses fasilitas 24 jam terjamin.';
  } else {
    regimen = 'CITO Rawat Inap & Antibiotik IV Antipseudomonas dalam ≤ 60 menit: Piperasilin-Tazobaktam 4.5 g q6h (atau Meropenem 1 g q8h / Sefepim 2 g q8h). Ambil kultur darah 2 set (perifer + CVC) SEBELUM dosis pertama.';
    alerts.push({
      severity: 'danger',
      title: 'Neutropenia Febril Risiko Tinggi (MASCC < 21)',
      message: 'Risiko komplikasi fatal, syok septik, dan mortalitas tinggi. Golden hour: antibiotik IV antipseudomonas wajib masuk dalam kurun 60 menit pertama setelah onset demam.',
    });
  }

  let cppt = `[AdjustrHOM CDSS] MASCC RISK INDEX (FEBRILE NEUTROPENIA)\n`;
  cppt += `Total Skor MASCC: ${score} / 26 poin -> ${riskCategory}\n`;
  cppt += `Rekomendasi Terapi: ${regimen}`;

  return {
    totalScore: score,
    riskCategory,
    isLowRiskCandidate,
    regimenRecommendation: regimen,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

export interface CisneInput {
  ecogPsAtLeast2: boolean;       // +2
  stressHyperglycemia: boolean;   // +2
  copd: boolean;                  // +1
  chronicCardiovascular: boolean; // +1
  mucositisGradeAtLeast2: boolean;// +1
  monocytesBelow200: boolean;     // +1
}

export function calculateCisne(input: CisneInput): {
  totalScore: number;
  riskClass: 'Class I (Low Risk: 0)' | 'Class II (Intermediate: 1-2)' | 'Class III (High Risk: ≥ 3)';
  majorComplicationRisk: string;
  cpptFormat: string;
} {
  let score = 0;
  if (input.ecogPsAtLeast2) score += 2;
  if (input.stressHyperglycemia) score += 2;
  if (input.copd) score += 1;
  if (input.chronicCardiovascular) score += 1;
  if (input.mucositisGradeAtLeast2) score += 1;
  if (input.monocytesBelow200) score += 1;

  let riskClass: 'Class I (Low Risk: 0)' | 'Class II (Intermediate: 1-2)' | 'Class III (High Risk: ≥ 3)' = 'Class I (Low Risk: 0)';
  let complication = '~1.1%';

  if (score >= 3) {
    riskClass = 'Class III (High Risk: ≥ 3)';
    complication = '~36.2%';
  } else if (score >= 1) {
    riskClass = 'Class II (Intermediate: 1-2)';
    complication = '~6.2%';
  }

  let cppt = `[AdjustrHOM CDSS] CISNE SCORE (FEBRILE NEUTROPENIA SOLID TUMOR)\n`;
  cppt += `Total Skor CISNE: ${score} poin -> ${riskClass}\n`;
  cppt += `Risiko Komplikasi Berat: ${complication}`;

  return {
    totalScore: score,
    riskClass,
    majorComplicationRisk: complication,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 2. TUMOR LYSIS SYNDROME (CAIRO-BISHOP)
// ==========================================

export interface TlsInput {
  uricAcidMgDl: number; // >= 8.0 mg/dL
  potassiumMeqL: number; // >= 6.0 mEq/L
  phosphateMgDl: number; // >= 4.5 mg/dL
  calciumMgDl: number;   // <= 7.0 mg/dL
  hasClinicalCreatinineRise: boolean; // >= 1.5x ULN
  hasCardiacArrhythmia: boolean;
  hasSeizures: boolean;
}

export function evaluateCairoBishopTls(input: TlsInput): {
  isLaboratoryTls: boolean;
  isClinicalTls: boolean;
  laboratoryCriteriaMet: string[];
  clinicalCriteriaMet: string[];
  recommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  const labMet: string[] = [];
  if (input.uricAcidMgDl >= 8.0) labMet.push(`Asam Urat ${input.uricAcidMgDl} mg/dL (≥ 8.0)`);
  if (input.potassiumMeqL >= 6.0) labMet.push(`Kalium ${input.potassiumMeqL} mEq/L (≥ 6.0)`);
  if (input.phosphateMgDl >= 4.5) labMet.push(`Fosfat ${input.phosphateMgDl} mg/dL (≥ 4.5)`);
  if (input.calciumMgDl <= 7.0) labMet.push(`Kalsium ${input.calciumMgDl} mg/dL (≤ 7.0)`);

  const isLaboratoryTls = labMet.length >= 2;

  const clinMet: string[] = [];
  if (input.hasClinicalCreatinineRise) clinMet.push('Gagal ginjal akut (Kreatinin ≥ 1.5x ULN)');
  if (input.hasCardiacArrhythmia) clinMet.push('Aritmia jantung letal / henti jantung');
  if (input.hasSeizures) clinMet.push('Kejang / status konvulsivus');

  const isClinicalTls = isLaboratoryTls && clinMet.length >= 1;
  const alerts: GuardrailAlert[] = [];
  let recommendation = '';

  if (isClinicalTls) {
    recommendation = 'CITO Tatalaksana Tumor Lysis Syndrome Klinis: 1) Hidrasi agresif kristaloid 2500-3000 mL/m²/hari dengan target urin > 100 mL/m²/jam, 2) Rasburicase 0.2 mg/kg IV atau Allopurinol 300 mg/hari (bila Rasburicase kontraindikasi G6PD), 3) Terapi hiperkalemia CITO, 4) Evaluasi CITO Hemodialisis bila oliguria/anuria.';
    alerts.push({
      severity: 'danger',
      title: 'EMERGENSI TUMOR LYSIS SYNDROME KLINIS (TLS)',
      message: 'Kombinasi kelainan metabolik dan disfungsi organ (ginjal/aritmia/kejang). Pasien membutuhkan penanganan resusitasi intensif di ICU dan evaluasi hemodialisis cito.',
    });
  } else if (isLaboratoryTls) {
    recommendation = 'Laboratory TLS Terpenuhi (≥ 2 parameter lab). Mulai hidrasi hipervolemik terarah dan agen penurun asam urat (Allopurinol / Rasburicase). Monitor elektrolit serial tiap 6-8 jam.';
    alerts.push({
      severity: 'warning',
      title: 'Laboratory Tumor Lysis Syndrome Terdeteksi',
      message: 'Cegah progresivitas menjadi Clinical TLS dengan hidrasi adekuat dan koreksi asam urat agresif.',
    });
  } else {
    recommendation = 'Parameter belum memenuhi kriteria Cairo-Bishop TLS. Lanjutkan profilaksis hidrasi rutin pra-kemoterapi.';
  }

  let cppt = `[AdjustrHOM CDSS] TUMOR LYSIS SYNDROME (CAIRO-BISHOP)\n`;
  cppt += `Status: ${isClinicalTls ? 'CLINICAL TLS' : isLaboratoryTls ? 'LABORATORY TLS' : 'Bukan TLS'}\n`;
  if (labMet.length > 0) cppt += `- Kriteria Lab: ${labMet.join(', ')}\n`;
  if (clinMet.length > 0) cppt += `- Kriteria Klinis: ${clinMet.join(', ')}\n`;
  cppt += `Rekomendasi: ${recommendation}`;

  return {
    isLaboratoryTls,
    isClinicalTls,
    laboratoryCriteriaMet: labMet,
    clinicalCriteriaMet: clinMet,
    recommendation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 3. CALVERT FORMULA (CARBOPLATIN DOSING)
// ==========================================

export function calculateCalvertCarboplatin(
  targetAuc: number, // e.g. 4, 5, 6
  crClMlMin: number
): {
  targetAuc: number;
  effectiveCrCl: number;
  isCrClCapped: boolean;
  carboplatinDoseMg: number;
  cpptFormat: string;
} {
  // FDA / ASCO Safety Cap: GFR capped at 125 mL/min to prevent overdosing
  const isCrClCapped = crClMlMin > 125;
  const effectiveCrCl = Math.min(125, Math.max(0, crClMlMin));
  const dose = targetAuc * (effectiveCrCl + 25);
  const carboplatinDoseMg = Math.round(dose);

  let cppt = `[AdjustrHOM CDSS] DOSIS KARBOPLATIN (FORMULA CALVERT)\n`;
  cppt += `Target AUC: ${targetAuc} | CrCl Efektif: ${effectiveCrCl.toFixed(1)} mL/min ${isCrClCapped ? '(Dicap pada ambang batas aman 125 mL/min)' : ''}\n`;
  cppt += `Formula: Dosis = AUC x (CrCl + 25)\n`;
  cppt += `Total Dosis Karboplatin: ${carboplatinDoseMg} mg IV`;

  return {
    targetAuc,
    effectiveCrCl,
    isCrClCapped,
    carboplatinDoseMg,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 4. KHORANA SCORE (CANCER-ASSOCIATED VTE)
// ==========================================

export interface KhoranaInput {
  siteOfCancer: 'very_high' | 'high' | 'other'; // very high: stomach, pancreas (2); high: lung, lymphoma, gync, bladder, testicular (1); other (0)
  plateletCountAtLeast350k: boolean;            // +1
  hemoglobinBelow10OrEpo: boolean;              // +1
  leukocyteCountAbove11k: boolean;              // +1
  bmiAtLeast35: boolean;                        // +1
}

export function calculateKhorana(input: KhoranaInput): {
  totalScore: number;
  riskCategory: 'Low Risk (0)' | 'Intermediate Risk (1-2)' | 'High Risk (≥ 3)';
  prophylaxisRecommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  let score = 0;
  if (input.siteOfCancer === 'very_high') score += 2;
  else if (input.siteOfCancer === 'high') score += 1;

  if (input.plateletCountAtLeast350k) score += 1;
  if (input.hemoglobinBelow10OrEpo) score += 1;
  if (input.leukocyteCountAbove11k) score += 1;
  if (input.bmiAtLeast35) score += 1;

  let riskCategory: 'Low Risk (0)' | 'Intermediate Risk (1-2)' | 'High Risk (≥ 3)' = 'Low Risk (0)';
  let prophylaxis = 'Profilaksis farmakologis rutin tidak diindikasikan pada rawat jalan.';
  const alerts: GuardrailAlert[] = [];

  if (score >= 3) {
    riskCategory = 'High Risk (≥ 3)';
    prophylaxis = 'Direkomendasikan tromboprofilaksis primer rawat jalan (DOAC: Apixaban 2.5 mg bid atau Rivaroxaban 10 mg qd; atau LMWH Enoxaparin 40 mg qd) selama kemoterapi sistemik, asalkan tidak ada perdarahan aktif atau trombositopenia berat (< 50.000/µL).';
    alerts.push({
      severity: 'warning',
      title: 'Risiko Tinggi Tromboemboli Vena (Khorana ≥ 3)',
      message: 'Risiko VTE 6 bulan mencapai ~6.7-11%. Evaluasi indikasi tromboprofilaksis farmakologis primer sesuai konsensus ASCO/ITAC.',
    });
  } else if (score >= 1) {
    riskCategory = 'Intermediate Risk (1-2)';
    prophylaxis = 'Risiko VTE sedang (~2%). Edukasi tanda klinis DVT/PE dan mobilisasi aktif.';
  }

  let cppt = `[AdjustrHOM CDSS] KHORANA SCORE (CANCER VTE RISK)\n`;
  cppt += `Total Skor: ${score} poin -> ${riskCategory}\n`;
  cppt += `Rekomendasi Profilaksis: ${prophylaxis}`;

  return {
    totalScore: score,
    riskCategory,
    prophylaxisRecommendation: prophylaxis,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 5. 4Ts SCORE (HEPARIN-INDUCED THROMBOCYTOPENIA)
// ==========================================

export interface FourTsInput {
  thrombocytopeniaScore: 0 | 1 | 2; // >50% drop & nadir >=20 (2); 30-50% drop or nadir 10-19 (1); <30% drop or nadir <10 (0)
  timingScore: 0 | 1 | 2;           // Days 5-10 or <=1 with recent heparin (2); >day 10 or uncertain (1); <day 4 without recent (0)
  thrombosisScore: 0 | 1 | 2;       // Proven new thrombosis / necrosis (2); progressive/recurrent (1); none (0)
  otherCausesScore: 0 | 1 | 2;      // None apparent (2); possible (1); definite other cause (0)
}

export function calculateFourTs(input: FourTsInput): {
  totalScore: number;
  probability: 'High Probability (6-8)' | 'Intermediate Probability (4-5)' | 'Low Probability (≤ 3)';
  managementRecommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  const score = input.thrombocytopeniaScore + input.timingScore + input.thrombosisScore + input.otherCausesScore;

  let probability: 'High Probability (6-8)' | 'Intermediate Probability (4-5)' | 'Low Probability (≤ 3)' = 'Low Probability (≤ 3)';
  let management = 'Kemungkinan HIT sangat rendah (NPV > 99%). Lanjutkan heparin bila ada indikasi; investigasi penyebab trombositopenia lain.';
  const alerts: GuardrailAlert[] = [];

  if (score >= 6) {
    probability = 'High Probability (6-8)';
    management = 'CITO STOP SEMUA BENTUK HEPARIN (termasuk heparin flush). Mulai antikoagulan non-heparin alternatif (Fondaparinux / Argatroban). Kirim pemeriksaan antibodi anti-PF4/heparin. JANGAN berikan transfusi trombosit kecuali ada perdarahan mayor mengancam jiwa!';
    alerts.push({
      severity: 'danger',
      title: 'Probabilitas Tinggi HIT (4Ts Skor 6-8)',
      message: 'Hentikan heparin seketika. Jangan menunggu hasil antibodi HIT untuk menghentikan heparin karena risiko komplikasi trombosis arterial/vena baru sangat tinggi (prothrombotic state).',
    });
  } else if (score >= 4) {
    probability = 'Intermediate Probability (4-5)';
    management = 'Probabilitas sedang (~10-14%). Pertimbangkan penghentian heparin dan ganti ke antikoagulan non-heparin sambil menunggu pemeriksaan antibodi anti-PF4.';
    alerts.push({
      severity: 'warning',
      title: 'Probabilitas Sedang HIT (4Ts Skor 4-5)',
      message: 'Waspadai trombosis baru. Evaluasi rasionalitas heparin vs antikoagulan alternatif non-heparin.',
    });
  }

  let cppt = `[AdjustrHOM CDSS] 4Ts SCORE FOR HIT\n`;
  cppt += `Total Skor 4Ts: ${score} poin -> ${probability}\n`;
  cppt += `Rekomendasi Tatalaksana: ${management}`;

  return {
    totalScore: score,
    probability,
    managementRecommendation: management,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 6. PLASMIC SCORE FOR TTP (THROMBOTIC THROMBOCYTOPENIC PURPURA)
// ==========================================

export interface PlasmicInput {
  plateletsBelow30k: boolean;          // +1
  hemolysisPresent: boolean;           // +1 (reticulocyte >2.5%, haptoglobin undetectable, or indirect bili >2)
  noActiveCancerInPastYear: boolean;   // +1
  noSolidOrganOrStemCellTransplant: boolean; // +1
  mcvBelow90: boolean;                 // +1
  inrBelow15: boolean;                 // +1
  creatinineBelow20: boolean;          // +1
}

export function calculatePlasmic(input: PlasmicInput): {
  totalScore: number;
  riskCategory: 'High Risk (6-7): Severe ADAMTS13 Deficiency' | 'Intermediate Risk (5)' | 'Low Risk (0-4)';
  alerts: GuardrailAlert[];
  managementRecommendation: string;
  cpptFormat: string;
} {
  let score = 0;
  if (input.plateletsBelow30k) score++;
  if (input.hemolysisPresent) score++;
  if (input.noActiveCancerInPastYear) score++;
  if (input.noSolidOrganOrStemCellTransplant) score++;
  if (input.mcvBelow90) score++;
  if (input.inrBelow15) score++;
  if (input.creatinineBelow20) score++;

  let riskCategory: 'High Risk (6-7): Severe ADAMTS13 Deficiency' | 'Intermediate Risk (5)' | 'Low Risk (0-4)' = 'Low Risk (0-4)';
  let management = 'Kemungkinan TTP rendah (defisiensi ADAMTS13 < 10% sangat kecil). Cari etiologi TMA atau sitopenia lainnya.';
  const alerts: GuardrailAlert[] = [];

  if (score >= 6) {
    riskCategory = 'High Risk (6-7): Severe ADAMTS13 Deficiency';
    management = 'CITO TERAPI TTP: 1) CITO Plasma Exchange (PEX) 1-1.5 plasma volume harian dengan FFP pengganti, 2) Kortikosteroid dosis tinggi (Metilprednisolon 1 g/hari IV selama 3 hari lalu Prednison 1 mg/kg/hari), 3) Pertimbangkan Rituximab atau Caplacizumab bila tersedia.';
    alerts.push({
      severity: 'danger',
      title: 'KONTRAINDIKASI MUTLAK: JANGAN TRANSFUSI TROMBOSIT PADA TTP!',
      message: 'Transfusi trombosit pada TTP dapat "menyiram bensin ke dalam api" memicu trombosis mikrovaskular letal, infark miokard, stroke, atau kematian mendadak! Transfusi trombosit HANYA diberikan bila ada perdarahan intrakranial atau perdarahan fatal yang terdokumentasi.',
    });
    alerts.push({
      severity: 'danger',
      title: 'EMERGENSI HEMATOLOGI TTP (PLASMIC Skor 6-7)',
      message: 'Mortalitas TTP tanpa terapi mencapai 90%. Segera mulai Plasma Exchange (PEX) dan kortikosteroid tanpa menunggu hasil uji aktivitas ADAMTS13.',
    });
  } else if (score === 5) {
    riskCategory = 'Intermediate Risk (5)';
    management = 'Probabilitas sedang defisiensi ADAMTS13 (~5-24%). Observasi ketat, kirim sampel ADAMTS13, pertimbangkan infus plasma bila PEX belum siap.';
  }

  let cppt = `[AdjustrHOM CDSS] PLASMIC SCORE FOR TTP\n`;
  cppt += `Total Skor PLASMIC: ${score} / 7 poin -> ${riskCategory}\n`;
  cppt += `Tatalaksana: ${management}`;

  return {
    totalScore: score,
    riskCategory,
    alerts,
    managementRecommendation: management,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 7. GANZONI FORMULA (IRON DEFICIT) & PRC ESTIMATOR
// ==========================================

export function calculateGanzoni(
  bodyWeightKg: number,
  actualHbGDl: number,
  targetHbGDl = 15.0,
  ironDepotMg = 500
): {
  bodyWeightKg: number;
  actualHbGDl: number;
  targetHbGDl: number;
  totalIronDeficitMg: number;
  ampoulesIronSucrose100mg: number;
  cpptFormat: string;
} {
  const hbDelta = Math.max(0, targetHbGDl - actualHbGDl);
  const totalDeficit = bodyWeightKg * hbDelta * 2.4 + ironDepotMg;
  const totalIronDeficitMg = Math.round(totalDeficit);
  const ampoulesIronSucrose100mg = Math.ceil(totalIronDeficitMg / 100);

  let cppt = `[AdjustrHOM CDSS] DEFISIT BESI (FORMULA GANZONI)\n`;
  cppt += `BB: ${bodyWeightKg} kg | Hb Aktual: ${actualHbGDl} g/dL -> Target: ${targetHbGDl} g/dL\n`;
  cppt += `Formula: [BB x (Target Hb - Hb Aktual) x 2.4] + Depot Besi (500 mg)\n`;
  cppt += `Total Kebutuhan Besi Elemental: ${totalIronDeficitMg} mg (~${ampoulesIronSucrose100mg} ampul Iron Sucrose / Venofer @ 100 mg)`;

  return {
    bodyWeightKg,
    actualHbGDl,
    targetHbGDl,
    totalIronDeficitMg,
    ampoulesIronSucrose100mg,
    cpptFormat: cppt.trim(),
  };
}

export function calculatePrcTransfusion(
  bodyWeightKg: number,
  actualHbGDl: number,
  targetHbGDl = 10.0
): {
  bodyWeightKg: number;
  actualHbGDl: number;
  targetHbGDl: number;
  volumePrcMl: number;
  estimatedBagsPrc: number;
  cpptFormat: string;
} {
  const deltaHb = Math.max(0, targetHbGDl - actualHbGDl);
  const volumePrcMl = Math.round(deltaHb * bodyWeightKg * 3.0); // 3-4 mL/kg per 1 g/dL rise
  const estimatedBagsPrc = Math.ceil(volumePrcMl / 250); // standard ~250 mL per PRC bag

  let cppt = `[AdjustrHOM CDSS] ESTIMASI KEBUTUHAN TRANSFUSI PRC\n`;
  cppt += `BB: ${bodyWeightKg} kg | Hb Saat Ini: ${actualHbGDl} g/dL -> Target: ${targetHbGDl} g/dL (ΔHb: ${deltaHb.toFixed(1)} g/dL)\n`;
  cppt += `Kebutuhan Volume PRC: ~${volumePrcMl} mL (~${estimatedBagsPrc} kolf / bag @ 250 mL)\n`;
  cppt += `Catatan: Berikan 1-2 kolf per hari dengan interval, evaluasi furosemide 20 mg IV di antara kolf pada risiko kelebihan cairan (TACO).`;

  return {
    bodyWeightKg,
    actualHbGDl,
    targetHbGDl,
    volumePrcMl,
    estimatedBagsPrc,
    cpptFormat: cppt.trim(),
  };
}
