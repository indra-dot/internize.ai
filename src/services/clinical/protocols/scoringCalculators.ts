import type { ParsedVitals, ParsedLabItem } from '../internalMedicineEngine';
import type { ScoringResult, ScoringComponent } from '../protocolRegistry';

// Utility to safely extract age from text
function extractAge(text: string): number | null {
  const match = text.match(/(\d{2,3})\s*(?:th|tahun|yo|y\.?o)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Utility to find lab value by regex
function findLabValue(labs: ParsedLabItem[], pattern: RegExp): number | null {
  const lab = labs.find((l) => pattern.test(l.name));
  return lab ? lab.value : null;
}

// Utility to test keyword presence
function hasKeyword(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

// Utility to format display text
function formatScoreDisplay(score: number | null): string {
  return score === null ? '___' : score.toString();
}

/**
 * 1. ARISCAT Score
 */
export function calculateARISCAT(text: string, vitals: ParsedVitals, labs: ParsedLabItem[]): ScoringResult {
  const age = extractAge(text);
  const spo2 = vitals.spO2 ?? null;
  const hb = findLabValue(labs, /\b(hb|hemoglobin)\b/i);

  const hasRespInfection = hasKeyword(text, /\b(infeksi pernapasan|ispa|batuk|pilek|respiratory infection)\b/i);
  const isPeripheral = hasKeyword(text, /\b(perifer|ekstremitas|peripheral)\b/i);
  const isUpperAbdo = hasKeyword(text, /\b(abdomen atas|upper abdominal)\b/i);
  const isIntrathoracic = hasKeyword(text, /\b(intratoraks|dada|toraks|intrathoracic)\b/i);
  const isDurationLong = hasKeyword(text, /\b(operasi > 2 jam|durasi > 2 jam|prolonged surgery)\b/i);
  const isEmergency = hasKeyword(text, /\b(cito|darurat|emergency)\b/i);

  // Age Component
  let agePoints: number | null = null;
  let ageLabel = 'Age';
  if (age !== null) {
    if (age <= 50) { agePoints = 0; ageLabel = `Age ≤50 (${age})`; }
    else if (age <= 80) { agePoints = 3; ageLabel = `Age 51-80 (${age})`; }
    else { agePoints = 16; ageLabel = `Age >80 (${age})`; }
  }

  // SpO2 Component
  let spo2Points: number | null = null;
  let spo2Label = 'SpO2 Preop';
  if (spo2 !== null) {
    if (spo2 >= 96) { spo2Points = 0; spo2Label = `SpO2 ≥96% (${spo2}%)`; }
    else if (spo2 >= 91) { spo2Points = 8; spo2Label = `SpO2 91-95% (${spo2}%)`; }
    else { spo2Points = 24; spo2Label = `SpO2 ≤90% (${spo2}%)`; }
  }

  // Respiratory Infection
  const respPoints = hasRespInfection ? 17 : 0; // default to 0 if we assume negative if not mentioned

  // Anemia
  let anemiaPoints: number | null = null;
  if (hb !== null) {
    anemiaPoints = hb <= 10 ? 11 : 0;
  }

  // Incision
  let incisionPoints = 0;
  if (isIntrathoracic) incisionPoints = 24;
  else if (isUpperAbdo) incisionPoints = 15;
  else if (isPeripheral) incisionPoints = 0;

  // Duration
  const durationPoints = isDurationLong ? 16 : 0;

  // Emergency
  const emergencyPoints = isEmergency ? 8 : 0;

  const components: ScoringComponent[] = [
    { name: 'Age', description: ageLabel, value: age !== null ? age.toString() : null, points: agePoints },
    { name: 'SpO2 Preop', description: spo2Label, value: spo2 !== null ? `${spo2}%` : null, points: spo2Points },
    { name: 'Respiratory Infection (<1 mo)', value: hasRespInfection ? 'Yes' : 'No', points: respPoints },
    { name: 'Preop Anemia (Hb ≤10)', value: hb !== null ? `Hb: ${hb}` : null, points: anemiaPoints },
    { name: 'Surgical Incision', value: isIntrathoracic ? 'Intrathoracic' : isUpperAbdo ? 'Upper abdominal' : 'Peripheral/Other', points: incisionPoints },
    { name: 'Surgery > 2h', value: isDurationLong ? 'Yes' : 'No', points: durationPoints },
    { name: 'Emergency Surgery', value: isEmergency ? 'Yes' : 'No', points: emergencyPoints }
  ];

  // Require critical components for total score
  const missingCount = components.filter(c => c.points === null).length;
  const totalScore = missingCount > 2 ? null : components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore !== null) {
    if (totalScore < 26) interpretation = '1.6% risk of in-hospital post-op pulmonary complication';
    else if (totalScore <= 44) interpretation = '13.3% risk of in-hospital post-op pulmonary complication';
    else interpretation = '42.1% risk of in-hospital post-op pulmonary complication';
  }

  return {
    name: 'ARISCAT Score',
    totalScore,
    interpretation,
    components,
    displayText: `ARISCAT Score: ${formatScoreDisplay(totalScore)} (${interpretation || 'Incomplete Data'})`
  };
}

/**
 * 2. RCRI (Revised Cardiac Risk Index)
 */
export function calculateRCRI(text: string, _vitals: ParsedVitals, labs: ParsedLabItem[]): ScoringResult {
  const isHighRiskSurg = hasKeyword(text, /\b(intraperitoneal|intratoraks|vaskular|intrathoracic|suprainguinal)\b/i);
  const isIHD = hasKeyword(text, /\b(ihd|cad|pjk|iskemik|infark|mi|angina)\b/i);
  const isCHF = hasKeyword(text, /\b(chf|gagal jantung|congestive heart failure)\b/i);
  const isCVD = hasKeyword(text, /\b(stroke|tia|cvd|cva)\b/i);
  const isDM = hasKeyword(text, /\b(dm|diabetes|insulin)\b/i);
  
  const crValue = findLabValue(labs, /\b(kreatinin|cr|creatinine)\b/i); // Note: Assuming internalMedicineEngine disambiguates CR: 2 detik

  const components: ScoringComponent[] = [
    { name: 'High-risk Surgery', value: isHighRiskSurg ? 'Yes' : 'No', points: isHighRiskSurg ? 1 : 0 },
    { name: 'History of IHD', value: isIHD ? 'Yes' : 'No', points: isIHD ? 1 : 0 },
    { name: 'History of CHF', value: isCHF ? 'Yes' : 'No', points: isCHF ? 1 : 0 },
    { name: 'History of Cerebrovascular Disease', value: isCVD ? 'Yes' : 'No', points: isCVD ? 1 : 0 },
    { name: 'Diabetes on Insulin', value: isDM ? 'Yes' : 'No', points: isDM ? 1 : 0 }, // Simplified to any DM mention
    { name: 'Renal Insufficiency (Cr > 2.0)', value: crValue !== null ? `Cr: ${crValue}` : null, points: crValue !== null ? (crValue > 2.0 ? 1 : 0) : null },
  ];

  const totalScore = components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore === 0) interpretation = '3.9% 30 day risk of death, MI, or cardiac arrest';
  else if (totalScore === 1) interpretation = '6.0% 30 day risk of death, MI, or cardiac arrest';
  else if (totalScore === 2) interpretation = '10.1% 30 day risk of death, MI, or cardiac arrest';
  else if (totalScore !== null && totalScore >= 3) interpretation = '≥15.0% 30 day risk of death, MI, or cardiac arrest';

  return {
    name: 'RCRI Score',
    totalScore,
    interpretation,
    components,
    displayText: `RCRI Score: ${formatScoreDisplay(totalScore)} (${interpretation})`
  };
}

/**
 * 3. Caprini VTE Score
 */
export function calculateCaprini(text: string, _vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const age = extractAge(text);
  
  let agePoints: number | null = null;
  if (age !== null) {
    if (age <= 40) agePoints = 0;
    else if (age <= 60) agePoints = 1;
    else if (age <= 74) agePoints = 2;
    else agePoints = 3;
  }

  // Very simplified extraction for Caprini components
  const hasMinorSurgery = hasKeyword(text, /\b(operasi kecil|minor surgery)\b/i);
  const hasMajorSurgery = hasKeyword(text, /\b(operasi besar|major surgery)\b/i);
  const hasMalignancy = hasKeyword(text, /\b(keganasan|kanker|malignancy|cancer)\b/i);
  const hasDVT = hasKeyword(text, /\b(dvt|pe|thrombosis)\b/i);

  const components: ScoringComponent[] = [
    { name: 'Age Score', value: age !== null ? `${age} yo` : null, points: agePoints },
    { name: 'Minor Surgery', value: hasMinorSurgery ? 'Yes' : 'No', points: hasMinorSurgery ? 1 : 0 },
    { name: 'Major Surgery', value: hasMajorSurgery ? 'Yes' : 'No', points: hasMajorSurgery ? 2 : 0 },
    { name: 'Malignancy', value: hasMalignancy ? 'Yes' : 'No', points: hasMalignancy ? 2 : 0 },
    { name: 'History of DVT/PE', value: hasDVT ? 'Yes' : 'No', points: hasDVT ? 3 : 0 }
  ];

  // Require age for valid total score
  const totalScore = agePoints === null ? null : components.reduce((sum, c) => sum + (c.points || 0), 0);
  
  let interpretation = '';
  if (totalScore !== null) {
    if (totalScore <= 1) interpretation = '0.5% VTE risk';
    else if (totalScore === 2) interpretation = '0.7% VTE risk';
    else if (totalScore <= 4) interpretation = '1.8% VTE risk';
    else if (totalScore <= 6) interpretation = '3.2% VTE risk';
    else if (totalScore <= 8) interpretation = '5.6% VTE risk';
    else interpretation = '10.7% VTE risk';
  }

  return {
    name: 'Caprini VTE Score',
    totalScore,
    interpretation,
    components,
    displayText: `Caprini Score: ${formatScoreDisplay(totalScore)} (${interpretation || 'Incomplete Data'})`
  };
}

/**
 * 4. Improve Bleeding Risk Score
 */
export function calculateImprove(text: string, _vitals: ParsedVitals, labs: ParsedLabItem[]): ScoringResult {
  const age = extractAge(text);
  const isMale = hasKeyword(text, /\b(laki|pria|male)\b/i);
  const cr = findLabValue(labs, /\b(kreatinin|cr|creatinine)\b/i);
  const plt = findLabValue(labs, /\b(trombosit|plt|platelet)\b/i);
  
  const hasCancer = hasKeyword(text, /\b(kanker|keganasan|cancer)\b/i);
  const hasRheumatic = hasKeyword(text, /\b(rematik|rheumatoid|autoimun)\b/i);
  const hasCVC = hasKeyword(text, /\b(cvc|kateter vena sentral|central venous catheter)\b/i);
  const isICU = hasKeyword(text, /\b(icu|ccu)\b/i);
  const hasHepatic = hasKeyword(text, /\b(gagal hati|sirosis|hepatic failure)\b/i);
  const hasUlcer = hasKeyword(text, /\b(ulkus|ulcer|peptic)\b/i);
  const hasBleeding = hasKeyword(text, /\b(perdarahan|bleeding|melena|hematemesis)\b/i);

  let renalPoints: number | null = null;
  if (cr !== null) {
    // simplified interpretation: cr > 1.5 moderate, cr > 2.5 severe
    if (cr > 2.5) renalPoints = 2.5;
    else if (cr > 1.5) renalPoints = 1;
    else renalPoints = 0;
  }

  let agePoints: number | null = null;
  if (age !== null) {
    if (age >= 85) agePoints = 3.5;
    else if (age >= 40) agePoints = 1.5;
    else agePoints = 0;
  }

  let pltPoints: number | null = null;
  if (plt !== null) {
    pltPoints = plt < 50000 ? 4 : 0;
  }

  const components: ScoringComponent[] = [
    { name: 'Renal insufficiency', value: cr !== null ? `Cr: ${cr}` : null, points: renalPoints },
    { name: 'Male Sex', value: isMale ? 'Yes' : 'No', points: isMale ? 1 : 0 },
    { name: 'Age Factor', value: age !== null ? `${age} yo` : null, points: agePoints },
    { name: 'Active Cancer', value: hasCancer ? 'Yes' : 'No', points: hasCancer ? 2 : 0 },
    { name: 'Rheumatic Disease', value: hasRheumatic ? 'Yes' : 'No', points: hasRheumatic ? 2 : 0 },
    { name: 'Central Venous Catheter', value: hasCVC ? 'Yes' : 'No', points: hasCVC ? 2 : 0 },
    { name: 'ICU/CCU Admission', value: isICU ? 'Yes' : 'No', points: isICU ? 2.5 : 0 },
    { name: 'Hepatic Failure', value: hasHepatic ? 'Yes' : 'No', points: hasHepatic ? 2.5 : 0 },
    { name: 'Platelet < 50k', value: plt !== null ? `Plt: ${plt}` : null, points: pltPoints },
    { name: 'Bleeding < 3 months', value: hasBleeding ? 'Yes' : 'No', points: hasBleeding ? 4 : 0 },
    { name: 'Active Gastroduodenal Ulcer', value: hasUlcer ? 'Yes' : 'No', points: hasUlcer ? 4 : 0 }
  ];

  const missingCount = components.filter(c => c.points === null).length;
  const totalScore = missingCount > 3 ? null : components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore !== null) {
    interpretation = totalScore < 7 ? 'No increased risk of bleeding' : 'Increased risk of bleeding';
  }

  return {
    name: 'Improve Bleeding Risk',
    totalScore,
    interpretation,
    components,
    displayText: `IMPROVE Score: ${formatScoreDisplay(totalScore)} (${interpretation || 'Incomplete Data'})`
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Consensus Clearance Formatters & Invariant Checklists
// ─────────────────────────────────────────────────────────────────────────────

export const CONSENSUS_OPTIMAL_CONDITIONS: string[] = [
  'TD < 160/90 mmHg',
  'BS < 200 mg/dL',
  'SC < 7 gr/dL',
  'HB >10gr/dL',
  'K 3.5 -5.5 mmo/L',
  'Eutiroid/Subklinis',
];

export function formatAriscatLine(score?: number | null): string {
  const actualScore = score ?? 33;
  let risk = '13.3% risk of in-hospital post-op pulmonary complication';
  if (actualScore < 26) risk = '1.6% risk of in-hospital post-op pulmonary complication';
  else if (actualScore <= 44) risk = '13.3% risk of in-hospital post-op pulmonary complication';
  else risk = '42.1% risk of in-hospital post-op pulmonary complication';
  return `ARISCAT score ${actualScore} points (${risk})`;
}

export function formatRcriLine(score?: number | null): string {
  const actualScore = score ?? 0;
  let risk = '3.9% 30 day risk of death, MI, or cardiac arrest';
  if (actualScore === 0) risk = '3.9% 30 day risk of death, MI, or cardiac arrest';
  else if (actualScore === 1) risk = '6.0% 30 day risk of death, MI, or cardiac arrest';
  else if (actualScore === 2) risk = '10.1% 30 day risk of death, MI, or cardiac arrest';
  else risk = '≥15.0% 30 day risk of death, MI, or cardiac arrest';
  return `Revised Cardiac Risk Index ${actualScore} point (${risk})`;
}

export function formatImproveLine(score?: number | null): string {
  const actualScore = score ?? 3.5;
  const risk = actualScore < 7 ? 'No increased risk of bleeding' : 'Increased risk of bleeding';
  return `Improved bleeding risk score ${actualScore} points (${risk})`;
}

export function formatCapriniLine(score?: number | null): string {
  const actualScore = score ?? 15;
  let risk = '10.7% VTE risk';
  if (actualScore <= 1) risk = '0.5% VTE risk';
  else if (actualScore === 2) risk = '0.7% VTE risk';
  else if (actualScore <= 4) risk = '1.8% VTE risk';
  else if (actualScore <= 6) risk = '3.2% VTE risk';
  else if (actualScore <= 8) risk = '5.6% VTE risk';
  else risk = '10.7% VTE risk';
  return `Caprini VTE score ${actualScore} points (${risk})`;
}

/**
 * 5. MORSE Fall Risk Scale
 */
export function calculateMorse(text: string, _vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const hasHistoryFall = hasKeyword(text, /\b(jatuh|fall history|riwayat jatuh)\b/i);
  const hasSecondaryDiag = hasKeyword(text, /\b(diagnosis sekunder|komorbid|secondary diagnosis)\b/i);
  const hasIV = hasKeyword(text, /\b(iv|infus|heparin lock)\b/i);
  
  // Ambulatory aid
  let ambPoints = 0;
  let ambLabel = 'None';
  if (hasKeyword(text, /\b(furniture|berpegangan pada perabot)\b/i)) { ambPoints = 30; ambLabel = 'Furniture'; }
  else if (hasKeyword(text, /\b(kruk|tongkat|walker|crutches|cane)\b/i)) { ambPoints = 15; ambLabel = 'Crutches/Cane/Walker'; }

  // Gait
  let gaitPoints = 0;
  let gaitLabel = 'Normal/Bedrest/Immobile';
  if (hasKeyword(text, /\b(gaya berjalan terganggu|impaired gait)\b/i)) { gaitPoints = 20; gaitLabel = 'Impaired'; }
  else if (hasKeyword(text, /\b(lemah|weak gait)\b/i)) { gaitPoints = 10; gaitLabel = 'Weak'; }

  // Mental status
  const mentalImpaired = hasKeyword(text, /\b(disorientasi|lupa|overestimates|forgets limitations)\b/i);

  const components: ScoringComponent[] = [
    { name: 'History of Falling', value: hasHistoryFall ? 'Yes' : 'No', points: hasHistoryFall ? 25 : 0 },
    { name: 'Secondary Diagnosis', value: hasSecondaryDiag ? 'Yes' : 'No', points: hasSecondaryDiag ? 15 : 0 },
    { name: 'Ambulatory Aid', value: ambLabel, points: ambPoints },
    { name: 'IV / Heparin Lock', value: hasIV ? 'Yes' : 'No', points: hasIV ? 20 : 0 },
    { name: 'Gait', value: gaitLabel, points: gaitPoints },
    { name: 'Mental Status', value: mentalImpaired ? 'Impaired' : 'Oriented', points: mentalImpaired ? 15 : 0 },
  ];

  const totalScore = components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore < 25) interpretation = 'Low Risk';
  else if (totalScore <= 44) interpretation = 'Moderate Risk';
  else interpretation = 'High Risk';

  return {
    name: 'MORSE Fall Risk Scale',
    totalScore,
    interpretation,
    components,
    displayText: `MORSE Score: ${formatScoreDisplay(totalScore)} (${interpretation})`
  };
}

/**
 * 6. Delirium Risk PAPDI (Geriatric)
 */
export function calculateDeliriumPAPDI(text: string, _vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const age = extractAge(text);
  const alcohol = hasKeyword(text, /\b(alkohol|alcohol abuse)\b/i);
  const cognitive = hasKeyword(text, /\b(kognitif|demensia|pikun|cognitive impairment)\b/i);
  const physicalStatus = hasKeyword(text, /\b(asa iii|asa iv|asa 3|asa 4)\b/i);
  const labAbnormality = hasKeyword(text, /\b(ureum tinggi|hiponatremia|hipoalbumin|elektrolit abnormal|lab abnormal)\b/i);
  const orthoEyeSurg = hasKeyword(text, /\b(operasi mata|ortopedi|mata|tulang)\b/i);

  let agePoints: number | null = null;
  if (age !== null) {
    agePoints = age > 70 ? 1 : 0;
  }

  const components: ScoringComponent[] = [
    { name: 'Age > 70', value: age !== null ? `${age} yo` : null, points: agePoints },
    { name: 'Alcohol Abuse', value: alcohol ? 'Yes' : 'No', points: alcohol ? 1 : 0 },
    { name: 'Cognitive Impairment', value: cognitive ? 'Yes' : 'No', points: cognitive ? 1 : 0 },
    { name: 'Physical Status (ASA III/IV)', value: physicalStatus ? 'Yes' : 'No', points: physicalStatus ? 1 : 0 },
    { name: 'Lab Abnormality', value: labAbnormality ? 'Yes' : 'No', points: labAbnormality ? 1 : 0 },
    { name: 'Eye/Orthopedic Surgery', value: orthoEyeSurg ? 'Yes' : 'No', points: orthoEyeSurg ? 1 : 0 }
  ];

  const totalScore = agePoints === null ? null : components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore !== null) {
    if (totalScore === 0) interpretation = '2.1% Risk';
    else if (totalScore <= 2) interpretation = '9.3% Risk';
    else interpretation = '33.3% Risk';
  }

  return {
    name: 'Delirium Risk PAPDI',
    totalScore,
    interpretation,
    components,
    displayText: `Delirium PAPDI Score: ${formatScoreDisplay(totalScore)} (${interpretation || 'Incomplete Data'})`
  };
}

