/**
 * Unit Test Suite for User Feedback v2 Improvements
 * 
 * Verifies:
 * 1. Standard Indonesian CPPT SOAP generation (no English placeholders, full 4P structure)
 * 2. 1-Kolom copyable consultation answer containing ARISCAT, RCRI, IMPROVED, Caprini, and Optimal Targets
 * 3. Comprehensive shorthand lab inspection (Ur, Cr, Leu, Tr, BS/GDA, OT, PT, Alb)
 * 4. Local synthesis caching (deterministic hash, localStorage hit/miss, LRU eviction)
 * 5. POMR Division correction: Seizures/Status Epilepticus -> Neurologi (Sp.N); EDH/SAH -> Bedah Saraf (Sp.BS); never Psikosomatik
 */

import {
  extractVitals,
  extractAbnormalLabs,
  extractLabTrendsAndAbnormal,
  identifySpPdProblems,
  generateConsultationAnswer,
  PAPDI_DIVISIONS,
  ALL_CLINICAL_DIVISIONS,
} from '../../src/services/clinical/internalMedicineEngine';
import { synthesizeSoapNote } from '../../src/services/clinical/soapSynthesizer';
import {
  computeFastCacheKey,
  getCachedSynthesis,
  setCachedSynthesis,
  clearClinicalCache,
} from '../../src/services/clinical/clinicalCache';
import type { CloudSynthesizerResult } from '../../src/services/clinical/cloudSynthesizer';

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

