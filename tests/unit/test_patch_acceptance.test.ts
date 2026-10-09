import { describe, it } from 'vitest';
/**
 * internize.ai — Patch Specification Acceptance Verification Suite
 *
 * Explicitly validates all 5 Acceptance Criteria:
 * 1. Primary engine executes 100% local deterministic CROGE (<15ms).
 * 2. Toggle Neural SLM default is OFF / Unloaded with clear GPU requirements.
 * 3. Case with K 1.87 mEq/L & PLT 54.000 /uL in 'elektif' mode produces "TUNDA OPERASI ELEKTIF".
 * 4. Switching to 'life_saving' mode produces "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" without delay terms.
 * 5. Column 3 safety guard detects critical hazards:
 *    - Lethal arrhythmia risk (QTc prolonging drugs + hypokalemia)
 *    - Automated renal eGFR / CrCl & nephrotoxic drugs
 *    - Hepatic impairment alert (AST/ALT > 3x ULN)
 *    - Hemostasis / neurosurgical thrombocytopenia risk
 */

import assert from 'node:assert';
import {
  InternalMedicineEngine,
  generateConsultationAnswer,
  generatePomrNote,
  evaluateClinicalSafetyGuard,
} from '../../src/services/clinical/internalMedicineEngine';
import { ClinicalEngineCoordinator } from '../../src/services/clinical/engine';
import { getSlmStatus } from '../../src/services/clinical/slmEngine';