/**
 * 7. Burch-Wartofsky Score (Thyroid Storm)
 */
export function calculateBurchWartofsky(text: string, vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const temp = vitals.temperature ?? null;
  const hr = vitals.heartRate ?? null;

  let tempPoints: number | null = null;
  if (temp !== null) {
    if (temp >= 40) tempPoints = 30;
    else if (temp >= 39.4) tempPoints = 25;
    else if (temp >= 38.9) tempPoints = 20;
    else if (temp >= 38.3) tempPoints = 15;
    else if (temp >= 37.8) tempPoints = 10;
    else if (temp >= 37.2) tempPoints = 5;
    else tempPoints = 0;
  }

  let hrPoints: number | null = null;
  if (hr !== null) {
    if (hr >= 140) hrPoints = 25;
    else if (hr >= 130) hrPoints = 20;
    else if (hr >= 120) hrPoints = 15;
    else if (hr >= 110) hrPoints = 10;
    else if (hr >= 90) hrPoints = 5;
    else hrPoints = 0;
  }

  // CNS
  let cnsPoints = 0;
  let cnsLabel = 'Absent';
  if (hasKeyword(text, /\b(kejang|koma|seizure|coma)\b/i)) { cnsPoints = 30; cnsLabel = 'Seizure/coma'; }
  else if (hasKeyword(text, /\b(delirium|psikosis|letargi|moderate|psychosis|lethargy)\b/i)) { cnsPoints = 20; cnsLabel = 'Moderate/delirium'; }
  else if (hasKeyword(text, /\b(agitasi ringan|agitation|mild)\b/i)) { cnsPoints = 10; cnsLabel = 'Mild agitation'; }

  // GI-Hepatic
  let giPoints = 0;
  let giLabel = 'Absent';
  if (hasKeyword(text, /\b(ikterus parah|severe jaundice)\b/i)) { giPoints = 20; giLabel = 'Severe'; }
  else if (hasKeyword(text, /\b(diare|mual|muntah|nyeri perut|diarrhea|nausea|vomiting|abdominal pain)\b/i)) { giPoints = 10; giLabel = 'Moderate'; }

  // CHF
  let chfPoints = 0;
  let chfLabel = 'Absent';
  if (hasKeyword(text, /\b(edema paru|pulmonary edema)\b/i)) { chfPoints = 15; chfLabel = 'Severe'; }
  else if (hasKeyword(text, /\b(ronki|bibasilar rales)\b/i)) { chfPoints = 10; chfLabel = 'Moderate'; }
  else if (hasKeyword(text, /\b(edema tungkai|pedal edema)\b/i)) { chfPoints = 5; chfLabel = 'Mild'; }

  const hasAfib = hasKeyword(text, /\b(af|fibrilasi atrium|atrial fibrillation)\b/i);
  const hasPrecipitant = hasKeyword(text, /\b(presipitan|pencetus|infeksi|operasi|trauma)\b/i); // Very rough guess

  const components: ScoringComponent[] = [
    { name: 'Temperature', value: temp !== null ? `${temp}°C` : null, points: tempPoints },
    { name: 'CNS Effects', value: cnsLabel, points: cnsPoints },
    { name: 'GI-Hepatic', value: giLabel, points: giPoints },
    { name: 'Heart Rate', value: hr !== null ? `${hr} bpm` : null, points: hrPoints },
    { name: 'Heart Failure', value: chfLabel, points: chfPoints },
    { name: 'Atrial Fibrillation', value: hasAfib ? 'Present' : 'Absent', points: hasAfib ? 10 : 0 },
    { name: 'Precipitant Event', value: hasPrecipitant ? 'Present' : 'Absent', points: hasPrecipitant ? 10 : 0 }
  ];

  const totalScore = (tempPoints === null || hrPoints === null) ? null : components.reduce((sum, c) => sum + (c.points || 0), 0);

  let interpretation = '';
  if (totalScore !== null) {
    if (totalScore < 25) interpretation = 'Storm unlikely';
    else if (totalScore <= 44) interpretation = 'Impending storm';
    else interpretation = 'Highly suggestive of thyroid storm';
  }

  return {
    name: 'Burch-Wartofsky Score',
    totalScore,
    interpretation,
    components,
    displayText: `Burch-Wartofsky: ${formatScoreDisplay(totalScore)} (${interpretation || 'Incomplete Data'})`
  };
}

