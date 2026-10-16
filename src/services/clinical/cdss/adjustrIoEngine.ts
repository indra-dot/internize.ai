/**
 * internize.ai — ADJUSTR.IO Engine (Renal Antimicrobial Dosing)
 * Ported directly from drguswib adjustr.io CDSS.
 * 100% on-device deterministic execution (Zero Egress Invariant).
 */

import rawAntimicrobialData from './antimicrobial_data.json';
import {
  calculateCockcroftGaultCrCl,
  calculateCkdEpi2021,
  calculateDevineIbw,
  calculateDosingWeight,
  calculateBsa,
} from './unitConverters';
import { GuardrailAlert } from './types';

export interface DrugAdjustment {
  minCrCl: number;
  label: string;
  recommendation: string;
}

export interface DrugRrt {
  ihd?: string;
  crrt?: string;
}

export interface DrugStrategyData {
  standard_dose: string;
  dose_factor?: number;
  adjustments: DrugAdjustment[];
  rrt?: DrugRrt;
}

export interface DrugProfile {
  name: string;
  class: string;
  isMultiStrategy?: boolean;
  standard_dose?: string;
  dose_factor?: number;
  adjustments?: DrugAdjustment[];
  rrt?: DrugRrt;
  loadingDose?: string;
  isNephrotoxic?: boolean;
  isNeurotoxic?: boolean;
  contraindication?: string;
  note?: string;
  strategies?: Record<string, DrugStrategyData>;
}

export const ANTIMICROBIAL_DATABASE = rawAntimicrobialData as Record<string, DrugProfile>;

export interface RenalDosingInput {
  age: number;
  weightKg: number;
  heightCm: number;
  serumCreatinine: number;
  gender: 'male' | 'female';
  strategyName?: string;
  customCrCl?: number;
}

