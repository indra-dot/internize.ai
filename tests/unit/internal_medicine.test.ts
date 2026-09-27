/**
 * Comprehensive Unit Test Suite for Sp.PD Internal Medicine Knowledge Engine
 * Validates:
 * - 11 Divisi IPD PAPDI classification
 * - Vital signs & abnormal lab parsers
 * - Jawab Konsul TS (Toleransi Operasi: Laik / Laik dengan catatan / Tunda)
 * - Periksa Pasien (POMR: Pdx, Ptx, Pmx, Pex)
 * - Ringkas Kasus (Resume Medis, Active Problems, Abnormal Labs)
 * - Edge cases & boundary values
 */

import {
  InternalMedicineEngine,
  PAPDI_DIVISIONS,
  extractVitals,
  extractAbnormalLabs,
  identifySpPdProblems,
  generateConsultationAnswer,
  generatePomrNote,
  generateCaseSummary,
  evaluateClinicalSafetyGuard,
} from '../../src/services/clinical/internalMedicineEngine';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
  }
}

async function runInternalMedicineTests() {
  console.log('\n======================================================================');
  console.log('   internize.ai — Sp.PD Internal Medicine Engine Unit Test Suite       ');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // Suite 1: 11 Divisi IPD PAPDI Taxonomy Coverage
  // -------------------------------------------------------------------------
  console.log('=== SUITE 1: 11 Divisi IPD PAPDI Taxonomy Coverage ===');
  const divisionKeys = Object.keys(PAPDI_DIVISIONS);
  assert(divisionKeys.length === 11, 'U1.1: Exactly 11 PAPDI divisions are defined', `Found ${divisionKeys.length}`);
  assert(Boolean(PAPDI_DIVISIONS.endokrin), 'U1.2: Endokrin division present');
  assert(Boolean(PAPDI_DIVISIONS.ginjal), 'U1.3: Ginjal & Hipertensi (Nefrologi) division present');
  assert(Boolean(PAPDI_DIVISIONS.tropik), 'U1.4: Tropik & Infeksi division present');
  assert(Boolean(PAPDI_DIVISIONS.kardio), 'U1.5: Kardiovaskular division present');
  assert(Boolean(PAPDI_DIVISIONS.pulmo), 'U1.6: Pulmonologi division present');
  assert(Boolean(PAPDI_DIVISIONS.gastro), 'U1.7: Gastroenterohepatologi division present');
  assert(Boolean(PAPDI_DIVISIONS.hemato), 'U1.8: Hematologi & Onkologi Medik division present');
  assert(Boolean(PAPDI_DIVISIONS.reuma), 'U1.9: Reumatologi division present');
  assert(Boolean(PAPDI_DIVISIONS.alergi), 'U1.10: Alergi & Imunologi Klinis division present');
  assert(Boolean(PAPDI_DIVISIONS.geriatri), 'U1.11: Geriatri division present');
  assert(Boolean(PAPDI_DIVISIONS.psikosomatik), 'U1.12: Psikosomatik division present');

  // -------------------------------------------------------------------------
  // Suite 2: Vitals & Critical Lab Value Extraction
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 2: Vitals & Critical Lab Value Extraction ===');
  const sampleNote = 'TD 190/115 mmHg, HR 105 x/m, RR 26 x/m, Suhu 38.5 C, SpO2 91%. Lab: K 6.2 mEq/L, GDS 320 mg/dL, Hb 7.2 g/dL, Trombosit 42.000, Cr 3.1 mg/dL, Troponin positif.';
  const vitals = extractVitals(sampleNote);

  assert(vitals.systolic === 190, 'U2.1: Systolic blood pressure parsed as 190');
  assert(vitals.diastolic === 115, 'U2.2: Diastolic blood pressure parsed as 115');
  assert(vitals.heartRate === 105, 'U2.3: Heart rate parsed as 105');
  assert(vitals.respiratoryRate === 26, 'U2.4: Respiratory rate parsed as 26');
  assert(vitals.temperature === 38.5, 'U2.5: Temperature parsed as 38.5');
  assert(vitals.spO2 === 91, 'U2.6: SpO2 parsed as 91');

  const labs = extractAbnormalLabs(sampleNote);
  assert(labs.length >= 5, 'U2.7: Extracted multiple abnormal labs', `Found ${labs.length}`);

  const kLab = labs.find((l) => l.name.includes('Kalium'));
  assert(Boolean(kLab && kLab.flag === 'critical' && kLab.value === 6.2), 'U2.8: Critical hyperkalemia K 6.2 identified');

  const gdsLab = labs.find((l) => l.name.includes('GDS') || l.name.includes('Gula Darah'));
  assert(Boolean(gdsLab && gdsLab.value === 320 && gdsLab.flag === 'critical'), 'U2.9: Extreme hyperglycemia GDS 320 identified');

  const hbLab = labs.find((l) => l.name.includes('Hemoglobin'));
  assert(Boolean(hbLab && hbLab.value === 7.2 && hbLab.flag === 'critical'), 'U2.10: Severe anemia Hb 7.2 identified');

  const pltLab = labs.find((l) => l.name.includes('Trombosit'));
  assert(Boolean(pltLab && pltLab.value === 42000 && pltLab.flag === 'critical'), 'U2.11: Severe thrombocytopenia 42.000 identified');

  const tropLab = labs.find((l) => l.name.includes('Troponin'));
  assert(Boolean(tropLab && tropLab.flag === 'critical'), 'U2.12: Troponin positive cardiac injury identified');

  // Indonesian clinical shorthand T / N / R / S
  const indoVitals = extractVitals('Status Present: T: 90/60 mmHg, N: 84 x/m, R: 20 x/m, S: 37.2 C');
  assert(indoVitals.systolic === 90 && indoVitals.diastolic === 60, 'U2.13: Indonesian T: 90/60 parsed as BP 90/60 mmHg (not temperature 90 C)');
  assert(indoVitals.heartRate === 84, 'U2.14: Indonesian N: 84 parsed as HR 84');
  assert(indoVitals.respiratoryRate === 20, 'U2.15: Indonesian R: 20 parsed as RR 20');
  assert(indoVitals.temperature === 37.2, 'U2.16: Indonesian S: 37.2 C parsed as Suhu 37.2 C');

  // Standalone BP without prefix
  const standaloneBp = extractVitals('Pemeriksaan Fisik: 140/90 mmHg, Nadi 80 x/m');
  assert(standaloneBp.systolic === 140 && standaloneBp.diastolic === 90, 'U2.17: Standalone 140/90 mmHg parsed accurately');

  // Collision tests: Vitamin K does not trigger Kalium
  const vitKNote = 'Pasien diberikan Vitamin K 10 mg IV. Kalium: 4.2 mEq/L.';
  const vitKLabs = extractAbnormalLabs(vitKNote);
  const vitKKalium = vitKLabs.find((l) => l.name.includes('Kalium'));
  assert(vitKKalium === undefined, 'U2.18: Vitamin K 10 mg does not trigger false hyperkalemia (Kalium 4.2 is normal)');

  // Collision tests: CRT / Capillary refill does not trigger high Creatinine
  const crtNote = 'Pemeriksaan fisik: CR: 2 detik, akral hangat. Kreatinin: 0.9 mg/dL';
  const crtLabs = extractAbnormalLabs(crtNote);
  const crtCr = crtLabs.find((l) => l.name.includes('Kreatinin'));
  assert(crtCr === undefined, 'U2.19: Capillary refill CR: 2 detik does not trigger false high creatinine (Cr 0.9 is normal)');

  // Multi-dot number: 1.050.000 platelets
  const pltNote = 'Laboratorium: Trombosit 1.050.000 /uL';
  const pltLabs = extractAbnormalLabs(pltNote);
  const extremePlt = pltLabs.find((l) => l.name.includes('Trombosit'));
  assert(Boolean(extremePlt && extremePlt.value === 1050000 && extremePlt.flag === 'critical'), 'U2.20: Trombosit 1.050.000 parsed as 1050000 thrombocytosis (not 1050 thrombocytopenia)');

  // HbA1c parsing
  const hba1cNote = 'Laboratorium: GDS 210 mg/dL, HbA1c 8.5%';
  const hba1cLabs = extractAbnormalLabs(hba1cNote);
  const hba1cItem = hba1cLabs.find((l) => l.name.includes('HbA1c'));
  assert(Boolean(hba1cItem && hba1cItem.value === 8.5 && hba1cItem.flag === 'high'), 'U2.21: HbA1c 8.5% parsed and flagged as suboptimal glycemic control');

  // Lactate parsing
  const lactateNote = 'Laboratorium CITO: Laktat 4.5 mmol/L, Leukosit 18.000';
  const lactateLabs = extractAbnormalLabs(lactateNote);
  const lactateItem = lactateLabs.find((l) => l.name.includes('Laktat'));
  assert(Boolean(lactateItem && lactateItem.value === 4.5 && lactateItem.flag === 'critical'), 'U2.22: Laktat 4.5 mmol/L parsed and flagged as critical septic hypoperfusion');

  // -------------------------------------------------------------------------
  // Suite 3: Mode Jawab Konsul TS & Toleransi Operasi
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 3: Mode Jawab Konsul TS & Toleransi Operasi ===');

  // Case A: Stable patient -> LAIK OPERASI
  const stableCase = 'Konsul TS Bedah: Pasien 45 th pro herniotomi elektif. TD 120/80, HR 74, RR 18, GDS 110, Hb 14.2, Cr 0.9. EKG normal.';
  const stableConsult = generateConsultationAnswer(stableCase, 'preop');
  assert(stableConsult.toleranceStatus === 'LAIK OPERASI', 'U3.1: Stable patient is LAIK OPERASI', `Got: ${stableConsult.toleranceStatus}`);
  assert(stableConsult.riskStratification.rcriLeeScore === 0, 'U3.2: RCRI Lee Score is 0 for low-risk patient');
  assert(stableConsult.preOpAdvis.length > 0, 'U3.3: Pre-op advis generated');
  assert(stableConsult.fullDraftText.includes('LAIK OPERASI'), 'U3.4: Full draft text includes LAIK OPERASI');

  // Case B: Controlled comorbidity -> LAIK OPERASI DENGAN CATATAN
  const comorbCase = 'Konsul TS Bedah: Pasien 60 th dengan DM tipe 2 dan Hipertensi, rencana kolesistektomi. TD 150/90, GDS 210, Hb 11.5, Cr 1.1. RPO Metformin, Amlodipin.';
  const comorbConsult = generateConsultationAnswer(comorbCase, 'preop');
  assert(comorbConsult.toleranceStatus === 'LAIK OPERASI DENGAN CATATAN', 'U3.5: Comorbid patient is LAIK OPERASI DENGAN CATATAN', `Got: ${comorbConsult.toleranceStatus}`);
  assert(comorbConsult.preOpAdvis.some((a) => a.toLowerCase().includes('metformin') || a.toLowerCase().includes('target gds') || a.toLowerCase().includes('sliding scale')), 'U3.6: Pre-op advis contains diabetic/metformin guidance');

  // Case C: Critical red flag -> TUNDA OPERASI ELEKTIF
  const criticalCase = 'Konsul TS Bedah: Pasien rencana laparotomi elektif. TD 200/120 mmHg, K 6.4, GDS 360, Troponin positif.';
  const criticalConsult = generateConsultationAnswer(criticalCase, 'elektif');
  assert(
    criticalConsult.toleranceStatus === 'TUNDA OPERASI ELEKTIF' || criticalConsult.toleranceStatus === 'TUNDA OPERASI',
    'U3.7: Red-flag elective patient is TUNDA OPERASI ELEKTIF',
    `Got: ${criticalConsult.toleranceStatus}`,
  );
  assert(
    criticalConsult.toleranceReason.includes('Tekanan darah krisis') ||
      criticalConsult.toleranceReason.includes('elektrolit') ||
      criticalConsult.toleranceReason.includes('Troponin'),
    'U3.8: Tunda reason documents specific unstable parameters',
  );

  // Case D: Rawat Bersama Preset
  const raberConsult = generateConsultationAnswer(comorbCase, 'raber');
  assert(raberConsult.consultType === 'raber', 'U3.9: Rawat Bersama preset honors consultType');
  assert(raberConsult.fullDraftText.includes('RAWAT BERSAMA'), 'U3.10: Full draft includes RAWAT BERSAMA agreement');

  // Case E: Operasi CITO / Life-Saving Emergensi -> Prosedur berjalan dengan stabilisasi paralel
  const lifeSavingConsult = generateConsultationAnswer(criticalCase, 'life_saving');
  assert(
    lifeSavingConsult.toleranceStatus === 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL',
    'U3.11: Life-saving emergency returns parallel stabilization without delaying procedure',
    `Got: ${lifeSavingConsult.toleranceStatus}`,
  );
  assert(
    !lifeSavingConsult.fullDraftText.toLowerCase().includes('tunda operasi'),
    'U3.12: Life-saving consult draft does not contain delay/tunda directives',
  );
  assert(
    lifeSavingConsult.preOpAdvis.some((a) => a.includes('CVC') || a.includes('Darah') || a.includes('simultan')),
    'U3.13: Life-saving pre-op advis contains parallel rescue preparation',
  );

  // -------------------------------------------------------------------------
  // Suite 4: Mode Periksa Pasien (POMR: Pdx, Ptx, Pmx, Pex)
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 4: Mode Periksa Pasien (POMR: Pdx, Ptx, Pmx, Pex) ===');
  const wardPatientNote = `Pasien laki-laki 62 th dirawat di bangsal dengan keluhan sesak dan kaki bengkak.
Pemeriksaan Fisik: TD 160/95 mmHg, HR 96 x/m, RR 24 x/m, Suhu 36.9 C. Ronki basah halus basal (+/+).
Lab: GDS 230 mg/dL, Ureum 65, Kreatinin 1.9, K 4.4, Na 136.
RPO: Captopril 2x25mg, Furosemid 1x40mg, Metformin 2x500mg.`;

  const pomr = generatePomrNote(wardPatientNote);
  assert(pomr.problems.length >= 2, 'U4.1: POMR identified multiple active problems', `Found ${pomr.problems.length}`);

  const prob1 = pomr.problems[0];
  assert(Boolean(prob1.title), 'U4.2: Problem #1 has title');
  assert(Boolean(prob1.divisionName), 'U4.3: Problem #1 has PAPDI division');
  assert(prob1.pdx.length > 0, 'U4.4: Problem #1 has Pdx (Planning Diagnostic)');
  assert(prob1.ptx.length > 0, 'U4.5: Problem #1 has Ptx (Planning Therapy)');
  assert(prob1.pmx.length > 0, 'U4.6: Problem #1 has Pmx (Planning Monitoring)');
  assert(prob1.pex.length > 0, 'U4.7: Problem #1 has Pex (Planning Education)');
  assert(pomr.fullDraftText.includes('PLAN OF MANAGEMENT'), 'U4.8: POMR full draft contains POMR header');

  // -------------------------------------------------------------------------
  // Suite 5: Mode Ringkas Kasus (Resume Medis & Critical Labs)
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 5: Mode Ringkas Kasus (Resume Medis & Critical Labs) ===');
  const summary = generateCaseSummary(wardPatientNote);
  assert(summary.activeProblemList.length > 0, 'U5.1: Case summary active problem list populated');
  assert(summary.pastHistory.length > 0, 'U5.2: Past history (RPD) captured');
  assert(summary.currentMedications.length > 0, 'U5.3: Current medications (RPO) captured');
  assert(summary.ongoingTherapy.length > 0, 'U5.4: Ongoing therapy summary present');
  assert(summary.fullDraftText.includes('RESUME MEDIS & RINGKASAN KASUS'), 'U5.5: Full draft contains case summary header');

  // -------------------------------------------------------------------------
  // Suite 6: Edge Cases & Boundary Values
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 6: Edge Cases & Boundary Values ===');
  const emptyConsult = generateConsultationAnswer('', 'preop');
  assert(Boolean(emptyConsult.fullDraftText), 'U6.1: Empty input generates fallback consult draft');
  assert(emptyConsult.problems.length >= 1, 'U6.2: Empty input generates fallback problem');

  const emptyPomr = generatePomrNote('');
  assert(Boolean(emptyPomr.fullDraftText), 'U6.3: Empty input generates fallback POMR');

  const emptySummary = generateCaseSummary('');
  assert(Boolean(emptySummary.fullDraftText), 'U6.4: Empty input generates fallback summary');

  // -------------------------------------------------------------------------
  // Suite 7: Drug Safety, Renal/Hepatic Guard & Organ Risk Tracker
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 7: Drug Safety, Renal/Hepatic Guard & Organ Risk Tracker ===');
  const complexSafetyNote = `Pasien laki-laki 68 tahun pro evaluasi pre-operatif craniotomy bedah saraf.
Keluhan: Nyeri kepala hebat, mual muntah proyektil, riwayat SDH kronik.
RPO: Ondansetron 3x8mg IV, Levofloxacin 1x750mg drip, Aspirin 1x80mg, Metformin 2x500mg, Paracetamol 3x1000mg.
Pemeriksaan Fisik: TD 185/110 mmHg, HR 62 x/m, RR 20 x/m, Suhu 37.8 C.
Hasil Laboratorium:
- Kalium: 2.1 mEq/L (Hipokalemia Berat)
- Trombosit: 48.000 /uL (Trombositopenia Signifikan)
- Ureum: 88 mg/dL, Kreatinin: 2.8 mg/dL
- SGOT: 145 U/L, SGPT: 168 U/L (Transaminase > 3x ULN)`;

  const safetyReport = evaluateClinicalSafetyGuard(complexSafetyNote);

  // 1. Renal Dose Adjustment & Nephrotoxic Flagging
  assert(safetyReport.renal.isImpaired, 'U7.1: Renal impairment accurately detected (Cr 2.8)');
  assert(safetyReport.renal.eGfr !== null && safetyReport.renal.eGfr < 30, 'U7.2: Automated eGFR calculated (< 30 mL/min)');
  assert(safetyReport.renal.crCl !== null && safetyReport.renal.crCl < 30, 'U7.3: Automated CrCl calculated (< 30 mL/min)');
  assert(
    safetyReport.renal.flaggedDrugs.some((d) => d.drug === 'Metformin' && d.severity === 'critical'),
    'U7.4: Metformin flagged with critical lactic acidosis risk',
  );

  // 2. Hepatic Impairment Alert (AST/ALT > 3x ULN)
  assert(safetyReport.hepatic.isImpaired, 'U7.5: Hepatic impairment detected when AST 145 & ALT 168 (> 3x ULN)');
  assert(
    safetyReport.hepatic.flaggedDrugs.some((d) => d.drug === 'Paracetamol' && d.action.includes('2 g')),
    'U7.6: Paracetamol flagged for dose restriction < 2g/24h in hepatic impairment',
  );

  // 3. Critical Lethal Arrhythmia QTc Warning (Levofloxacin / Ondansetron + Hypokalemia)
  const qtcHazard = safetyReport.hazards.find((h) => h.category === 'qtc_arrhythmia');
  assert(Boolean(qtcHazard), 'U7.7: Lethal QTc arrhythmia hazard detected');
  assert(
    qtcHazard?.description.includes('Levofloxacin') || qtcHazard?.description.includes('Ondansetron'),
    'U7.8: QTc hazard identifies specific interacting QT-prolonging drugs',
  );
  assert(
    qtcHazard?.description.includes('Hipokalemia'),
    'U7.9: QTc hazard links drug with electrolyte deficiency (Hypokalemia)',
  );

  // 4. Critical Hemostasis & Bleeding Hazard (Aspirin + Neurosurgical Thrombocytopenia)
  const bleedHazard = safetyReport.hazards.find((h) => h.category === 'hemostasis_bleeding');
  assert(Boolean(bleedHazard), 'U7.10: Bleeding hazard detected for antithrombotic with thrombocytopenia');
  assert(
    bleedHazard?.recommendation.includes('TC') || bleedHazard?.recommendation.includes('trombosit'),
    'U7.11: Bleeding hazard advises platelet transfusion preparation for neurosurgery',
  );

  // 5. Hypertensive Crisis Hazard (BP 185/110)
  const bpHazard = safetyReport.hazards.find((h) => h.id === 'hazard-hypertensive-crisis');
  assert(Boolean(bpHazard), 'U7.12: Hypertensive crisis end-organ hazard detected for TD 185/110');

  console.log(`\n======================================================================`);
  console.log(`TOTAL: ${passedTests} Passed, ${failedTests} Failed across ${totalTests} tests`);
  console.log(`======================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runInternalMedicineTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