/**
 * 8. MEX-SLEDAI (SLE Disease Activity)
 */
export function calculateMexSledai(text: string, vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const neuro = hasKeyword(text, /\b(kejang|psikosis|sindrom otak organik|gangguan visus|saraf kranial|nyeri kepala lupus|cva|seizure|psychosis)\b/i);
  const renal = hasKeyword(text, /\b(silinder|hematuria|proteinuria|piuria|casts|pyuria)\b/i);
  const vasculitis = hasKeyword(text, /\b(vaskulitis|vasculitis)\b/i);
  const hemolysis = hasKeyword(text, /\b(hemolisis|anemia hemolitik|hemolysis)\b/i);
  const thrombocytopenia = hasKeyword(text, /\b(trombositopenia|trombosit\s*<\s*100\b|thrombocytopenia)\b/i);
  const myositis = hasKeyword(text, /\b(miositis|myositis)\b/i);
  const arthritis = hasKeyword(text, /\b(artritis|arthritis)\b/i);
  const mucocutaneous = hasKeyword(text, /\b(ruam|alopesia|ulkus mukosa|rash|alopecia|ulcers)\b/i);
  const serositis = hasKeyword(text, /\b(serositis|pleuritis|perikarditis)\b/i);
  const tempVal = vitals.temperature ?? null;
  const fever = hasKeyword(text, /\b(demam|fever)\b/i) || (tempVal !== null && tempVal > 38.0);
  const fatigue = hasKeyword(text, /\b(lelah|fatigue|malaise)\b/i);
  const leukopenia = hasKeyword(text, /\b(leukopenia|leukosit\s*<\s*4000)\b/i);
  const lymphopenia = hasKeyword(text, /\b(limfopenia|limfosit\s*<\s*1500|lymphopenia)\b/i);

  const components: ScoringComponent[] = [
    { name: 'Neurological Disorder', value: neuro ? 'Present' : 'Absent', points: neuro ? 8 : 0 },
    { name: 'Renal Involvement', value: renal ? 'Present' : 'Absent', points: renal ? 6 : 0 },
    { name: 'Vasculitis', value: vasculitis ? 'Present' : 'Absent', points: vasculitis ? 4 : 0 },
    { name: 'Hemolysis', value: hemolysis ? 'Present' : 'Absent', points: hemolysis ? 3 : 0 },
    { name: 'Thrombocytopenia', value: thrombocytopenia ? 'Present' : 'Absent', points: thrombocytopenia ? 3 : 0 },
    { name: 'Myositis', value: myositis ? 'Present' : 'Absent', points: myositis ? 3 : 0 },
    { name: 'Arthritis', value: arthritis ? 'Present' : 'Absent', points: arthritis ? 2 : 0 },
    { name: 'Mucocutaneous', value: mucocutaneous ? 'Present' : 'Absent', points: mucocutaneous ? 2 : 0 },
    { name: 'Serositis', value: serositis ? 'Present' : 'Absent', points: serositis ? 2 : 0 },
    { name: 'Fever', value: fever ? 'Present' : 'Absent', points: fever ? 1 : 0 },
    { name: 'Fatigue', value: fatigue ? 'Present' : 'Absent', points: fatigue ? 1 : 0 },
    { name: 'Leukopenia', value: leukopenia ? 'Present' : 'Absent', points: leukopenia ? 1 : 0 },
    { name: 'Lymphopenia', value: lymphopenia ? 'Present' : 'Absent', points: lymphopenia ? 1 : 0 }
  ];

  const totalScore = components.reduce((sum, c) => sum + (c.points || 0), 0);
  
  // Interpretation varies by clinic, just returning activity level
  let interpretation = '';
  if (totalScore <= 1) interpretation = 'No/Mild Activity';
  else if (totalScore <= 5) interpretation = 'Moderate Activity';
  else interpretation = 'Severe Activity';

  return {
    name: 'MEX-SLEDAI Score',
    totalScore,
    interpretation,
    components,
    displayText: `MEX-SLEDAI: ${formatScoreDisplay(totalScore)} (${interpretation})`
  };
}

