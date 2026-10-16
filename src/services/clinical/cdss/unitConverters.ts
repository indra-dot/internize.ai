/**
 * internize.ai — Clinical Unit Converters & Anthropometry Formulas
 *
 * Implements the unit conversions, Indonesian hospital lab standards (RSUP Prof. Ngoerah),
 * and anthropometric equations extracted from drguswib CDSS web applications.
 *
 * 100% on-device, zero-egress, deterministic.
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. Indonesian Hospital Lab Unit Converters
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts Serum Ureum (mg/dL) to Blood Urea Nitrogen / BUN (mg/dL).
 * Formula: BUN = Ureum / 2.14
 */
export function ureumToBun(ureumMgDl: number): number {
  if (ureumMgDl <= 0) return 0;
  return Number((ureumMgDl / 2.14).toFixed(2));
}

/**
 * Converts Blood Urea Nitrogen / BUN (mg/dL) to Serum Ureum (mg/dL).
 * Formula: Ureum = BUN * 2.14
 */
export function bunToUreum(bunMgDl: number): number {
  if (bunMgDl <= 0) return 0;
  return Number((bunMgDl * 2.14).toFixed(2));
}

/**
 * Converts Serum Ureum RS (mg/dL) to Urea (mmol/L).
 * Formula: Urea (mmol/L) = Ureum (mg/dL) / 6.006
 */
export function ureumRsToMmol(ureumMgDl: number): number {
  if (ureumMgDl <= 0) return 0;
  return Number((ureumMgDl / 6.006).toFixed(2));
}

/**
 * Converts BUN (mg/dL) to Urea (mmol/L).
 * Formula: Urea (mmol/L) = BUN (mg/dL) / 2.801
 */
export function bunToMmol(bunMgDl: number): number {
  if (bunMgDl <= 0) return 0;
  return Number((bunMgDl / 2.801).toFixed(2));
}

/**
 * Auto-detects whether clinical note mentions "Ureum" or "BUN".
 */
export function detectRenalLabType(text: string): 'UREUM' | 'BUN' | 'UNKNOWN' {
  const hasUreum = /\b(ureum|urea|serum\s*ureum)\b/i.test(text);
  const hasBun = /\b(bun|blood\s*urea\s*nitrogen)\b/i.test(text);

  if (hasUreum && !hasBun) return 'UREUM';
  if (hasBun && !hasUreum) return 'BUN';
  if (hasUreum && hasBun) return 'UREUM'; // Default Indonesian hospital priority
  return 'UNKNOWN';
}

/**
 * Converts Glucose: mg/dL <-> mmol/L (Factor: 18)
 */
export function glucoseMgToMmol(mgDl: number): number {
  return Number((mgDl / 18.0).toFixed(2));
}

export function glucoseMmolToMg(mmolL: number): number {
  return Number((mmolL * 18.0).toFixed(1));
}

/**
 * Converts Total / HDL / LDL Cholesterol: mg/dL <-> mmol/L (Factor: 38.67)
 */
export function cholesterolMgToMmol(mgDl: number): number {
  return Number((mgDl / 38.67).toFixed(2));
}

export function cholesterolMmolToMg(mmolL: number): number {
  return Number((mmolL * 38.67).toFixed(1));
}

/**
 * Converts Triglycerides: mg/dL <-> mmol/L (Factor: 88.57)
 */
export function triglycerideMgToMmol(mgDl: number): number {
  return Number((mgDl / 88.57).toFixed(2));
}

export function triglycerideMmolToMg(mmolL: number): number {
  return Number((mmolL * 88.57).toFixed(1));
}

/**
 * Converts Free T4 (FT4): ng/dL <-> pmol/L (Factor: 12.87)
 */
export function ft4NgDlToPmolL(ngDl: number): number {
  return Number((ngDl * 12.87).toFixed(2));
}