export interface RenalDosingResult {
  drugKey: string;
  drugName: string;
  drugClass: string;
  crCl: number;
  ckdEpi: number;
  usedWeightKg: number;
  weightType: string;
  ibwKg: number;
  bsaM2: number;
  selectedStrategyName?: string;
  standardDose: string;
  singleDoseCalculation?: string;
  recommendedDose: string;
  matchedAdjustmentLabel: string;
  loadingDoseRecommendation?: string;
  contraindicationNote?: string;
  ihdRecommendation?: string;
  crrtRecommendation?: string;
  clinicalNote?: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

/**
 * Get list of all available drugs in ADJUSTR.IO
 */
export function getAntimicrobialList(): Array<{ key: string; name: string; class: string }> {
  return Object.entries(ANTIMICROBIAL_DATABASE).map(([key, drug]) => ({
    key,
    name: drug.name,
    class: drug.class,
  }));
}

/**
 * Get drug profile by key
 */
export function getAntimicrobialByKey(drugKey: string): DrugProfile | undefined {
  return ANTIMICROBIAL_DATABASE[drugKey];
}

/**
 * Calculate renal antimicrobial dosing according to Cockcroft-Gault CrCl and clinical strategies
 */
export function calculateRenalDosing(
  drugKey: string,
  input: RenalDosingInput
): RenalDosingResult {
  const drug = ANTIMICROBIAL_DATABASE[drugKey];
  if (!drug) {
    throw new Error(`Drug with key "${drugKey}" not found in ADJUSTR.IO database.`);
  }

  // 1. Biometrics & CrCl calculation
  const dosingWeight = calculateDosingWeight(input.weightKg, input.heightCm, input.gender);
  const ibw = calculateDevineIbw(input.heightCm, input.gender);
  const bsaResult = calculateBsa(input.heightCm, input.weightKg);

  const calculatedCrCl = calculateCockcroftGaultCrCl(
    input.age,
    dosingWeight.dosingWeight,
    input.serumCreatinine,
    input.gender
  );

  const ckdEpiResult = calculateCkdEpi2021(
    input.age,
    input.serumCreatinine,
    input.gender
  );

  const effectiveCrCl = input.customCrCl ?? calculatedCrCl;

  // 2. Active Strategy & Dosing Data
  let activeStrategyName: string | undefined;
  let activeData: DrugStrategyData;

  if (drug.isMultiStrategy && drug.strategies) {
    const strategyKeys = Object.keys(drug.strategies);
    activeStrategyName = input.strategyName && drug.strategies[input.strategyName]
      ? input.strategyName
      : strategyKeys[0];
    activeData = drug.strategies[activeStrategyName];
  } else {
    activeData = {
      standard_dose: drug.standard_dose || '--',
      dose_factor: drug.dose_factor,
      adjustments: drug.adjustments || [],
      rrt: drug.rrt,
    };
  }

  // 3. Match CrCl breakpoint (adjustments are ordered descending by minCrCl)
  const sortedAdjustments = [...(activeData.adjustments || [])].sort((a, b) => b.minCrCl - a.minCrCl);
  let matchedAdj: DrugAdjustment = sortedAdjustments.length > 0
    ? sortedAdjustments[sortedAdjustments.length - 1]
    : { minCrCl: 0, label: 'Standard', recommendation: activeData.standard_dose };

  for (const adj of sortedAdjustments) {
    if (effectiveCrCl >= adj.minCrCl) {
      matchedAdj = adj;
      break;
    }
  }

  const normalizedLabel = (matchedAdj.label || '').replace(/&ge;/g, '≥').replace(/&le;/g, '≤');

  // 4. Single dose calculation (e.g. mg/kg basis)
  let singleDoseCalc: string | undefined;
  if (activeData.dose_factor && activeData.dose_factor > 0) {
    const basisWeight = (drug.name.includes('Vancomycin') || drug.name.includes('Daptomycin'))
      ? input.weightKg // actual body weight
      : dosingWeight.dosingWeight;
    const calcMg = Math.round(basisWeight * activeData.dose_factor);
    singleDoseCalc = `${calcMg} mg (${activeData.dose_factor} mg/kg x ${basisWeight.toFixed(1)} kg)`;
  }

  // 5. Guardrails & safety alerts
  const alerts: GuardrailAlert[] = [];

  if (drug.isNephrotoxic && effectiveCrCl < 50) {
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Nefrotoksisitas Signifikan',
      message: `${drug.name} berpotensi nefrotoksik. Pada CrCl ${effectiveCrCl.toFixed(1)} mL/min, lakukan pemantauan kadar trough/TDM serial, fungsi ginjal berkala, dan hidrasi adekuat. Hindari ko-administrasi dengan agen nefrotoksik lain bila memungkinkan.`,
    });
  }

  if (drug.isNeurotoxic && effectiveCrCl < 30) {
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Neurotoksisitas (Ensefalopati / Kejang)',
      message: `${drug.name} memiliki risiko akumulasi neurotoksik pada gangguan ginjal berat (CrCl < 30 mL/min). Waspadai tanda mioklonus, konfusi, penurunan kesadaran, atau kejang jika dosis tidak dititrasi sesuai klirens.`,
    });
  }

  if (drug.contraindication && effectiveCrCl < 30) {
    alerts.push({
      severity: 'danger',
      title: 'Kontraindikasi Relatif / Absolut pada Gagal Ginjal Berat',
      message: drug.contraindication,
    });
  }

  if (drug.loadingDose) {
    alerts.push({
      severity: 'info',
      title: 'Loading Dose / Dosis Awal Wajib Diberikan Penuh',
      message: drug.loadingDose,
    });
  }

  // 6. Generate CPPT text representation
  let cppt = `[ADJUSTR.IO CDSS] PENYESUAIAN DOSIS OBAT PADA GANGGUAN GINJAL\n`;
  cppt += `Pasien: Usia ${input.age} th, JK ${input.gender === 'male' ? 'L' : 'P'} | BB ${input.weightKg} kg, TB ${input.heightCm} cm | SCr ${input.serumCreatinine} mg/dL\n`;
  cppt += `Klirens Ginjal: CrCl ${effectiveCrCl.toFixed(1)} mL/min (Cockcroft-Gault) | eGFR ${ckdEpiResult.egfr.toFixed(1)} mL/min/1.73m² (CKD-EPI 2021)\n`;
  cppt += `Bobot Dosing: ${dosingWeight.dosingWeight.toFixed(1)} kg (${dosingWeight.type}) | BSA: ${bsaResult.mosteller.toFixed(2)} m²\n\n`;
  cppt += `OBAT: ${drug.name} (${drug.class})\n`;
  if (activeStrategyName) {
    cppt += `Indikasi / Strategi: ${activeStrategyName}\n`;
  }
  cppt += `- Dosis Standar (Fungsi Normal): ${activeData.standard_dose}\n`;
  if (singleDoseCalc) {
    cppt += `- Kalkulasi Single Dose: ${singleDoseCalc}\n`;
  }
  if (drug.loadingDose) {
    cppt += `- Loading Dose: ${drug.loadingDose}\n`;
  }
  cppt += `- Rekomendasi Rumatan Ginjal: ${matchedAdj.recommendation} [${normalizedLabel}]\n`;
  if (activeData.rrt?.ihd) {
    cppt += `- Hemodialisis Intermiten (IHD): ${activeData.rrt.ihd}\n`;
  }
  if (activeData.rrt?.crrt) {
    cppt += `- CRRT: ${activeData.rrt.crrt}\n`;
  }
  if (drug.contraindication) {
    cppt += `- Kontraindikasi / Peringatan: ${drug.contraindication}\n`;
  }
  if (drug.note) {
    cppt += `- Clinical Pearl: ${drug.note}\n`;
  }

  return {
    drugKey,
    drugName: drug.name,
    drugClass: drug.class,
    crCl: effectiveCrCl,
    ckdEpi: ckdEpiResult.egfr,
    usedWeightKg: dosingWeight.dosingWeight,
    weightType: dosingWeight.type,
    ibwKg: ibw,
    bsaM2: bsaResult.mosteller,
    selectedStrategyName: activeStrategyName,
    standardDose: activeData.standard_dose,
    singleDoseCalculation: singleDoseCalc,
    recommendedDose: matchedAdj.recommendation,
    matchedAdjustmentLabel: normalizedLabel,
    loadingDoseRecommendation: drug.loadingDose,
    contraindicationNote: drug.contraindication,
    ihdRecommendation: activeData.rrt?.ihd,
    crrtRecommendation: activeData.rrt?.crrt,
    clinicalNote: drug.note,
    alerts,
    cpptFormat: cppt.trim(),
  };
}
