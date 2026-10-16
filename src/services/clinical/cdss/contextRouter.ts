/**
 * internize.ai — CDSS Context Router
 * Automatically maps patient clinical findings, problems, labs, and vitals
 * to the most relevant drguswib CDSS calculators, prefilling calculation inputs.
 * 100% on-device, deterministic execution.
 */

import { CdssSuiteId } from './types';
import { ANTIMICROBIAL_DATABASE } from './adjustrIoEngine';

export interface PatientContextSnapshot {
  age?: number;
  gender?: 'male' | 'female';
  weightKg?: number;
  heightCm?: number;
  vitals?: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    temp?: number;
    rr?: number;
    spo2?: number;
  };
  labs?: {
    creatinine?: number;
    bun?: number;
    ureum?: number;
    sodium?: number;
    potassium?: number;
    calcium?: number;
    albumin?: number;
    glucose?: number;
    hemoglobin?: number;
    platelets?: number;
    ast?: number;
    alt?: number;
    bilirubin?: number;
    inr?: number;
    hba1c?: number;
    ph?: number;
    pco2?: number;
    hco3?: number;
    pao2?: number;
    fio2?: number;
    uricAcid?: number;
    esr?: number;
    crp?: number;
  };
  diagnoses?: string[];
  medications?: string[];
}

export interface RoutedCalculatorSuggestion {
  calculatorId: string;
  calculatorName: string;
  suite: CdssSuiteId;
  reason: string;
  priority: 'high' | 'medium';
  prefilledInputs: Record<string, any>;
}

/**
 * Route clinical context to relevant CDSS calculators with prefilled parameters
 */