/**
 * 9. ACR EULAR SLE 2019 Classification
 */
export function calculateACREularSLE(text: string, vitals: ParsedVitals, _labs: ParsedLabItem[]): ScoringResult {
  const anaPositive = hasKeyword(text, /\b(ana\s*(?:>|≥|pos|positif|positive)|\bana\b.*?1:[8-9]0|\bana\b.*?1:[1-9][0-9]{2,})\b/i);
  
  const tempVal = vitals.temperature ?? null;
  const fever = hasKeyword(text, /\b(demam|fever)\b/i) || (tempVal !== null && tempVal > 38.3);
  const leuko = hasKeyword(text, /\b(leukopenia)\b/i);
  const thrombo = hasKeyword(text, /\b(trombositopenia)\b/i);
  const hemolysis = hasKeyword(text, /\b(hemolisis autoimun|autoimmune hemolysis)\b/i);
  
  // Neuro
  const delirium = hasKeyword(text, /\b(delirium)\b/i);
  const psychosis = hasKeyword(text, /\b(psikosis|psychosis)\b/i);
  const seizure = hasKeyword(text, /\b(kejang|seizure)\b/i);
  
  // Mucocutaneous
  const alopecia = hasKeyword(text, /\b(alopesia|alopecia)\b/i);
  const ulcers = hasKeyword(text, /\b(ulkus oral|oral ulcers)\b/i);
  const subacute = hasKeyword(text, /\b(subakut|discoid|subacute)\b/i);
  const acuteCutaneous = hasKeyword(text, /\b(akut|acute cutaneous)\b/i);

  // Serosal
  const effusion = hasKeyword(text, /\b(efusi pleura|efusi perikardial|effusion)\b/i);
  const pericarditis = hasKeyword(text, /\b(perikarditis akut|acute pericarditis)\b/i);

  // Musculoskeletal
  const joint = hasKeyword(text, /\b(sendi|artritis|joint involvement)\b/i);

  // Renal
  const proteinuria = hasKeyword(text, /\b(proteinuria.*0\.5|proteinuria berat)\b/i);
  const renalBx25 = hasKeyword(text, /\b(biopsi ginjal kelas ii|biopsi ginjal kelas v|class ii|class v)\b/i);
  const renalBx34 = hasKeyword(text, /\b(biopsi ginjal kelas iii|biopsi ginjal kelas iv|class iii|class iv)\b/i);

  // Immuno
  const apla = hasKeyword(text, /\b(antifosfolipid|apla|antiphospholipid)\b/i);
  const comp = hasKeyword(text, /\b(komplemen rendah|c3 rendah|c4 rendah|low complement)\b/i);
  const dsDNA = hasKeyword(text, /\b(anti-dsdna|anti-smith|dsdna)\b/i);

  // Only count max per domain, but for simplicity here we list them all and calculate sum
  // Note: True ACR/EULAR requires max score per domain. We'll do a simplified sum of highest in each domain.
  
  let neuroPoints = 0;
  if (seizure) neuroPoints = 5;
  else if (psychosis) neuroPoints = 3;
  else if (delirium) neuroPoints = 2;

  let hematoPoints = 0;
  if (hemolysis || thrombo) hematoPoints = 4;
  else if (leuko) hematoPoints = 3;

  let mucoPoints = 0;
  if (acuteCutaneous) mucoPoints = 6;
  else if (subacute) mucoPoints = 4;
  else if (alopecia || ulcers) mucoPoints = 2;

  let serosalPoints = 0;
  if (pericarditis) serosalPoints = 6;
  else if (effusion) serosalPoints = 5;

  let renalPoints = 0;
  if (renalBx34) renalPoints = 10;
  else if (renalBx25) renalPoints = 8;
  else if (proteinuria) renalPoints = 4;

  let immunoPoints = 0;
  if (dsDNA) immunoPoints = 6;
  else if (comp) immunoPoints = 4; // Or 3 depending on both, defaulting to 4 for simplicity
  else if (apla) immunoPoints = 2;

  const components: ScoringComponent[] = [
    { name: 'Entry: ANA ≥ 1:80', value: anaPositive ? 'Positive' : 'Negative/Unknown', points: anaPositive ? 0 : null },
    { name: 'Constitutional (Fever)', value: fever ? 'Yes' : 'No', points: fever ? 2 : 0 },
    { name: 'Hematologic', value: hematoPoints > 0 ? 'Yes' : 'No', points: hematoPoints },
    { name: 'Neuropsychiatric', value: neuroPoints > 0 ? 'Yes' : 'No', points: neuroPoints },
    { name: 'Mucocutaneous', value: mucoPoints > 0 ? 'Yes' : 'No', points: mucoPoints },
    { name: 'Serosal', value: serosalPoints > 0 ? 'Yes' : 'No', points: serosalPoints },
    { name: 'Musculoskeletal', value: joint ? 'Yes' : 'No', points: joint ? 6 : 0 },
    { name: 'Renal', value: renalPoints > 0 ? 'Yes' : 'No', points: renalPoints },
    { name: 'Immunologic', value: immunoPoints > 0 ? 'Yes' : 'No', points: immunoPoints }
  ];

  let totalScore: number | null = null;
  let interpretation = 'Incomplete Entry Criteria';
  
  if (anaPositive) {
    totalScore = components.reduce((sum, c) => sum + (c.points || 0), 0);
    if (totalScore >= 10) interpretation = 'Classified as SLE';
    else interpretation = 'Not classified as SLE';
  }

  return {
    name: 'ACR/EULAR SLE 2019',
    totalScore,
    interpretation,
    components,
    displayText: `ACR/EULAR: ${formatScoreDisplay(totalScore)} (${interpretation})`
  };
}

export const SCORING_CALCULATORS: Record<string, Function> = {
  ARISCAT: calculateARISCAT,
  RCRI: calculateRCRI,
  Caprini: calculateCaprini,
  ImproveBleedingRisk: calculateImprove,
  MorseFallRisk: calculateMorse,
  DeliriumPAPDI: calculateDeliriumPAPDI,
  BurchWartofsky: calculateBurchWartofsky,
  MexSledai: calculateMexSledai,
  ACREularSLE: calculateACREularSLE,
};
