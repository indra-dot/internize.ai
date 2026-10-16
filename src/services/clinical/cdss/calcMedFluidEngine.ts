/**
 * internize.ai — Calc-Med & adjustrFluid Engine
 * Complete port of vasoactive syringe pumps, 24h bridging insulin, full ABG/BGA,
 * Holliday-Segar, Adrogué-Madias (with ODS guardrail), electrolytes, and renal AKI / AEIOU HD.
 * 100% on-device deterministic clinical execution.
 */

import { GuardrailAlert } from './types';
import { ureumToBun } from './unitConverters';

// ==========================================
// 1. VASOACTIVE SYRINGE PUMP TITRATION
// ==========================================

export type VasoactiveDrugType = 'norepinephrine' | 'dobutamine' | 'dopamine' | 'nicardipine' | 'nitroglycerin';

export interface SyringePumpInput {
  drugType: VasoactiveDrugType;
  patientWeightKg: number;
  drugMg: number;
  diluentVolumeMl: number;
}

export interface SyringePumpDoseRow {
  dose: number;
  unit: string;
  rateMlPerHr: number;
}

export interface SyringePumpResult {
  drugType: VasoactiveDrugType;
  drugName: string;
  patientWeightKg: number;
  drugMg: number;
  diluentVolumeMl: number;
  concentrationMcgPerMl: number;
  doseTable: SyringePumpDoseRow[];
  cpptFormat: string;
}