export function routeClinicalContextToCalculators(
  context: PatientContextSnapshot
): RoutedCalculatorSuggestion[] {
  const suggestions: RoutedCalculatorSuggestion[] = [];
  const labs = context.labs || {};
  const vitals = context.vitals || {};
  const diagnoses = (context.diagnoses || []).map((d) => d.toLowerCase());
  const meds = (context.medications || []).map((m) => m.toLowerCase());

  // 1. ANTIMICROBIAL RENAL DOSING (ADJUSTR.IO)
  // Check if patient is taking any drug in the 36-antimicrobial database
  const drugKeys = Object.keys(ANTIMICROBIAL_DATABASE);
  for (const drugKey of drugKeys) {
    const drug = ANTIMICROBIAL_DATABASE[drugKey];
    const keyClean = drugKey.replace(/-/g, ' ').toLowerCase();
    const namePrefix = drug.name.toLowerCase().split(' ')[0];
    const isMedMatched = meds.some(
      (m) => m.includes(keyClean) || m.includes(namePrefix)
    );

    if (isMedMatched) {
      suggestions.push({
        calculatorId: `adjustr-io-${drugKey}`,
        calculatorName: `ADJUSTR.IO: ${drug.name}`,
        suite: 'ADJUSTR_IO',
        reason: `Pasien menggunakan ${drug.name}${labs.creatinine ? ` dengan SCr ${labs.creatinine} mg/dL` : ''}. Periksa penyesuaian dosis ginjal.`,
        priority: labs.creatinine && labs.creatinine > 1.5 ? 'high' : 'medium',
        prefilledInputs: {
          drugKey,
          age: context.age ?? 55,
          gender: context.gender ?? 'male',
          weightKg: context.weightKg ?? 60,
          heightCm: context.heightCm ?? 165,
          serumCreatinine: labs.creatinine ?? 1.2,
        },
      });
      break; // Suggest top matched antimicrobial
    }
  }

  // 2. ARTERIAL BLOOD GAS (ABG / BGA)
  if (labs.ph !== undefined || labs.pco2 !== undefined || labs.hco3 !== undefined) {
    suggestions.push({
      calculatorId: 'calc-abg',
      calculatorName: 'Analisis Gas Darah (AGD / BGA) Komprehensif',
      suite: 'CALC_MED',
      reason: 'Ditemukan hasil pemeriksaan Analisis Gas Darah. Evaluasi gangguan primer, Winter compensation, Anion Gap, dan Delta Ratio.',
      priority: labs.ph !== undefined && (labs.ph < 7.30 || labs.ph > 7.50) ? 'high' : 'medium',
      prefilledInputs: {
        ph: labs.ph ?? 7.35,
        pco2: labs.pco2 ?? 40,
        hco3: labs.hco3 ?? 24,
        na: labs.sodium ?? 140,
        cl: 105,
        albumin: labs.albumin ?? 4.0,
        pao2: labs.pao2 ?? 90,
        fio2: labs.fio2 ?? 21,
        patientWeightKg: context.weightKg ?? 60,
      },
    });
  }

  // 3. VASOACTIVE DRIP SYRINGE PUMP
  const hasShock =
    (vitals.sbp !== undefined && vitals.sbp < 90) ||
    diagnoses.some((d) => d.includes('syok') || d.includes('shock') || d.includes('sepsis') || d.includes('hipotensi')) ||
    meds.some((m) => m.includes('norepi') || m.includes('dobutamin') || m.includes('dopamin'));

  if (hasShock) {
    suggestions.push({
      calculatorId: 'calc-ne',
      calculatorName: 'Titrasi Syringe Pump Norepinefrin',
      suite: 'CALC_MED',
      reason: 'Kondisi hipotensi / syok terdeteksi. Hitung tabel titrasi kecepatan syringe pump vasopresor.',
      priority: 'high',
      prefilledInputs: {
        drugType: 'norepinephrine',
        patientWeightKg: context.weightKg ?? 60,
        drugMg: 4,
        diluentVolumeMl: 50,
      },
    });
  }

  // 4. POTASSIUM MANAGEMENT (HIPO / HIPERKALEMIA)
  if (labs.potassium !== undefined && (labs.potassium < 3.5 || labs.potassium > 5.5)) {
    const isCritical = labs.potassium < 2.5 || labs.potassium > 6.0;
    suggestions.push({
      calculatorId: 'fluid-potassium',
      calculatorName: 'Koreksi Kalium (Hipo / Hiperkalemia)',
      suite: 'FLUID',
      reason: `Kadar Kalium abnormal (${labs.potassium} mEq/L). ${isCritical ? 'EMERGENSI: Risiko aritmia letal.' : 'Hitung defisit / protokol eliminasi kalium.'}`,
      priority: isCritical ? 'high' : 'medium',
      prefilledInputs: {
        kSerum: labs.potassium,
        patientWeightKg: context.weightKg ?? 60,
      },
    });
  }

  // 5. HYPONATREMIA / HYPERNATREMIA
  if (labs.sodium !== undefined && labs.sodium < 135) {
    suggestions.push({
      calculatorId: 'fluid-hyponatremia',
      calculatorName: 'Koreksi Hiponatremia (Adrogué-Madias & ODS Guardrail)',
      suite: 'FLUID',
      reason: `Kadar Natrium rendah (${labs.sodium} mEq/L). Hitung volume saline dan batasi target kenaikan untuk mencegah ODS.`,
      priority: labs.sodium < 125 ? 'high' : 'medium',
      prefilledInputs: {
        weightKg: context.weightKg ?? 60,
        gender: context.gender ?? 'male',
        isElderly: (context.age ?? 0) >= 65,
        serumNa: labs.sodium,
        targetRise24h: 8,
        infusateType: 'nacl_3_percent',
      },
    });
  } else if (labs.sodium !== undefined && labs.sodium > 145) {
    suggestions.push({
      calculatorId: 'fluid-hypernatremia',
      calculatorName: 'Koreksi Hipernatremia & Free Water Deficit (FWD)',
      suite: 'FLUID',
      reason: `Kadar Natrium tinggi (${labs.sodium} mEq/L). Hitung defisit air bebas dan laju infus D5% 48 jam.`,
      priority: labs.sodium > 155 ? 'high' : 'medium',
      prefilledInputs: {
        weightKg: context.weightKg ?? 60,
        gender: context.gender ?? 'male',
        isElderly: (context.age ?? 0) >= 65,
        serumNa: labs.sodium,
        targetNa: 140,
      },
    });
  }

  // 6. DKA SEVERITY & ADA RESOLUTION TRACKER
  const hasDkaKeywords = diagnoses.some(
    (d) => d.includes('dka') || d.includes('ketoasidosis') || d.includes('kad') || d.includes('hhs')
  );
  if (hasDkaKeywords || (labs.glucose && labs.glucose > 250 && labs.hco3 && labs.hco3 < 18)) {
    suggestions.push({
      calculatorId: 'emd-dka-tracker',
      calculatorName: 'DKA Severity & ADA Resolution Tracker',
      suite: 'EMD',
      reason: 'Kecurigaan Ketoasidosis Diabetik (KAD/DKA). Evaluasi derajat keparahan dan checklist resolusi ADA.',
      priority: 'high',
      prefilledInputs: {
        venousPh: labs.ph ?? 7.20,
        serumHco3: labs.hco3 ?? 12,
        bloodGlucose: labs.glucose ?? 350,
        anionGap: 18,
        serumPotassium: labs.potassium ?? 4.0,
        mentalStatus: 'alert',
      },
    });
  }

  // 7. HIPOGLIKEMIA
  if (labs.glucose !== undefined && labs.glucose < 70) {
    suggestions.push({
      calculatorId: 'emd-hypoglycemia',
      calculatorName: 'Koreksi Hipoglikemia Berat (Rumus 30 D40%)',
      suite: 'EMD',
      reason: `Kadar glukosa darah rendah (${labs.glucose} mg/dL). Hitung kebutuhan bolus D40% PERKENI / Rumus 30.`,
      priority: 'high',
      prefilledInputs: {
        bloodGlucoseMgDl: labs.glucose,
        targetMgDl: 100,
        isUnconscious: true,
      },
    });
  }

  // 8. BURCH-WARTOFSKY (THYROID STORM)
  const hasThyroidStormKeywords =
    diagnoses.some((d) => d.includes('tiroid') || d.includes('krisis tiroid') || d.includes('tirotoksikosis')) ||
    (vitals.hr && vitals.hr > 120 && vitals.temp && vitals.temp > 38.0);
  if (hasThyroidStormKeywords) {
    suggestions.push({
      calculatorId: 'emd-bwps',
      calculatorName: 'Burch-Wartofsky Point Scale (BWPS Krisis Tiroid)',
      suite: 'EMD',
      reason: 'Tanda takikardia dan demam dengan riwayat/kecurigaan hipertiroid. Evaluasi badai tiroid.',
      priority: 'high',
      prefilledInputs: {
        tempCelsius: vitals.temp ?? 38.5,
        cnsDysfunction: 'mild_agitation',
        giDysfunction: 'none',
        heartRate: vitals.hr ?? 125,
        congestiveHeartFailure: 'none',
        atrialFibrillation: false,
        precipitatingEventHistory: true,
      },
    });
  }

  // 9. CIRRHOSIS & LIVER FAILURE: CTP, MELD TRIO, SAAG
  const hasLiverCirrhosis = diagnoses.some(
    (d) => d.includes('sirosis') || d.includes('cirrhosis') || d.includes('hepatitis') || d.includes('asites')
  );
  if (hasLiverCirrhosis || (labs.bilirubin && labs.bilirubin > 2.0 && labs.inr && labs.inr > 1.5)) {
    suggestions.push({
      calculatorId: 'geh-ctp',
      calculatorName: 'Child-Turcotte-Pugh (CTP) & MELD Trio',
      suite: 'GEH',
      reason: 'Riwayat sirosis hepar / disfungsi sintesis hepar. Hitung stratifikasi Child-Pugh dan MELD.',
      priority: 'high',
      prefilledInputs: {
        totalBilirubin: labs.bilirubin ?? 2.5,
        serumAlbumin: labs.albumin ?? 2.8,
        inr: labs.inr ?? 1.8,
        hepaticEncephalopathyGrade: 1,
        ascitesGrade: diagnoses.some((d) => d.includes('asites')) ? 2 : 1,
      },
    });
  }

  // 10. GI BLEEDING (GBS / OAKLAND)
  const hasGiBleed = diagnoses.some(
    (d) => d.includes('hematemesis') || d.includes('melena') || d.includes('scba') || d.includes('scbb') || d.includes('perdarahan gi')
  );
  if (hasGiBleed) {
    suggestions.push({
      calculatorId: 'geh-gbs',
      calculatorName: 'Glasgow-Blatchford Score (GBS Perdarahan Saluran Cerna)',
      suite: 'GEH',
      reason: 'Kecurigaan perdarahan saluran cerna atas. Evaluasi risiko hemostasis endoskopi cito dan rawat inap.',
      priority: 'high',
      prefilledInputs: {
        bunValue: labs.ureum ? labs.ureum : (labs.bun ?? 20),
        bunUnit: labs.ureum ? 'ureum_rs' : 'bun_mg',
        hemoglobin: labs.hemoglobin ?? 9.0,
        gender: context.gender ?? 'male',
        systolicBp: vitals.sbp ?? 100,
        heartRate: vitals.hr ?? 100,
        hasMelena: diagnoses.some((d) => d.includes('melena')),
        hasSyncope: false,
        hasHepaticDisease: hasLiverCirrhosis,
        hasHeartFailure: false,
      },
    });
  }

  // 11. FEBRILE NEUTROPENIA (MASCC)
  const hasFebrileNeutropenia =
    (vitals.temp && vitals.temp >= 38.0 && diagnoses.some((d) => d.includes('neutropenia') || d.includes('kanker') || d.includes('kemoterapi'))) ||
    diagnoses.some((d) => d.includes('febril') || d.includes('neutropenia febril'));

  if (hasFebrileNeutropenia) {
    suggestions.push({
      calculatorId: 'hom-mascc',
      calculatorName: 'MASCC Risk Index (Neutropenia Febril)',
      suite: 'HOM',
      reason: 'Demam pada pasien neutropenia / post-kemoterapi. Tentukan kelayakan terapi oral vs rawat inap IV golden hour.',
      priority: 'high',
      prefilledInputs: {
        burdenOfIllness: 'none_or_mild',
        noHypotensionSbpAbove90: (vitals.sbp ?? 110) >= 90,
        noCopd: true,
        solidTumorOrNoFungal: true,
        noDehydrationRequiringIv: true,
        outpatientAtOnset: true,
        ageBelow60: (context.age ?? 50) < 60,
      },
    });
  }

  return suggestions;
}