export function ft4PmolLToNgDl(pmolL: number): number {
  return Number((pmolL / 12.87).toFixed(2));
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Reference Ranges for RSUP Prof. dr. I.G.N.G. Ngoerah Denpasar
// ──────────────────────────────────────────────────────────────────────────────

export const RSUP_NGOERAH_LFT_NORMS = {
  totalBilirubin: { min: 0.3, max: 1.2, unit: 'mg/dL' },
  directBilirubin: { min: 0.0, max: 0.5, unit: 'mg/dL' },
  indirectBilirubin: { min: 0.2, max: 0.7, unit: 'mg/dL' },
  astSgot: { min: 0, max: 34, unit: 'U/L' },
  altSgpt: { min: 0, max: 55, unit: 'U/L' },
  alkalinePhosphatase: { min: 40, max: 150, unit: 'U/L' },
  gammaGt: { min: 0, max: 33, unit: 'U/L' },
  totalProtein: { min: 6.4, max: 8.3, unit: 'g/dL' },
  albumin: { min: 3.4, max: 4.8, unit: 'g/dL' },
  globulin: { min: 2.2, max: 3.7, unit: 'g/dL' },
};

// ──────────────────────────────────────────────────────────────────────────────
// 3. Anthropometry, Dosing Weight & Body Surface Area (BSA)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Devine Formula for Ideal Body Weight (IBW).
 * Male: 50.0 + 2.3 * max(0, Height_in - 60)
 * Female: 45.5 + 2.3 * max(0, Height_in - 60)
 */
export function calculateDevineIbw(heightCm: number, sex: 'male' | 'female'): number {
  const heightInches = heightCm / 2.54;
  const inchesOver60 = Math.max(0, heightInches - 60);
  const base = sex === 'male' ? 50.0 : 45.5;
  return Number((base + 2.3 * inchesOver60).toFixed(1));
}

/**
 * Body Mass Index (BMI).
 * Formula: Weight (kg) / (Height (m) ^ 2)
 */
export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

/**
 * Dosing Weight selection for antimicrobial / chemotherapeutic dosing.
 * If Actual < IBW: use Actual (TBW)
 * If BMI >= 30: use Adjusted Body Weight (ABW = IBW + 0.4 * (Actual - IBW))
 * Otherwise: use IBW
 */
export function calculateDosingWeight(
  actualWeightKg: number,
  heightCm: number,
  sex: 'male' | 'female',
): { dosingWeight: number; type: 'TBW' | 'IBW' | 'ABW'; ibw: number; bmi: number } {
  const ibw = calculateDevineIbw(heightCm, sex);
  const bmi = calculateBmi(actualWeightKg, heightCm);

  if (actualWeightKg < ibw) {
    return { dosingWeight: actualWeightKg, type: 'TBW', ibw, bmi };
  }
  if (bmi >= 30.0) {
    const abw = Number((ibw + 0.4 * (actualWeightKg - ibw)).toFixed(1));
    return { dosingWeight: abw, type: 'ABW', ibw, bmi };
  }
  return { dosingWeight: ibw, type: 'IBW', ibw, bmi };
}

/**
 * 4-Formula Body Surface Area (BSA in m²).
 */
export function calculateBsa(
  heightCm: number,
  weightKg: number,
): { mosteller: number; duBois: number; boyd: number; gehanGeorge: number } {
  if (heightCm <= 0 || weightKg <= 0) {
    return { mosteller: 0, duBois: 0, boyd: 0, gehanGeorge: 0 };
  }

  // 1. Mosteller: sqrt((H * W) / 3600)
  const mosteller = Number(Math.sqrt((heightCm * weightKg) / 3600).toFixed(2));

  // 2. Du Bois & Du Bois: 0.007184 * (W ^ 0.425) * (H ^ 0.725)
  const duBois = Number(
    (0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725)).toFixed(2),
  );

  // 3. Boyd: 0.0003207 * (H ^ 0.3) * ((W * 1000) ^ (0.7285 - 0.0188 * log10(W * 1000)))
  const weightG = weightKg * 1000;
  const boydExp = 0.7285 - 0.0188 * Math.log10(weightG);
  const boyd = Number(
    (0.0003207 * Math.pow(heightCm, 0.3) * Math.pow(weightG, boydExp)).toFixed(2),
  );

  // 4. Gehan & George: 0.0235 * (H ^ 0.42246) * (W ^ 0.51456)
  const gehanGeorge = Number(
    (0.0235 * Math.pow(heightCm, 0.42246) * Math.pow(weightKg, 0.51456)).toFixed(2),
  );

  return { mosteller, duBois, boyd, gehanGeorge };
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Renal Function: Cockcroft-Gault CrCl & CKD-EPI 2021 Race-Free eGFR
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Cockcroft-Gault Creatinine Clearance (CrCl in mL/min).
 * Used for drug dosing adjustments across FDA/EMA antimicrobial monographs.
 */
export function calculateCockcroftGaultCrCl(
  age: number,
  weightKg: number,
  serumCr: number,
  sex: 'male' | 'female',
): number {
  if (serumCr <= 0 || age <= 0 || weightKg <= 0) return 0;
  const factor = sex === 'female' ? 0.85 : 1.0;
  const crcl = (((140 - age) * weightKg) / (72 * serumCr)) * factor;
  return Number(crcl.toFixed(1));
}

/**
 * 2021 CKD-EPI Race-Free Creatinine Equation (mL/min/1.73m²).
 * Recommendation: Inker et al., NEJM 2021.
 */
export function calculateCkdEpi2021(
  age: number,
  serumCr: number,
  sex: 'male' | 'female',
): { egfr: number; stage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5'; stageDesc: string } {
  if (serumCr <= 0 || age <= 0) {
    return { egfr: 0, stage: 'G5', stageDesc: 'Gagal Ginjal Terminal (eGFR < 15)' };
  }

  const isFemale = sex === 'female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const genderMultiplier = isFemale ? 1.012 : 1.0;

  const crRatio = serumCr / kappa;
  const minRatio = Math.min(crRatio, 1.0);
  const maxRatio = Math.max(crRatio, 1.0);

  const egfr = Number(
    (
      142 *
      Math.pow(minRatio, alpha) *
      Math.pow(maxRatio, -1.2) *
      Math.pow(0.9938, age) *
      genderMultiplier
    ).toFixed(1),
  );

  let stage: 'G1' | 'G2' | 'G3a' | 'G3b' | 'G4' | 'G5';
  let stageDesc: string;

  if (egfr >= 90) {
    stage = 'G1';
    stageDesc = 'Fungsi Normal / Tinggi (eGFR ≥ 90)';
  } else if (egfr >= 60) {
    stage = 'G2';
    stageDesc = 'Penurunan Ringan (eGFR 60-89)';
  } else if (egfr >= 45) {
    stage = 'G3a';
    stageDesc = 'Penurunan Ringan-Sedang (eGFR 45-59)';
  } else if (egfr >= 30) {
    stage = 'G3b';
    stageDesc = 'Penurunan Sedang-Berat (eGFR 30-44)';
  } else if (egfr >= 15) {
    stage = 'G4';
    stageDesc = 'Penurunan Berat (eGFR 15-29)';
  } else {
    stage = 'G5';
    stageDesc = 'Gagal Ginjal Terminal (eGFR < 15)';
  }

  return { egfr, stage, stageDesc };
}