export function calculateVasoactiveSyringePump(input: SyringePumpInput): SyringePumpResult {
  const { drugType, patientWeightKg, drugMg, diluentVolumeMl } = input;
  const conc = diluentVolumeMl > 0 ? (drugMg * 1000) / diluentVolumeMl : 0; // mcg/mL

  let drugName = '';
  const rows: SyringePumpDoseRow[] = [];
  let unit = 'mcg/kg/min';

  if (drugType === 'norepinephrine') {
    drugName = 'Norepinefrin (Vasopresor)';
    const doses = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    for (const d of doses) {
      const rate = conc > 0 && patientWeightKg > 0 ? (d * patientWeightKg * 60) / conc : 0;
      rows.push({ dose: d, unit, rateMlPerHr: Math.round(rate * 10) / 10 });
    }
  } else if (drugType === 'dobutamine') {
    drugName = 'Dobutamin (Inotropik)';
    for (let d = 2; d <= 20; d++) {
      const rate = conc > 0 && patientWeightKg > 0 ? (d * patientWeightKg * 60) / conc : 0;
      rows.push({ dose: d, unit, rateMlPerHr: Math.round(rate * 10) / 10 });
    }
  } else if (drugType === 'dopamine') {
    drugName = 'Dopamin (Inotropik / Vasopresor)';
    for (let d = 5; d <= 20; d++) {
      const rate = conc > 0 && patientWeightKg > 0 ? (d * patientWeightKg * 60) / conc : 0;
      rows.push({ dose: d, unit, rateMlPerHr: Math.round(rate * 10) / 10 });
    }
  } else if (drugType === 'nicardipine') {
    drugName = 'Nikardipin (Antihipertensi IV)';
    const doses = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0];
    for (const d of doses) {
      const rate = conc > 0 && patientWeightKg > 0 ? (d * patientWeightKg * 60) / conc : 0;
      rows.push({ dose: d, unit, rateMlPerHr: Math.round(rate * 10) / 10 });
    }
  } else if (drugType === 'nitroglycerin') {
    drugName = 'Nitrogliserin / NTG (Vasodilator)';
    unit = 'mcg/min';
    for (let d = 10; d <= 100; d += 10) {
      const rate = conc > 0 ? (d * 60) / conc : 0;
      rows.push({ dose: d, unit, rateMlPerHr: Math.round(rate * 10) / 10 });
    }
  }

  // CPPT format
  let cppt = `[Calc-Med CDSS] TITRASI SYRINGE PUMP ${drugName.toUpperCase()}\n`;
  cppt += `Pelarut: ${drugMg} mg dalam NaCl 0.9% ${diluentVolumeMl} cc | Konsentrasi: ${conc.toFixed(0)} mcg/cc\n`;
  if (drugType !== 'nitroglycerin') {
    cppt += `Berat Badan Pasien: ${patientWeightKg} kg\n`;
  }
  cppt += `Tabel Titrasi (Dosis -> Kecepatan Syringe Pump):\n`;
  for (const r of rows) {
    cppt += `  - ${r.dose} ${r.unit.padEnd(10)}: ${r.rateMlPerHr.toFixed(1)} cc/jam\n`;
  }

  return {
    drugType,
    drugName,
    patientWeightKg,
    drugMg,
    diluentVolumeMl,
    concentrationMcgPerMl: conc,
    doseTable: rows,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 2. 24-HOUR BRIDGING INSULIN TRANSITION
// ==========================================

export interface BridgingInsulinResult {
  totalDrip24hUnits: number;
  totalSubcutaneousTddUnits: number;
  basalInsulinUnits: number;
  prandialPerMealUnits: number;
  cpptFormat: string;
}

export function calculateBridgingInsulin(hourlyDrips: number[]): BridgingInsulinResult {
  const totalDrip = hourlyDrips.reduce((acc, val) => acc + (val || 0), 0);
  const totalTdd = Math.round(totalDrip * 0.8 * 10) / 10; // 80% rule
  const basal = Math.round(totalTdd * 0.5 * 10) / 10; // 50% basal
  const prandial = Math.round((basal / 3) * 10) / 10; // divided by 3 meals

  let cppt = `[Calc-Med CDSS] BRIDGING INSULIN (TRANSISI DRIP IV KE SUBKUTAN)\n`;
  cppt += `Total Kebutuhan Drip IV 24 Jam : ${totalDrip.toFixed(1)} Unit\n`;
  cppt += `Total Dosis Harian SC (80%)     : ${totalTdd.toFixed(1)} Unit/hari\n\n`;
  cppt += `REKOMENDASI REGIMEN BASAL-BOLUS SUBKUTAN:\n`;
  cppt += `1. Basal (Glargine / Detemir) : ${basal.toFixed(1)} Unit (1x/hari malam jam 22.00)\n`;
  cppt += `2. Prandial / Bolus Rapid     : 3 x ${prandial.toFixed(1)} Unit (subkutan 10-15 mnt sebelum makan)\n`;
  cppt += `Catatan: Hentikan drip insulin IV 1-2 jam SETELAH injeksi basal subkutan pertama kali diberikan untuk mencegah hiperglikemia rebound.`;

  return {
    totalDrip24hUnits: totalDrip,
    totalSubcutaneousTddUnits: totalTdd,
    basalInsulinUnits: basal,
    prandialPerMealUnits: prandial,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 3. FULL ARTERIAL BLOOD GAS (ABG / BGA) ANALYZER
// ==========================================

export interface AbgInput {
  ph: number;
  pco2: number;
  hco3: number;
  na?: number;
  cl?: number;
  albumin?: number;
  pao2?: number;
  fio2?: number; // in percentage e.g. 21, 50, 100
  patientWeightKg?: number;
}

export interface AbgAnalysisResult {
  isValidHenderson: boolean;
  hendersonDeltaPercent: number;
  calculatedHPlus: number;
  actualHPlus: number;
  primaryDisorder: string;
  compensationStatus: string;
  expectedCompensationNote: string;
  anionGap: number;
  correctedAnionGap: number;
  anionGapType: 'AGMA' | 'NAGMA' | 'Normal';
  deltaRatio?: number;
  deltaRatioInterpretation?: string;
  pao2Fio2Ratio?: number;
  ardsBerlinCategory?: string;
  bicarbonateDeficitMeq?: number;
  bicarbonateIndication: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function analyzeAbg(input: AbgInput): AbgAnalysisResult {
  const { ph, pco2, hco3 } = input;
  const na = input.na ?? 140;
  const cl = input.cl ?? 105;
  const alb = input.albumin ?? 4.0;
  const pao2 = input.pao2 ?? 90;
  const fio2 = input.fio2 ?? 21;
  const bb = input.patientWeightKg ?? 60;

  // 1. Henderson Equation Validation: [H+] = 24 * (pCO2 / HCO3)
  const h_calc = hco3 > 0 ? 24 * (pco2 / hco3) : 0;
  let h_exact = 40;
  if (ph >= 7.0 && ph <= 7.8) {
    h_exact = 40 + (7.40 - ph) * 100;
  } else {
    h_exact = Math.pow(10, 9 - ph);
  }
  const hendersonDeltaPercent = h_exact > 0 ? (Math.abs(h_calc - h_exact) / h_exact) * 100 : 0;
  const isValidHenderson = hendersonDeltaPercent <= 15;

  // 2. Primary Disorder & Winter's Formula Compensation
  let primaryDisorder = 'Normal / Terkompensasi Sempurna';
  let compensationStatus = 'Tidak ada kompensasi aktif';
  let expectedCompensationNote = '-';

  if (ph < 7.35) {
    if (hco3 < 22 && pco2 <= 45) {
      primaryDisorder = 'Asidosis Metabolik';
      const expPco2 = 1.5 * hco3 + 8;
      expectedCompensationNote = `Winter's Exp pCO2: ${expPco2.toFixed(1)} ± 2 mmHg`;
      if (pco2 >= expPco2 - 2 && pco2 <= expPco2 + 2) {
        compensationStatus = 'Kompensasi Respiratorik Adekuat';
      } else if (pco2 > expPco2 + 2) {
        compensationStatus = 'Campuran: + Asidosis Respiratorik Konkomitan';
      } else {
        compensationStatus = 'Campuran: + Alkalosis Respiratorik Konkomitan';
      }
    } else if (pco2 > 45) {
      primaryDisorder = 'Asidosis Respiratorik';
      const expHco3Akut = 24 + 0.1 * (pco2 - 40);
      const expHco3Kronik = 24 + 0.35 * (pco2 - 40);
      expectedCompensationNote = `Exp HCO3 Akut: ${expHco3Akut.toFixed(1)} | Kronik: ${expHco3Kronik.toFixed(1)}`;
      if (hco3 > 26) {
        compensationStatus = 'Kompensasi Metabolik Renal';
      } else {
        compensationStatus = 'Fase Akut / Belum Ada Kompensasi Ginjal';
      }
    }
  } else if (ph > 7.45) {
    if (hco3 > 26 && pco2 >= 35) {
      primaryDisorder = 'Alkalosis Metabolik';
      const expPco2 = 0.7 * hco3 + 21;
      expectedCompensationNote = `Exp pCO2: ${expPco2.toFixed(1)} ± 2 mmHg`;
      if (pco2 >= expPco2 - 2 && pco2 <= expPco2 + 2) {
        compensationStatus = 'Kompensasi Respiratorik Adekuat';
      } else if (pco2 > expPco2 + 2) {
        compensationStatus = 'Campuran: + Asidosis Respiratorik Konkomitan';
      } else {
        compensationStatus = 'Campuran: + Alkalosis Respiratorik Konkomitan';
      }
    } else if (pco2 < 35) {
      primaryDisorder = 'Alkalosis Respiratorik';
      const expHco3Akut = 24 - 0.2 * (40 - pco2);
      const expHco3Kronik = 24 - 0.5 * (40 - pco2);
      expectedCompensationNote = `Exp HCO3 Akut: ${expHco3Akut.toFixed(1)} | Kronik: ${expHco3Kronik.toFixed(1)}`;
      if (hco3 < 22) {
        compensationStatus = 'Kompensasi Renal';
      } else {
        compensationStatus = 'Fase Akut / Belum Ada Kompensasi';
      }
    }
  }

  // 3. Anion Gap + Figge Albumin Correction
  const ag = na - (cl + hco3);
  const agCorr = ag + 2.5 * (4.0 - alb);
  const anionGapType: 'AGMA' | 'NAGMA' | 'Normal' = agCorr > 12 ? 'AGMA' : 'NAGMA';

  // 4. Delta Ratio Workup
  let deltaRatio: number | undefined;
  let deltaRatioInterpretation: string | undefined;

  if (primaryDisorder.includes('Asidosis Metabolik') && agCorr > 12) {
    const deltaAG = agCorr - 12;
    const deltaHCO3 = 24 - hco3;
    deltaRatio = deltaHCO3 !== 0 ? deltaAG / deltaHCO3 : 1;
    if (deltaRatio < 0.4) {
      deltaRatioInterpretation = 'NAGMA Murni (Normal Anion Gap Acidosis)';
    } else if (deltaRatio <= 0.8) {
      deltaRatioInterpretation = 'Campuran AGMA + NAGMA';
    } else if (deltaRatio <= 2.0) {
      deltaRatioInterpretation = 'AGMA Murni (Pure High Anion Gap Acidosis)';
    } else {
      deltaRatioInterpretation = 'Campuran AGMA + Alkalosis Metabolik Pre-existing';
    }
  } else if (primaryDisorder.includes('Asidosis Metabolik')) {
    deltaRatioInterpretation = 'NAGMA Murni (Evaluasi GI Loss diare / Renal Loss RTA)';
  }

  // 5. Oxygenation (PaO2 / FiO2 Berlin ARDS criteria)
  let pao2Fio2Ratio: number | undefined;
  let ardsBerlinCategory: string | undefined;
  if (fio2 > 0) {
    pao2Fio2Ratio = Math.round(pao2 / (fio2 / 100));
    if (pao2Fio2Ratio > 400) ardsBerlinCategory = 'Normal (> 400)';
    else if (pao2Fio2Ratio > 300) ardsBerlinCategory = 'Oksigenasi Suboptimal (300 - 400)';
    else if (pao2Fio2Ratio > 200) ardsBerlinCategory = 'Mild ARDS (200 - 300)';
    else if (pao2Fio2Ratio > 100) ardsBerlinCategory = 'Moderate ARDS (100 - 200)';
    else ardsBerlinCategory = 'Severe ARDS (≤ 100)';
  }

  // 6. Bicarbonate Correction Indication
  let bicarbonateDeficitMeq: number | undefined;
  let bicarbonateIndication = 'Tidak ada indikasi mutlak koreksi bikarbonat (pH ≥ 7.1).';
  const alerts: GuardrailAlert[] = [];

  if (ph < 7.1 && primaryDisorder.includes('Asidosis Metabolik')) {
    bicarbonateDeficitMeq = Math.max(0, 0.5 * bb * (15 - hco3));
    bicarbonateIndication = `Asidemia Berat (pH < 7.1): Estimasi defisit awal = ${bicarbonateDeficitMeq.toFixed(1)} mEq (berikan 1/2 dosis infus lambat).`;
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Asidemia Ekstrem (pH < 7.1)',
      message: `Asidemia refrakter mengganggu kontraktilitas miokard dan respon vasopresor. Siapkan koreksi NaHCO3 terukur atau evaluasi CITO Hemodialisis bila terdapat gagal ginjal anuria.`,
    });
  }

  if (!isValidHenderson) {
    alerts.push({
      severity: 'warning',
      title: 'Validasi Persamaan Henderson Meragukan',
      message: `Selisih H+ kalkulasi dan aktual adalah ${hendersonDeltaPercent.toFixed(1)}% (> 15%). Periksa kemungkinan sampel vena tercampur, delay analisis suhu, atau kesalahan transkripsi lab.`,
    });
  }

  // 7. CPPT Format
  let cppt = `[Calc-Med CDSS] ANALISIS GAS DARAH (AGD / BGA) KOMPREHENSIF\n`;
  cppt += `Hasil AGD: pH ${ph} | pCO2 ${pco2} mmHg | HCO3 ${hco3} mEq/L | PaO2 ${pao2} mmHg (FiO2 ${fio2}%)\n`;
  cppt += `Elektrolit & Protein: Na ${na} | Cl ${cl} | Albumin ${alb} g/dL\n`;
  cppt += `- Validasi Henderson: H+ kalk ${h_calc.toFixed(1)} vs aktual ${h_exact.toFixed(1)} (Δ ${hendersonDeltaPercent.toFixed(1)}% -> ${isValidHenderson ? 'Valid' : 'Meragukan'})\n`;
  cppt += `- Gangguan Primer: ${primaryDisorder}\n`;
  cppt += `- Status Kompensasi: ${compensationStatus} (${expectedCompensationNote})\n`;
  cppt += `- Anion Gap: Aktual ${ag.toFixed(1)} | Terkoreksi Albumin ${agCorr.toFixed(1)} (${anionGapType})\n`;
  if (deltaRatioInterpretation) {
    cppt += `- Delta Ratio: ${deltaRatio !== undefined ? deltaRatio.toFixed(2) + ' -> ' : ''}${deltaRatioInterpretation}\n`;
  }
  if (pao2Fio2Ratio !== undefined) {
    cppt += `- Oksigenasi (P/F Ratio): ${pao2Fio2Ratio} -> ${ardsBerlinCategory}\n`;
  }
  cppt += `- Pertimbangan Bikarbonat: ${bicarbonateIndication}`;

  return {
    isValidHenderson,
    hendersonDeltaPercent,
    calculatedHPlus: h_calc,
    actualHPlus: h_exact,
    primaryDisorder,
    compensationStatus,
    expectedCompensationNote,
    anionGap: ag,
    correctedAnionGap: agCorr,
    anionGapType,
    deltaRatio,
    deltaRatioInterpretation,
    pao2Fio2Ratio,
    ardsBerlinCategory,
    bicarbonateDeficitMeq,
    bicarbonateIndication,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 4. FLUID & ELECTROLYTES (adjustrFluid)
// ==========================================

export interface TbwInput {
  weightKg: number;
  gender: 'male' | 'female';
  isElderly?: boolean;
  isChild?: boolean;
}

export function calculateTotalBodyWater(input: TbwInput): number {
  const { weightKg, gender, isElderly, isChild } = input;
  if (weightKg <= 0) return 0;
  if (isChild) return weightKg * 0.6;
  if (gender === 'male') return weightKg * (isElderly ? 0.5 : 0.6);
  return weightKg * (isElderly ? 0.45 : 0.5);
}

export function calculateHollidaySegar(weightKg: number, feverTempCelsius?: number): {
  dailyMl: number;
  hourlyMl: number;
  feverAdjustmentMl: number;
  cpptFormat: string;
} {
  if (weightKg <= 0) {
    return { dailyMl: 0, hourlyMl: 0, feverAdjustmentMl: 0, cpptFormat: '' };
  }

  let baseDaily = 0;
  if (weightKg <= 10) {
    baseDaily = weightKg * 100;
  } else if (weightKg <= 20) {
    baseDaily = 1000 + (weightKg - 10) * 50;
  } else {
    baseDaily = 1500 + (weightKg - 20) * 20;
  }

  let feverAdj = 0;
  if (feverTempCelsius && feverTempCelsius > 37) {
    const diff = feverTempCelsius - 37;
    feverAdj = baseDaily * (diff * 0.12); // +12% per 1 deg C
  }

  const totalDaily = Math.round(baseDaily + feverAdj);
  const hourly = Math.round((totalDaily / 24) * 10) / 10;

  let cppt = `[adjustrFluid CDSS] KEBUTUHAN RUMATAN CAIRAN (HOLLIDAY-SEGAR)\n`;
  cppt += `Berat Badan: ${weightKg} kg\n`;
  if (feverTempCelsius && feverTempCelsius > 37) {
    cppt += `Suhu Pasien: ${feverTempCelsius}°C (Koreksi demam +${Math.round(feverAdj)} mL/hari)\n`;
  }
  cppt += `Total Kebutuhan Rumatan: ${totalDaily} mL/24 jam (~${hourly} mL/jam / ${Math.round(hourly / 3)} tetes makro/menit)`;

  return {
    dailyMl: totalDaily,
    hourlyMl: hourly,
    feverAdjustmentMl: Math.round(feverAdj),
    cpptFormat: cppt.trim(),
  };
}

export interface HyponatremiaInput {
  weightKg: number;
  gender: 'male' | 'female';
  isElderly?: boolean;
  serumNa: number;
  targetRise24h: number; // e.g. 6 to 8 mEq/L
  infusateType: 'nacl_3_percent' | 'nacl_0_9_percent' | 'ringer_lactate';
  infusateK?: number;
}

export interface HyponatremiaResult {
  tbwLiters: number;
  deltaNaPerLiter: number;
  totalVolumeMl: number;
  hourlyRateMl: number;
  isDangerOds: boolean;
  alerts: GuardrailAlert[];
  cpptFormat: string;
}

export function calculateHyponatremiaAdrogue(input: HyponatremiaInput): HyponatremiaResult {
  const { weightKg, gender, isElderly, serumNa, targetRise24h } = input;
  const infusateNaMap = {
    nacl_3_percent: 513,
    nacl_0_9_percent: 154,
    ringer_lactate: 130,
  };
  const infusateNames = {
    nacl_3_percent: 'NaCl 3% (Saline Hipertonik - 513 mEq/L)',
    nacl_0_9_percent: 'NaCl 0.9% (Normal Saline - 154 mEq/L)',
    ringer_lactate: 'Ringer Laktat (130 mEq/L)',
  };

  const infusateNa = infusateNaMap[input.infusateType];
  const infusateK = input.infusateK ?? 0;
  const tbw = calculateTotalBodyWater({ weightKg, gender, isElderly });

  const deltaNaPerLiter = tbw > 0 ? (infusateNa + infusateK - serumNa) / (tbw + 1) : 0;
  const totalLiters = deltaNaPerLiter > 0 ? targetRise24h / deltaNaPerLiter : 0;
  const totalVolumeMl = Math.round(totalLiters * 1000);
  const hourlyRateMl = Math.round((totalVolumeMl / 24) * 10) / 10;

  const isDangerOds = targetRise24h > 10.0;
  const isWarningOds = targetRise24h > 8.0;

  const alerts: GuardrailAlert[] = [];
  if (isDangerOds) {
    alerts.push({
      severity: 'danger',
      title: 'PERINGATAN KRITIS: Target Koreksi Melebihi Batas Aman ODS (> 10 mEq/L/24 jam)',
      message: `Target kenaikan ${targetRise24h.toFixed(1)} mEq/L dalam 24 jam sangat berisiko memicu Osmotic Demyelination Syndrome (ODS) / Central Pontine Myelinolysis ireversibel. Batasi kenaikan maksimal 8 mEq/L dalam 24 jam (atau 4-6 mEq/L pada malnutrisi/alkoholisme/hipokalemia).`,
    });
  } else if (isWarningOds) {
    alerts.push({
      severity: 'warning',
      title: 'Peringatan: Target Koreksi Mendekati Ambang Batas Aman ODS',
      message: `Target ${targetRise24h.toFixed(1)} mEq/L/24 jam mendekati batas maksimal toleransi neurologis. Monitor natrium serum berkala setiap 2-4 jam. Hentikan saline hipertonik bila gejala kejang/ensefalopati telah terkontrol.`,
    });
  }

  let cppt = `[adjustrFluid CDSS] KOREKSI HIPONATREMIA (FORMULA ADROGUÉ-MADIAS)\n`;
  cppt += `Data Pasien: BB ${weightKg} kg, JK ${gender === 'male' ? 'L' : 'P'} | TBW: ${tbw.toFixed(1)} Liter\n`;
  cppt += `Status Natrium: Serum Awal ${serumNa} mEq/L | Target Kenaikan 24j: +${targetRise24h} mEq/L\n`;
  cppt += `Cairan Infus Terpilih: ${infusateNames[input.infusateType]}\n`;
  cppt += `- Prediksi Kenaikan per 1 Liter Cairan (ΔNa): +${deltaNaPerLiter.toFixed(2)} mEq/L\n`;
  cppt += `- Total Volume Cairan 24 Jam: ${totalVolumeMl} mL\n`;
  cppt += `- Kecepatan Infus: ${hourlyRateMl.toFixed(1)} mL/jam (via syringe pump atau infusion pump)\n`;
  if (alerts.length > 0) {
    cppt += `- Peringatan Keselamatan: ${alerts[0].title} — ${alerts[0].message}\n`;
  }

  return {
    tbwLiters: tbw,
    deltaNaPerLiter: Math.round(deltaNaPerLiter * 100) / 100,
    totalVolumeMl,
    hourlyRateMl,
    isDangerOds,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

export interface HypernatremiaInput {
  weightKg: number;
  gender: 'male' | 'female';
  isElderly?: boolean;
  serumNa: number;
  targetNa: number; // e.g. 140 mEq/L
}

export function calculateHypernatremiaFwd(input: HypernatremiaInput): {
  tbwLiters: number;
  freeWaterDeficitLiters: number;
  recommendedHourlyRateD5Ml: number;
  cpptFormat: string;
} {
  const { weightKg, gender, isElderly, serumNa, targetNa } = input;
  const tbw = calculateTotalBodyWater({ weightKg, gender, isElderly });
  const fwd = serumNa > targetNa && targetNa > 0 ? tbw * (serumNa / targetNa - 1) : 0;
  // Infusion rate to correct over 48 hours to prevent cerebral edema
  const hourlyRateD5 = fwd > 0 ? (fwd * 1000) / 48 : 0;

  let cppt = `[adjustrFluid CDSS] KOREKSI HIPERNATREMIA & DEFISIT AIR BEBAS (FWD)\n`;
  cppt += `Data Pasien: BB ${weightKg} kg | TBW: ${tbw.toFixed(1)} Liter\n`;
  cppt += `Status Natrium: Serum Awal ${serumNa} mEq/L -> Target ${targetNa} mEq/L\n`;
  cppt += `- Defisit Air Bebas (Free Water Deficit): ${fwd.toFixed(2)} Liter\n`;
  cppt += `- Kecepatan Koreksi (Dextrose 5% IV / Oral Air Bersih): ~${Math.round(hourlyRateD5)} mL/jam selama 48 jam\n`;
  cppt += `Catatan: Turunkan natrium serum maksimal 10 mEq/L dalam 24 jam untuk mencegah edema serebri akut.`;

  return {
    tbwLiters: tbw,
    freeWaterDeficitLiters: Math.round(fwd * 100) / 100,
    recommendedHourlyRateD5Ml: Math.round(hourlyRateD5),
    cpptFormat: cppt.trim(),
  };
}

export function calculatePotassiumManagement(kSerum: number, _patientWeightKg = 60): {
  severity: 'Severe Hypokalemia' | 'Moderate Hypokalemia' | 'Mild Hypokalemia' | 'Normal' | 'Hyperkalemia' | 'Severe Hyperkalemia';
  estimatedDeficitMeq: number;
  protocolRecommendation: string;
  alerts: GuardrailAlert[];
  cpptFormat: string;
} {
  let severity: 'Severe Hypokalemia' | 'Moderate Hypokalemia' | 'Mild Hypokalemia' | 'Normal' | 'Hyperkalemia' | 'Severe Hyperkalemia' = 'Normal';
  let deficit = 0;
  let protocol = '';
  const alerts: GuardrailAlert[] = [];

  if (kSerum < 2.5) {
    severity = 'Severe Hypokalemia';
    deficit = 300;
    protocol = 'CITO Koreksi KCl IV via Vena Sentral (kecepatan maksimal 20 mEq/jam dengan monitor EKG kontinu). Sediaan KCl 25 mEq dalam NaCl 0.9% 100 cc syringe pump.';
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Hipokalemia Berat (K < 2.5 mEq/L)',
      message: 'Risiko aritmia ventrikel letal (VF/VT) dan paralisis otot pernapasan. Dilarang memberikan bolus IV langsung tanpa pengenceran! Wajib monitor EKG dan cek kadar Kalium ulang tiap 4-6 jam.',
    });
  } else if (kSerum < 3.0) {
    severity = 'Moderate Hypokalemia';
    deficit = 200;
    protocol = 'Koreksi KCl IV 10-20 mEq/jam (perifer maks 10 mEq/jam untuk mencegah flebitis) + suplemen oral (KSR 3x1 tab).';
  } else if (kSerum < 3.5) {
    severity = 'Mild Hypokalemia';
    deficit = 100;
    protocol = 'Suplementasi Kalium oral: KSR 2x1 tab atau Aspar K 3x1 tab. Identifikasi dan koreksi defisiensi Magnesium penyerta.';
  } else if (kSerum > 6.5) {
    severity = 'Severe Hyperkalemia';
    deficit = 0;
    protocol = 'CITO Protokol Triple Drug Hiperkalemia: 1) Kalsium Glukonas 10% 10 cc IV pelan 2-3 mnt (stabilisasi membran), 2) D40% 50 cc + Insulin Cepat 10 IU IV drip 15-30 mnt, 3) Salbutamol nebulizer 10-20 mg. Siapkan CITO Hemodialisis bila refrakter.';
    alerts.push({
      severity: 'danger',
      title: 'Peringatan Emergensi Hiperkalemia Mengancam Jiwa (K > 6.5 mEq/L)',
      message: 'Potensi asistol / fibrilasi ventrikel mendadak. Kalsium glukonat wajib masuk segera untuk memproteksi membran miokard sebelum terapi pergeseran kalium intrasel.',
    });
  } else if (kSerum > 5.5) {
    severity = 'Hyperkalemia';
    deficit = 0;
    protocol = 'Hentikan asupan kalium dan obat penahan kalium (ACEi, ARB, Spironolakton, NSAID). Berikan Furosemide 40 mg IV bila produksi urin baik, serta Kalitake / Resonium 3x1 sachet oral.';
  } else {
    protocol = 'Kadar kalium dalam batas normal (3.5 - 5.5 mEq/L).';
  }

  let cppt = `[adjustrFluid CDSS] MANAJEMEN KALIUM SERUM\n`;
  cppt += `Kadar Kalium: ${kSerum} mEq/L (${severity})\n`;
  if (deficit > 0) {
    cppt += `Estimasi Defisit Total Tubuh: ~${deficit} mEq\n`;
  }
  cppt += `Protokol Terapi: ${protocol}`;

  return {
    severity,
    estimatedDeficitMeq: deficit,
    protocolRecommendation: protocol,
    alerts,
    cpptFormat: cppt.trim(),
  };
}

export function calculateCorrectedCalcium(caTotal: number, albSerum: number): {
  correctedCa: number;
  interpretation: 'Hipokalsemia' | 'Normal' | 'Hiperkalsemia';
  cpptFormat: string;
} {
  const corr = caTotal + 0.8 * (4.0 - albSerum);
  const correctedCa = Math.round(corr * 100) / 100;
  let interpretation: 'Hipokalsemia' | 'Normal' | 'Hiperkalsemia' = 'Normal';
  if (correctedCa < 8.5) interpretation = 'Hipokalsemia';
  else if (correctedCa > 10.5) interpretation = 'Hiperkalsemia';

  let cppt = `[adjustrFluid CDSS] KALSIUM TERKOREKSI ALBUMIN (FORMULA PAYNE)\n`;
  cppt += `Data Lab: Ca Total ${caTotal} mg/dL | Albumin ${albSerum} g/dL\n`;
  cppt += `Kalsium Terkoreksi: ${correctedCa.toFixed(2)} mg/dL (${interpretation})\n`;
  if (interpretation === 'Hipokalsemia') {
    cppt += `Tatalaksana: Replesi Kalsium Glukonat 10% 10-20 mL dalam D5% 100 cc IV lambat 10-20 menit bila bergejala (tetani, parestesia, pemanjangan QTc).`;
  }

  return {
    correctedCa,
    interpretation,
    cpptFormat: cppt.trim(),
  };
}

export function calculateMagnesiumRepletion(mgSerum: number): {
  severity: 'Severe' | 'Moderate' | 'Normal / Mild';
  protocol: string;
  cpptFormat: string;
} {
  let severity: 'Severe' | 'Moderate' | 'Normal / Mild' = 'Normal / Mild';
  let protocol = '';

  if (mgSerum < 1.0) {
    severity = 'Severe';
    protocol = 'Defisit Berat (< 1.0 mg/dL): 4 - 8 g IV MgSO4 dalam NaCl 0.9% 500 cc habis dalam 12 - 24 jam dengan pemantauan EKG kontinu.';
  } else if (mgSerum < 1.6) {
    severity = 'Moderate';
    protocol = 'Defisit Sedang (1.0 - 1.5 mg/dL): 2 g IV MgSO4 dalam 100 cc D5% habis dalam 1 - 2 jam.';
  } else {
    protocol = 'Normal atau Defisit Ringan (1.6 - 2.4 mg/dL): Optimalkan asupan oral atau suplemen oral bila ada gejala.';
  }

  let cppt = `[adjustrFluid CDSS] REPLESI MAGNESIUM (MgSO4)\n`;
  cppt += `Kadar Magnesium Serum: ${mgSerum} mg/dL (${severity})\n`;
  cppt += `Rekomendasi Protokol: ${protocol}\n`;
  cppt += `Safety Pearl: Pantau refleks patela dan frekuensi napas (> 16x/m) selama infus. Sediakan Kalsium Glukonat 10% sebagai antidotum toksisitas.`;

  return {
    severity,
    protocol,
    cpptFormat: cppt.trim(),
  };
}

export function calculatePhosphateRepletion(po4Serum: number): {
  severity: 'Severe' | 'Moderate' | 'Normal';
  protocol: string;
  cpptFormat: string;
} {
  let severity: 'Severe' | 'Moderate' | 'Normal' = 'Normal';
  let protocol = '';

  if (po4Serum < 1.0) {
    severity = 'Severe';
    protocol = 'Defisit Berat (< 1.0 mg/dL): 0.32 - 0.64 mmol/kg IV K-Phos atau Na-Phos dalam 250 cc NaCl 0.9% habis dalam 4 - 6 jam.';
  } else if (po4Serum < 2.0) {
    severity = 'Moderate';
    protocol = 'Defisit Sedang (1.0 - 1.9 mg/dL): 0.16 - 0.32 mmol/kg IV atau sediaan oral ekuivalen.';
  } else {
    protocol = 'Kadar fosfat dalam batas normal (2.0 - 4.5 mg/dL).';
  }

  let cppt = `[adjustrFluid CDSS] REPLESI FOSFAT SERUM\n`;
  cppt += `Kadar Fosfat: ${po4Serum} mg/dL (${severity})\n`;
  cppt += `Rekomendasi: ${protocol}\n`;
  cppt += `Pertimbangan Khusus: Pada Sindrom Refeeding atau DKA paska-insulin, hipofosfatemia berat dapat memicu gagal napas akut akibat paresis diafragma.`;

  return {
    severity,
    protocol,
    cpptFormat: cppt.trim(),
  };
}

// ==========================================
// 5. AKI STAGING, BUN:CR RATIO & AEIOU CITO HD
// ==========================================

export interface BunCrRatioResult {
  bunMgDl: number;
  creatinineMgDl: number;
  ratio: number;
  classification: 'Prerenal Azotemia' | 'Intrinsic Renal / ATN' | 'Normal / Post-renal';
  cpptFormat: string;
}

export function calculateBunCrRatio(
  rawUreaOrBun: number,
  creatinine: number,
  isRsUreum = false
): BunCrRatioResult {
  const bun = isRsUreum ? ureumToBun(rawUreaOrBun) : rawUreaOrBun;
  const ratio = creatinine > 0 ? bun / creatinine : 0;
  const roundedRatio = Math.round(ratio * 10) / 10;

  let classification: 'Prerenal Azotemia' | 'Intrinsic Renal / ATN' | 'Normal / Post-renal' = 'Normal / Post-renal';
  if (roundedRatio > 20) {
    classification = 'Prerenal Azotemia';
  } else if (roundedRatio < 10) {
    classification = 'Intrinsic Renal / ATN';
  }

  let cppt = `[adjustrFluid CDSS] EVALUASI RASIO BUN : KREATININ\n`;
  cppt += `Nilai Lab: ${isRsUreum ? `Ureum RS ${rawUreaOrBun} mg/dL (dikonversi ke BUN: ${bun.toFixed(1)} mg/dL)` : `BUN ${bun.toFixed(1)} mg/dL`} | SCr ${creatinine} mg/dL\n`;
  cppt += `Rasio BUN:Kreatinin: ${roundedRatio.toFixed(1)} -> ${classification}\n`;
  if (classification === 'Prerenal Azotemia') {
    cppt += `Interpretasi: Mengindikasikan hipoperfusi renal, dehidrasi, perdarahan GI, atau status hiperkatabolik dengan reabsorpsi urea tubulus yang masih intak.`;
  } else if (classification === 'Intrinsic Renal / ATN') {
    cppt += `Interpretasi: Mengindikasikan kerusakan parenkim tubulus ginjal (Acute Tubular Necrosis / ATN), di mana kemampuan reabsorpsi urea tubulus hilang.`;
  }

  return {
    bunMgDl: Math.round(bun * 10) / 10,
    creatinineMgDl: creatinine,
    ratio: roundedRatio,
    classification,
    cpptFormat: cppt.trim(),
  };
}

export interface AeiouHdCheckInput {
  acidosisPhRefractory?: boolean;
  electrolytesRefractoryHyperkalemia?: boolean;
  intoxicationToxicIngestion?: boolean;
  overloadPulmonaryEdemaRefractory?: boolean;
  uremiaEncephalopathyOrPericarditis?: boolean;
}

export function evaluateAeiouHdIndications(input: AeiouHdCheckInput): {
  isCitoHdIndicated: boolean;
  positiveCriteria: string[];
  cpptFormat: string;
} {
  const positiveCriteria: string[] = [];
  if (input.acidosisPhRefractory) {
    positiveCriteria.push('A — Asidosis metabolik berat refrakter (pH < 7.15)');
  }
  if (input.electrolytesRefractoryHyperkalemia) {
    positiveCriteria.push('E — Elektrolit: Hiperkalemia refrakter (K > 6.5 mEq/L) dengan perubahan EKG');
  }
  if (input.intoxicationToxicIngestion) {
    positiveCriteria.push('I — Intoksikasi / Ingestion racun dializable (metanol, etilen glikol, litium, salisilat)');
  }
  if (input.overloadPulmonaryEdemaRefractory) {
    positiveCriteria.push('O — Overload cairan: Edema paru akut refrakter terhadap diuretik dosis tinggi');
  }
  if (input.uremiaEncephalopathyOrPericarditis) {
    positiveCriteria.push('U — Uremia komplikasi: Ensefalopati uremikum, perikarditis uremikum, atau perdarahan uremikum');
  }

  const isCitoHdIndicated = positiveCriteria.length > 0;

  let cppt = `[adjustrFluid CDSS] KRITERIA INDIKASI HEMODIALISIS CITO / URGENT (AEIOU)\n`;
  if (isCitoHdIndicated) {
    cppt += `STATUS: INDIKASI CITO HD TERPENUHI (${positiveCriteria.length} kriteria aktif)\n`;
    for (const c of positiveCriteria) {
      cppt += `  [+] ${c}\n`;
    }
    cppt += `Rekomendasi: Konsul CITO Divisi Nefrologi Sp.PD untuk persiapan akses hemodialisis cito (CDL double lumen) dan tatalaksana dialisis segera.`;
  } else {
    cppt += `STATUS: Belum ditemukan indikasi mutlak hemodialisis CITO (Kriteria AEIOU negatif). Lanjutkan medikamentosa konservatif dan pemantauan serial.`;
  }

  return {
    isCitoHdIndicated,
    positiveCriteria,
    cpptFormat: cppt.trim(),
  };
}
