/**
 * internize.ai — RheumaTools Engine (Reumatologi & Imunologi Klinis)
 * Ported directly from drguswib RheumaTools CDSS.
 * 100% on-device deterministic execution (Zero Egress Invariant).
 */

import { GuardrailAlert } from './types';

// ==========================================
// 1. RHEUMATOID ARTHRITIS (ACR/EULAR 2010)
// ==========================================

export interface AcrEular2010RaInput {
  jointInvolvement: '1_large' | '2_to_10_large' | '1_to_3_small' | '4_to_10_small' | 'more_than_10_joints';
  serology: 'negative' | 'low_positive' | 'high_positive'; // low pos: <= 3x ULN; high pos: > 3x ULN
  acutePhaseReactants: 'normal' | 'abnormal'; // abnormal CRP or ESR
  durationOfSymptoms: 'less_than_6_weeks' | 'at_least_6_weeks';
}

export interface RaClassificationResult {
  totalScore: number;
  isDefiniteRa: boolean;
  classificationTitle: string;
  recommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function evaluateAcrEularRa(input: AcrEular2010RaInput): RaClassificationResult {
  let score = 0;

  // Joint involvement
  if (input.jointInvolvement === 'more_than_10_joints') score += 5;
  else if (input.jointInvolvement === '4_to_10_small') score += 3;
  else if (input.jointInvolvement === '1_to_3_small') score += 2;
  else if (input.jointInvolvement === '2_to_10_large') score += 1;

  // Serology
  if (input.serology === 'high_positive') score += 3;
  else if (input.serology === 'low_positive') score += 2;

  // Acute-phase reactants
  if (input.acutePhaseReactants === 'abnormal') score += 1;

  // Duration
  if (input.durationOfSymptoms === 'at_least_6_weeks') score += 1;

  const isDefiniteRa = score >= 6;
  const classificationTitle = isDefiniteRa
    ? 'Memenuhi Kriteria Klasifikasi Artritis Reumatoid (Skor ≥ 6/10)'
    : 'Belum Memenuhi Kriteria Klasifikasi Definitif RA (Skor < 6/10)';

  const alerts: GuardrailAlert[] = [];
  let recommendation = '';

  if (isDefiniteRa) {
    recommendation = 'Inisiasi Terapi csDMARD Lini Pertama Dini: Metotreksat (MTX) oral 7.5 - 15 mg/minggu + Asam Folat 5 mg/minggu (diberikan 24-48 jam setelah MTX) sesuai rekomendasi IRA 2021 & EULAR. Bridging glukokortikoid dosis rendah (Metilprednisolon ≤ 4-8 mg/hari) jangka pendek bila diperlukan.';
  } else {
    recommendation = 'Evaluasi ulang dan pantau perkembangan sinovitis sendi secara berkala. Singkirkan diferensial artritis lain (SLE, Artritis Psoriatik, Spondiloartropati, atau Viral Artritis).';
  }

  let cppt = `[RheumaTools CDSS] KRITERIA KLASIFIKASI RA (ACR/EULAR 2010)\n`;
  cppt += `Total Skor: ${score} / 10 poin -> ${classificationTitle}\n`;
  cppt += `Rekomendasi Tatalaksana: ${recommendation}`;

  return {
    totalScore: score,
    isDefiniteRa,
    classificationTitle,
    recommendation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 2. DAS28-CRP & DAS28-ESR (DISEASE ACTIVITY SCORE)
// ==========================================

export interface Das28CrpInput {
  tenderJointCount28: number;  // 0 - 28
  swollenJointCount28: number; // 0 - 28
  crpMgL: number;              // mg/L
  patientGlobalAssessment0To100: number; // 0 - 100 mm VAS
}

export interface Das28EsrInput {
  tenderJointCount28: number;
  swollenJointCount28: number;
  esrMmHr: number;             // mm/hr
  patientGlobalAssessment0To100: number;
}

export interface Das28Result {
  score: number;
  activityLevel: 'Remission' | 'Low' | 'Moderate' | 'High';
  activityLabel: string;
  clinicalGuidance: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateDas28Crp(input: Das28CrpInput): Das28Result {
  const t = Math.max(0, Math.min(28, input.tenderJointCount28));
  const s = Math.max(0, Math.min(28, input.swollenJointCount28));
  const c = Math.max(0, input.crpMgL);
  const p = Math.max(0, Math.min(100, input.patientGlobalAssessment0To100));

  const raw = 0.56 * Math.sqrt(t) + 0.28 * Math.sqrt(s) + 0.36 * Math.log(c + 1) + 0.014 * p + 0.96;
  const score = Math.round(raw * 100) / 100;

  return formatDas28Output(score, 'DAS28-CRP');
}

export function calculateDas28Esr(input: Das28EsrInput): Das28Result {
  const t = Math.max(0, Math.min(28, input.tenderJointCount28));
  const s = Math.max(0, Math.min(28, input.swollenJointCount28));
  const e = Math.max(1, input.esrMmHr);
  const p = Math.max(0, Math.min(100, input.patientGlobalAssessment0To100));

  const raw = 0.56 * Math.sqrt(t) + 0.28 * Math.sqrt(s) + 0.70 * Math.log(e) + 0.014 * p;
  const score = Math.round(raw * 100) / 100;

  return formatDas28Output(score, 'DAS28-LED/ESR');
}

function formatDas28Output(score: number, typeLabel: string): Das28Result {
  let activityLevel: 'Remission' | 'Low' | 'Moderate' | 'High' = 'Remission';
  let activityLabel = 'Remisi Klinis (Clinical Remission)';
  let guidance = 'Target klinis tercapai (DAS28 ≤ 2.60). Lanjutkan pemantauan rutin dan evaluasi de-eskalasi bila stabil > 6 bulan.';
  const alerts: GuardrailAlert[] = [];

  if (score > 5.10) {
    activityLevel = 'High';
    activityLabel = 'Aktivitas Tinggi (High Disease Activity)';
    guidance = 'Indikasi eskalasi agresif terapi DMARD kombinasi / biologik (bDMARD / tsDMARD) menurut rekomendasi IRA & EULAR Treat-to-Target.';
    alerts.push({
      severity: 'warning',
      title: 'Aktivitas Penyakit RA Tinggi (DAS28 > 5.10)',
      message: 'Risiko erosi tulang dan deformitas sendi ireversibel tinggi. Jadwalkan evaluasi respons klinis dalam 1-3 bulan.',
    });
  } else if (score > 3.20) {
    activityLevel = 'Moderate';
    activityLabel = 'Aktivitas Sedang (Moderate Activity)';
    guidance = 'Aktivitas moderat; pertimbangkan optimasi dosis csDMARD (misal MTX dinaikkan hingga 20-25 mg/minggu) atau kombinasi dengan Sulfasalazin / Klorokuin.';
  } else if (score > 2.60) {
    activityLevel = 'Low';
    activityLabel = 'Aktivitas Rendah (Low Activity)';
    guidance = 'Aktivitas terkontrol rendah; pertahankan terapi sesuai target Treat-to-Target (T2T).';
  }

  let cppt = `[RheumaTools CDSS] SKOR AKTIVITAS ${typeLabel}\n`;
  cppt += `Skor ${typeLabel}: ${score.toFixed(2)} -> ${activityLabel}\n`;
  cppt += `Arahan Klinis: ${guidance}`;

  return {
    score,
    activityLevel,
    activityLabel,
    clinicalGuidance: guidance,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 3. SLE ACTIVITY: MEX-SLEDAI & SLEDAI-2K
// ==========================================

export interface MexSledaiInput {
  neurologicalActive?: boolean; // Seizures, psychosis, organic brain (8)
  renalActive?: boolean;        // Proteinuria >0.5g/24h, casts, hematuria (6)
  vasculitis?: boolean;         // Ulcers, gangrene, purpura (4)
  hemolysisOrThrombocytopenia?: boolean; // Plt <100k or Coombs+ anemia (3)
  myositis?: boolean;           // (3)
  arthritis?: boolean;          // (2)
  mucocutaneous?: boolean;      // Rash, alopecia, mucosal ulcers (2)
  serositis?: boolean;          // Pleurisy or pericarditis (2)
  fever?: boolean;              // >38C not infection (1)
  fatigueOrLeukopenia?: boolean;// WBC <4000 (1)
}

export function calculateMexSledai(input: MexSledaiInput): {
  totalScore: number;
  activityLevel: 'Inaktif / Remisi' | 'Aktivitas Ringan' | 'Aktivitas Sedang' | 'Aktivitas Berat / Flare Mayor';
  recommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  let score = 0;
  if (input.neurologicalActive) score += 8;
  if (input.renalActive) score += 6;
  if (input.vasculitis) score += 4;
  if (input.hemolysisOrThrombocytopenia) score += 3;
  if (input.myositis) score += 3;
  if (input.arthritis) score += 2;
  if (input.mucocutaneous) score += 2;
  if (input.serositis) score += 2;
  if (input.fever) score += 1;
  if (input.fatigueOrLeukopenia) score += 1;

  let activityLevel: 'Inaktif / Remisi' | 'Aktivitas Ringan' | 'Aktivitas Sedang' | 'Aktivitas Berat / Flare Mayor' = 'Inaktif / Remisi';
  let recommendation = 'Penyakit inaktif dalam 30 hari terakhir. Lanjutkan Hidroksiklorokuin (HCQ) 200-400 mg/hari sebagai terapi dasar protektif organ.';
  const alerts: GuardrailAlert[] = [];

  if (score >= 10) {
    activityLevel = 'Aktivitas Berat / Flare Mayor';
    recommendation = 'Keterlibatan organ vital aktif (Lupus Nefritis / Neuropsikiatri SLE / Vaskulitis berat). Indikasi rawat inap, pulse Metilprednisolon IV 500-1000 mg/hari selama 3 hari, dan imunosupresan induksi (Mikofenolat Mofetil / Siklofosfamid IV).';
    alerts.push({
      severity: 'danger',
      title: 'FLARE MAYOR LUPUS AKTIF (MEX-SLEDAI ≥ 10)',
      message: 'Keterlibatan organ mayor mengancam fungsi ginjal atau neurologis. Lakukan pemeriksaan urine tampung 24 jam / UPCR, C3/C4, anti-dsDNA, dan konsultasi Sp.PD Konsultan Reumatologi.',
    });
  } else if (score >= 6) {
    activityLevel = 'Aktivitas Sedang';
    recommendation = 'Flare derajat sedang. Tingkatkan glukokortikoid (Metilprednisolon 16-32 mg/hari) dan optimasi DMARD (Azatioprin / MTX).';
    alerts.push({
      severity: 'warning',
      title: 'Aktivitas Lupus Moderat (MEX-SLEDAI 6 - 9)',
      message: 'Evaluasi kemungkinan transisi flare organ dan sesuaikan dosis imunosupresan.',
    });
  } else if (score >= 2) {
    activityLevel = 'Aktivitas Ringan';
    recommendation = 'Aktivitas ringan (dominan mukokutan / artritis). Hidroksiklorokuin diteruskan + steroid dosis rendah jangka pendek.';
  }

  let cppt = `[RheumaTools CDSS] INDEKS AKTIVITAS LUPUS (MEX-SLEDAI)\n`;
  cppt += `Total Skor: ${score} poin -> ${activityLevel}\n`;
  cppt += `Rekomendasi Tatalaksana: ${recommendation}`;

  return {
    totalScore: score,
    activityLevel,
    recommendation,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 4. GOUT CLASSIFICATION (ACR/EULAR 2015)
// ==========================================

export interface GoutClassificationInput {
  jointPattern: 'mtp1_involvement' | 'ankle_or_midfoot' | 'other_joint'; // 2, 1, 0
  clinicalCharacteristicsCount: number; // 1 (1 pt), 2 (2 pts), 3 (3 pts): erythema, inability to bear weight, max pain <24h
  timeCourseTypicalEpisodes: 'none' | 'one_episode' | 'recurrent_typical'; // 0, 1, 2
  clinicalTophiPresent: boolean; // +4
  serumUricAcidMgDl: number; // <4 (-4), 4-5.9 (0), 6-7.9 (1), 8-9.9 (2), 10+ (3)
  imagingProofUltrasoundOrDeCT?: boolean; // +4
}

export function evaluateAcrEularGout(input: GoutClassificationInput): {
  totalScore: number;
  isGoutClassified: boolean;
  classificationTitle: string;
  uricAcidTarget: string;
  recommendation: string;
  cpptFormat: string;
} {
  let score = 0;

  // Joint Pattern
  if (input.jointPattern === 'mtp1_involvement') score += 2;
  else if (input.jointPattern === 'ankle_or_midfoot') score += 1;

  // Clinical Characteristics
  if (input.clinicalCharacteristicsCount >= 3) score += 3;
  else if (input.clinicalCharacteristicsCount === 2) score += 2;
  else if (input.clinicalCharacteristicsCount === 1) score += 1;

  // Time course
  if (input.timeCourseTypicalEpisodes === 'recurrent_typical') score += 2;
  else if (input.timeCourseTypicalEpisodes === 'one_episode') score += 1;

  // Tophi
  if (input.clinicalTophiPresent) score += 4;

  // Serum Uric Acid
  if (input.serumUricAcidMgDl >= 10.0) score += 3;
  else if (input.serumUricAcidMgDl >= 8.0) score += 2;
  else if (input.serumUricAcidMgDl >= 6.0) score += 1;
  else if (input.serumUricAcidMgDl < 4.0) score -= 4;

  // Imaging
  if (input.imagingProofUltrasoundOrDeCT) score += 4;

  const isGoutClassified = score >= 8;
  const classificationTitle = isGoutClassified
    ? 'Terklasifikasi sebagai Artritis Gout Definitif (Skor ≥ 8/23)'
    : 'Belum Memenuhi Kriteria Klasifikasi Gout (Skor < 8/23)';

  const uricAcidTarget = input.clinicalTophiPresent
    ? '< 5.0 mg/dL (Gout Kronis Bertofus / Erosi Sendi)'
    : '< 6.0 mg/dL (Gout Tanpa Tofus)';

  let recommendation = '';
  if (isGoutClassified) {
    recommendation = `1. Fase Akut: Kolkisin oral 1 mg loading dilanjutkan 0.5 mg 1 jam kemudian, atau NSAID (Celecoxib 2x200 mg / Natrium Diklofenak 2x50 mg), atau Kortikosteroid oral bila gangguan ginjal.
2. Fase Profilaksis & Urate-Lowering Therapy (ULT): Inisiasi Allopurinol 100 mg/hari (titrasi tiap 2-4 minggu hingga target asam urat ${uricAcidTarget}) + profilaksis serangan Kolkisin 0.5 mg/hari selama 3-6 bulan pertama.`;
  } else {
    recommendation = 'Evaluasi diferensial artritis kristal lain (Pseudogout / CPPD) atau septik artritis bila terdapat efusi sendi akut.';
  }

  let cppt = `[RheumaTools CDSS] KRITERIA KLASIFIKASI GOUT (ACR/EULAR 2015)\n`;
  cppt += `Total Skor: ${score} / 23 poin -> ${classificationTitle}\n`;
  cppt += `Target Kadar Asam Urat: ${uricAcidTarget}\n`;
  cppt += `Rekomendasi Tatalaksana: ${recommendation}`;

  return {
    totalScore: score,
    isGoutClassified,
    classificationTitle,
    uricAcidTarget,
    recommendation,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 5. PSORIATIC ARTHRITIS: CASPAR CRITERIA
// ==========================================

export interface CasparInput {
  hasInflammatoryArticularDisease: boolean; // Mandatori
  currentPsoriasis?: boolean;   // +2 (or personal history: +1, family history: +1)
  personalHistoryPsoriasisOnly?: boolean;
  familyHistoryPsoriasisOnly?: boolean;
  psoriaticNailDystrophy?: boolean; // +1
  negativeRheumatoidFactor?: boolean; // +1
  dactylitisCurrentOrHistory?: boolean; // +1
  radiologicalJuxtaArticularNewBone?: boolean; // +1
}

export function evaluateCasparCriteria(input: CasparInput): {
  totalScore: number;
  isPsaClassified: boolean;
  classificationTitle: string;
  cpptFormat: string;
} {
  if (!input.hasInflammatoryArticularDisease) {
    return {
      totalScore: 0,
      isPsaClassified: false,
      classificationTitle: 'Kriteria Eksklusi: Pasien harus memiliki bukti penyakit artikular inflamasi (sendi/tulang belakang/entesis).',
      cpptFormat: `[RheumaTools CDSS] CASPAR Criteria: Pasien tidak memiliki penyakit inflamasi artikular dasar.`,
    };
  }

  let score = 0;
  if (input.currentPsoriasis) score += 2;
  else if (input.personalHistoryPsoriasisOnly) score += 1;
  else if (input.familyHistoryPsoriasisOnly) score += 1;

  if (input.psoriaticNailDystrophy) score += 1;
  if (input.negativeRheumatoidFactor) score += 1;
  if (input.dactylitisCurrentOrHistory) score += 1;
  if (input.radiologicalJuxtaArticularNewBone) score += 1;

  const isPsaClassified = score >= 3;
  const classificationTitle = isPsaClassified
    ? 'Terklasifikasi sebagai Psoriatic Arthritis (CASPAR Skor ≥ 3)'
    : 'Belum Memenuhi Kriteria CASPAR (Skor < 3)';

  let cppt = `[RheumaTools CDSS] KRITERIA CASPAR (PSORIATIC ARTHRITIS)\n`;
  cppt += `Total Skor CASPAR: ${score} poin -> ${classificationTitle}`;

  return {
    totalScore: score,
    isPsaClassified,
    classificationTitle,
    cpptFormat: cppt.trim(),
  };
}