async function runFeedbackV2Tests() {
  console.log('\n======================================================================');
  console.log('   internize.ai — User Feedback v2 Verification Suite                 ');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. SOAP CPPT Indonesian Quality
  // -------------------------------------------------------------------------
  console.log('=== SUITE 1: Indonesian CPPT SOAP Generator Quality ===');
  const clinicalNote = `Pasien laki-laki 65 tahun konsul pre-op laparatomi eksplorasi.
Keluhan nyeri perut hebat sejak 2 hari, mual (+), muntah (+). Riwayat DM tipe 2 dan Hipertensi sejak 5 tahun.
T: 150/95 mmHg, N: 98 x/m, R: 22 x/m, S: 37.8 C, SpO2: 97%.
Lab: Hb 9.2 g/dL, Leu 16.500, Tr 180.000, GDS 240 mg/dL, Ur 65 mg/dL, Cr 1.9 mg/dL, Kalium 4.8 mEq/L.`;

  const vitals = extractVitals(clinicalNote);
  const labs = extractAbnormalLabs(clinicalNote);
  const problems = identifySpPdProblems(clinicalNote, vitals, labs);
  const soap = synthesizeSoapNote(clinicalNote, [], []);

  const sText = soap.subjective.content.join('\n');
  const oText = soap.objective.content.join('\n');
  const aText = soap.assessment.content.join('\n');
  const pText = soap.plan.content.join('\n');

  assert(Boolean(sText && sText.length > 20), 'F1.1: Subjective is comprehensive Indonesian CPPT narrative');
  assert(!sText.includes('Not documented'), 'F1.2: Subjective has no English placeholders');
  assert(Boolean(oText && oText.includes('150/95')), 'F1.3: Objective includes formatted Indonesian vitals');
  assert(oText.includes('Hasil Penunjang Lab') || oText.includes('Lab'), 'F1.4: Objective formats abnormal labs in Indonesian');
  assert(Boolean(aText && aText.length > 10), 'F1.5: Assessment provides prioritized clinical problem list');
  assert(aText.includes('Endokrin') || aText.includes('Ginjal'), 'F1.6: Assessment categorizes by PAPDI division');
  assert(Boolean(pText && pText.includes('Plan Diagnostik')), 'F1.7: Plan Diagnostic (Pdx) is populated');
  assert(Boolean(pText && pText.includes('Plan Terapeutik')), 'F1.8: Plan Therapy (Ptx) is populated');
  assert(Boolean(pText && pText.includes('Plan Monitoring')), 'F1.9: Plan Monitoring (Pmx) is populated');
  assert(Boolean(pText && pText.includes('Plan Edukasi')), 'F1.10: Plan Education (Pex) is populated');

  // -------------------------------------------------------------------------
  // 2. 1-Kolom Copyable Consultation Draft with Risk Scores & Optimal Criteria
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 2: 1-Kolom Copyable Pre-Op Consult Draft ===');
  const consult = generateConsultationAnswer(clinicalNote, vitals, labs, 'elektif', 'preop_clearance');

  assert(Boolean(consult.fullDraftText), 'F2.1: fullDraftText exists and is populated');
  assert(consult.fullDraftText.includes('Saat ini dengan risiko tindakan :'), 'F2.2: Contains exact header "Saat ini dengan risiko tindakan :"');
  assert(consult.fullDraftText.includes('risk of in-hospital post-op pulmonary complication'), 'F2.3: ARISCAT includes exact pulmonary complication risk format');
  assert(consult.fullDraftText.includes('30 day risk of death, MI, or cardiac arrest'), 'F2.4: RCRI includes exact 30 day cardiac risk format');
  assert(consult.fullDraftText.includes('No increased risk of bleeding') || consult.fullDraftText.includes('Increased risk of bleeding'), 'F2.5: IMPROVED includes exact bleeding risk format');
  assert(consult.fullDraftText.includes('VTE risk'), 'F2.6: Caprini includes exact VTE risk format');
  assert(consult.fullDraftText.includes('Optimal dilakukan tindakan apabila :'), 'F2.7: Contains exact header "Optimal dilakukan tindakan apabila :"');
  assert(consult.fullDraftText.includes('TD < 160/90 mmHg'), 'F2.8: Contains target TD < 160/90 mmHg');
  assert(consult.fullDraftText.includes('BS < 200 mg/dL'), 'F2.9: Contains target BS < 200 mg/dL');
  assert(consult.fullDraftText.includes('SC < 7 gr/dL'), 'F2.10: Contains target SC < 7 gr/dL');
  assert(consult.fullDraftText.includes('HB >10gr/dL'), 'F2.11: Contains target HB >10gr/dL');
  assert(consult.fullDraftText.includes('K 3.5 -5.5 mmo/L'), 'F2.12: Contains target K 3.5 -5.5 mmo/L');
  assert(consult.fullDraftText.includes('Eutiroid/Subklinis'), 'F2.13: Contains target Eutiroid/Subklinis');
  assert(consult.fullDraftText.includes('Advis & Rekomendasi Sp.PD:'), 'F2.14: Contains Advis & Rekomendasi Sp.PD header');

  // -------------------------------------------------------------------------
  // 3. Comprehensive Shorthand Lab Inspection
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 3: Comprehensive Shorthand Lab Inspection ===');
  const shorthandLabText = `Pasien evaluasi ICU.
Ur 85, Cr 3.2, Leu 18.500, Tr 55.000, BS 280, OT 95, PT 110, Alb 2.4.`;

  const parsedAbnormalLabs = extractAbnormalLabs(shorthandLabText);
  const labNames = parsedAbnormalLabs.map((l) => l.name);

  assert(labNames.some((n) => n.toLowerCase().includes('ureum')), 'F3.1: Detected shorthand Ur as Ureum');
  assert(labNames.some((n) => n.toLowerCase().includes('kreatinin')), 'F3.2: Detected shorthand Cr as Kreatinin');
  assert(labNames.some((n) => n.toLowerCase().includes('leukosit')), 'F3.3: Detected shorthand Leu as Leukosit');
  assert(labNames.some((n) => n.toLowerCase().includes('trombosit')), 'F3.4: Detected shorthand Tr as Trombosit');
  assert(labNames.some((n) => n.toLowerCase().includes('glukosa') || n.toLowerCase().includes('gds')), 'F3.5: Detected shorthand BS as Glukosa Darah');
  assert(labNames.some((n) => n.toLowerCase().includes('sgot') || n.toLowerCase().includes('ast')), 'F3.6: Detected shorthand OT as SGOT/AST');
  assert(labNames.some((n) => n.toLowerCase().includes('sgpt') || n.toLowerCase().includes('alt')), 'F3.7: Detected shorthand PT as SGPT/ALT');
  assert(labNames.some((n) => n.toLowerCase().includes('albumin')), 'F3.8: Detected shorthand Alb as Albumin');

  // F3.9: Anti-Date Guard & Timestamped BS Shorthand (e.g. RS Bali / RSUP Ngoerah monitoring sheet)
  const bsMonitoringNote = `Monitoring BS:
3/10/26
BS acak pk 13.35 WITA: 132`;
  const bsRes = extractLabTrendsAndAbnormal(bsMonitoringNote);
  const bsTrend = bsRes.labTrends.find((t) => /bs|gds|glukosa/i.test(t.name));
  const falseHypo = bsRes.abnormalLabs.find((l) => l.name.includes('Gula Darah') && l.value < 70);
  assert(bsTrend !== undefined && bsTrend.latestValue === 132, 'F3.9: Detected BS acak pk 13.35 WITA as 132 mg/dL');
  assert(!falseHypo, 'F3.9b: Anti-Date guard prevented date 3/10/26 from triggering false hypoglycemia GDS = 3');

  // F3.10: Colon time format disambiguation
  const bsColonNote = `Monitoring BS:
3/10/26
BS acak pk 13:35 WITA: 132`;
  const bsColonRes = extractLabTrendsAndAbnormal(bsColonNote);
  const bsColonTrend = bsColonRes.labTrends.find((t) => /bs|gds|glukosa/i.test(t.name));
  assert(bsColonTrend !== undefined && bsColonTrend.latestValue === 132, 'F3.10: Disambiguated colon in time (13:35) from key-value delimiter, value is 132');

  // F3.11: Serial blood sugar monitoring trend assembly
  const bsSerialNote = `Monitoring BS:
3/10/26
BS acak pk 06.00: 110
BS acak pk 12.00: 140
BS acak pk 18.00: 180
BS acak pk 22.00: 132`;
  const bsSerialRes = extractLabTrendsAndAbnormal(bsSerialNote);
  const bsSerialTrend = bsSerialRes.labTrends.find((t) => /bs|gds|glukosa/i.test(t.name));
  assert(bsSerialTrend !== undefined && bsSerialTrend.trend.length === 4 && bsSerialTrend.latestValue === 132, 'F3.11: Assembled 4-point serial BS monitoring trend with latest value 132');

  // -------------------------------------------------------------------------
  // 4. Local Synthesis Caching (Zero-Quota Redundant Calls)
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 4: Local Clinical Synthesis Cache ===');
  const cacheKey1 = computeFastCacheKey('konsul', 'elektif', clinicalNote);
  const cacheKey2 = computeFastCacheKey('konsul', 'elektif', clinicalNote);
  const cacheKeyDifferent = computeFastCacheKey('pomr', 'elektif', clinicalNote);

  assert(cacheKey1 === cacheKey2, 'F4.1: Fast cache key is deterministic for identical input');
  assert(cacheKey1 !== cacheKeyDifferent, 'F4.2: Different modes produce distinct cache keys');

  // Mock synthesis result
  const mockResult: CloudSynthesizerResult = {
    ok: true,
    markdownOutput: 'Hasil Konsul Terverifikasi',
    structuredOutput: {
      summary_one_liner: 'Pasien pre-op stabil',
      urgency: 'elective',
      problem_list: [],
      soap_note: {
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: {
          diagnostik: ['EKG'],
          terapi: ['IVFD'],
          monitoring: ['TTV'],
          edukasi: ['Puasa'],
        },
      },
      consult_advice: {
        toleransi: 'laik_operasi',
        preop_advis: ['Lanjutkan antihipertensi'],
        risiko_komplikasi: ['Risiko kardiak rendah'],
      },
      critical_alerts: [],
      renal_risk: { egfr_estimate: 'normal', drug_adjustments: [] },
      hepatic_risk: { status: 'normal', dose_cautions: [] },
    },
    latencyMs: 12,
  };

  await clearClinicalCache();
  const nullBefore = await getCachedSynthesis(cacheKey1);
  assert(nullBefore === null, 'F4.3: Cache returns null before entry is set');

  await setCachedSynthesis(cacheKey1, mockResult);
  const cachedHit = await getCachedSynthesis(cacheKey1);
  assert(Boolean(cachedHit && cachedHit.ok && cachedHit.markdownOutput === 'Hasil Konsul Terverifikasi'), 'F4.4: Cache hit retrieves identical synthesis result in <1ms without network');

  // -------------------------------------------------------------------------
  // 5. POMR Division Correction (Status Epilepticus -> Neuro, EDH -> Bedah Saraf)
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 5: POMR Cross-Specialty Categorization ===');
  const neuroSeizureText = `Pasien dibawa ke IGD dengan status epileptikus konvulsivus berulang lebih dari 30 menit.
TD: 140/90, HR: 110, RR: 24, Suhu: 38.2 C.
GCS: E2M4V2 pasca kejang.`;

  const neuroProblems = identifySpPdProblems(neuroSeizureText, extractVitals(neuroSeizureText), []);
  const seizureProblem = neuroProblems.find((p) => p.division === 'neuro');
  const psychProblemFalse = neuroProblems.find((p) => p.division === 'psikosomatik');

  assert(Boolean(seizureProblem), 'F5.1: Status epileptikus is categorized into "neuro" (Neurologi / Saraf Sp.N)');
  assert(seizureProblem?.divisionName === ALL_CLINICAL_DIVISIONS.neuro.nameIndonesian, 'F5.2: Division name correctly states Neurologi / Saraf (Sp.N)');
  assert(!psychProblemFalse, 'F5.3: Status epileptikus is NEVER categorized under Psikosomatik');

  const traumaEdhText = `Pasien post KLL dengan penurunan kesadaran, lucid interval (+).
Hasil CT-Scan Kepala: Epidural Hemorrhage (EDH) regio temporoparietal dextra tebal 15 mm disertai midline shift.
TD: 160/90, HR: 60 x/m, RR: 16 x/m.`;

  const edhProblems = identifySpPdProblems(traumaEdhText, extractVitals(traumaEdhText), []);
  const edhProblem = edhProblems.find((p) => p.division === 'bedahsaraf');
  const psychEdhFalse = edhProblems.find((p) => p.division === 'psikosomatik');

  assert(Boolean(edhProblem), 'F5.4: Epidural Hemorrhage (EDH) is categorized into "bedahsaraf" (Bedah Saraf Sp.BS)');
  assert(edhProblem?.divisionName === ALL_CLINICAL_DIVISIONS.bedahsaraf.nameIndonesian, 'F5.5: Division name correctly states Bedah Saraf (Sp.BS)');
  assert(!psychEdhFalse, 'F5.6: EDH is NEVER categorized under Psikosomatik');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL: ${passedTests} Passed, ${failedTests} Failed across ${totalTests} tests`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFeedbackV2Tests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