describe('test_patch_acceptance', () => {
  it('runs the full legacy suite', async () => {

console.log('======================================================================');
console.log('   internize.ai — Acceptance Criteria Verification Suite              ');
console.log('======================================================================\n');

// ── Criteria 1: CROGE Core Sub-15ms Deterministic Benchmark ──
console.log('--- Criterion 1: Instant CROGE Performance Benchmark (<15ms) ---');
const benchmarkInput = `Pasien laki-laki 65 tahun evaluasi pre-op bedah saraf.
TD 170/100 mmHg, HR 78, RR 20, Suhu 37.0 C.
Lab: Kalium 1.87 mEq/L, Trombosit 54.000 /uL, Kreatinin 2.1 mg/dL, GDS 185 mg/dL.`;

// JIT Warmup
generateConsultationAnswer(benchmarkInput, 'elektif');
generatePomrNote(benchmarkInput);
evaluateClinicalSafetyGuard(benchmarkInput);

const start = performance.now();
const consult = generateConsultationAnswer(benchmarkInput, 'elektif');
const pomr = generatePomrNote(benchmarkInput);
const safety = evaluateClinicalSafetyGuard(benchmarkInput);
const elapsed = performance.now() - start;

console.log(`Execution Time (Consult + POMR + Safety Guard): ${elapsed.toFixed(2)} ms`);
assert.ok(elapsed < 15, `Deterministic analysis must execute in < 15ms (Got: ${elapsed.toFixed(2)} ms)`);
console.log('✓ [PASS] Criterion 1: Deterministic CROGE executed well under 15ms limit.\n');

// ── Criteria 2: Neural SLM Default Status ──
console.log('--- Criterion 2: Neural SLM Toggle Default Unloaded ---');
const slmStatus = getSlmStatus();
console.log(`Current SLM Engine Status: ${slmStatus}`);
assert.strictEqual(slmStatus, 'unloaded', 'Neural SLM engine must be unloaded by default');

const defaultAnalysis = await ClinicalEngineCoordinator.analyze(
  'Pasien dengan hipertensi rutin candesartan.',
  // enableNeural is omitted or false
);
assert.strictEqual(defaultAnalysis.neuralMode, false, 'Default coordinator run must have neuralMode = false');
console.log('✓ [PASS] Criterion 2: Neural SLM is strictly unloaded and default OFF.\n');

// ── Criteria 3: Elective Mode Tunda Operasi (K 1.87 & PLT 54.000) ──
console.log('--- Criterion 3: Elective Mode Red-Flag Contraindication Detection ---');
const criticalPatient = `Konsul TS Bedah Saraf: Rencana operasi elektif kraniotomi pada pasien 65 tahun.
TD 170/100 mmHg, HR 78, RR 20.
Laboratorium:
- Kalium: 1.87 mEq/L
- Trombosit: 54.000 /uL
- Kreatinin: 2.1 mg/dL
- SGOT: 135 U/L, SGPT: 142 U/L
RPO: Levofloxacin, Ondansetron, Aspirin, Metformin.`;

const electiveResult = generateConsultationAnswer(criticalPatient, 'elektif');
console.log(`Elective Status: [ ${electiveResult.toleranceStatus} ]`);
console.log(`Tolerance Reason: ${electiveResult.toleranceReason}`);

assert.strictEqual(
  electiveResult.toleranceStatus,
  'TUNDA OPERASI ELEKTIF',
  'Patient with K 1.87 and PLT 54.000 in elective mode must return TUNDA OPERASI ELEKTIF',
);
assert.ok(
  electiveResult.toleranceReason.includes('Gangguan elektrolit berbahaya') ||
    electiveResult.toleranceReason.includes('1.87'),
  'Tolerance reason must highlight critical hypokalemia',
);
assert.ok(
  electiveResult.toleranceReason.includes('Trombositopenia') ||
    electiveResult.toleranceReason.includes('54.000'),
  'Tolerance reason must highlight thrombocytopenia for neurosurgery',
);
assert.ok(
  electiveResult.preOpAdvis.some((a) => a.includes('Koreksi') || a.toLowerCase().includes('pre-op')),
  'Elective advis must contain pre-operative optimization goals',
);
console.log('✓ [PASS] Criterion 3: Elective surgery returned TUNDA OPERASI ELEKTIF with stabilization targets.\n');

// ── Criteria 4: Life-Saving Mode Parallel Support (Never Tunda) ──
console.log('--- Criterion 4: Life-Saving Urgency Mode (Parallel Resuscitation) ---');
const lifeSavingResult = generateConsultationAnswer(criticalPatient, 'life_saving');
console.log(`Life-Saving Status: [ ${lifeSavingResult.toleranceStatus} ]`);
console.log(`Reason: ${lifeSavingResult.toleranceReason}`);

assert.strictEqual(
  lifeSavingResult.toleranceStatus,
  'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL',
  'Life-saving urgency must NEVER return Tunda Operasi',
);
assert.ok(
  !lifeSavingResult.fullDraftText.toLowerCase().includes('tunda operasi'),
  'Life-saving consult letter must not mention tunda operasi',
);
assert.ok(
  lifeSavingResult.preOpAdvis.some((a) => a.includes('CVC') || a.includes('Darah')),
  'Pre-op must advise CVC and standby blood products at operating table',
);
assert.ok(
  lifeSavingResult.intraOpAdvis.some((a) => a.includes('KCl') || a.includes('MAP')),
  'Intra-op must advise simultaneous correction in OR and MAP maintenance',
);
assert.ok(
  lifeSavingResult.postOpAdvis.some((a) => a.includes('ICU') || a.includes('HCU')),
  'Post-op must advise ICU/HCU admission with serial 2-4h lab checks',
);
console.log('✓ [PASS] Criterion 4: Life-saving emergency never delays procedure and shifts to parallel support.\n');

// ── Criteria 5: Column 3 Clinical Safety Guard ──
console.log('--- Criterion 5: Column 3 Drug Safety Guard, Renal/Hepatic & QTc Hazards ---');
const safetyReport = evaluateClinicalSafetyGuard(criticalPatient);

// 1. Renal & Nephrotoxic
console.log(`Renal eGFR: ${safetyReport.renal.eGfr} mL/min (${safetyReport.renal.stage})`);
assert.ok(safetyReport.renal.isImpaired, 'Renal function must be flagged as impaired (Cr 2.1)');
assert.ok(safetyReport.renal.eGfr !== null && safetyReport.renal.eGfr < 60, 'eGFR must be calculated and < 60');
assert.ok(
  safetyReport.renal.flaggedDrugs.some((d) => d.drug === 'Metformin'),
  'Metformin must be flagged for renal dose adjustment / lactic acidosis risk',
);

// 2. Hepatic Impairment
console.log(`Hepatic AST: ${safetyReport.hepatic.astValue} U/L, ALT: ${safetyReport.hepatic.altValue} U/L`);
assert.ok(safetyReport.hepatic.isImpaired, 'Hepatic status must be flagged as impaired (> 3x ULN)');

// 3. Lethal Arrhythmia QTc Warning (Levofloxacin / Ondansetron + Hypokalemia)
const qtcHazard = safetyReport.hazards.find((h) => h.category === 'qtc_arrhythmia');
console.log('QTc Arrhythmia Hazard Title:', qtcHazard?.title);
console.log('QTc Arrhythmia Description:', qtcHazard?.description);
assert.ok(Boolean(qtcHazard), 'Must detect lethal QTc prolongation arrhythmia hazard');
assert.ok(
  qtcHazard?.description.includes('Levofloxacin') || qtcHazard?.description.includes('Ondansetron'),
  'Must identify offending QTc-prolonging drugs',
);
assert.ok(
  qtcHazard?.description.includes('Hipokalemia'),
  'Must identify synergistic risk with Hypokalemia',
);

// 4. Hemostasis Hazard (Aspirin + Neurosurgical Thrombocytopenia)
const bleedHazard = safetyReport.hazards.find((h) => h.category === 'hemostasis_bleeding');
console.log('Bleed Hazard Title:', bleedHazard?.title);
assert.ok(Boolean(bleedHazard), 'Must detect bleeding hazard for Aspirin + Thrombocytopenia in neurosurgery');

// 5. Serial Lab Trends
console.log('Lab Trends Detected:', safetyReport.labTrends.map((t) => `${t.name}: ${t.latestValue} ${t.unit}`));
assert.ok(safetyReport.labTrends.length >= 2, 'Must extract serial lab trends for Kalium and Trombosit');

console.log('\n======================================================================');
console.log('ALL 5 ACCEPTANCE CRITERIA RIGOROUSLY VERIFIED AND PASSED CLEANLY!');
console.log('======================================================================\n');

  });
});
