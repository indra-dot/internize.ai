import { describe, it } from 'vitest';
import assert from 'node:assert';
import {
  convertOncologyDiagnosis,
  isOncologyText,
} from '../../src/services/clinical/oncologyStagingEngine';
import {
  InternalMedicineEngine,
} from '../../src/services/clinical/internalMedicineEngine';

describe('oncology_conversion', () => {
  it('runs the full legacy suite', () => {

console.log('🧪 Starting Oncology Staging & Conversion Engine Unit Tests...\n');

// ── Test 1: User's Exact Example ─────────────────────────────────────────────
console.log('Test 1: User Reference Case — Adenocarcinoma Rektum cT4bN3bM0 post-colostomy post-NAC FOLFIRI');
{
  const input =
    'Adenocarcinoma rectum cT4bN3bM0, infiltrasi uterus, susp fistula retrouterine, post colostomy (11/8/26), post kemo NAC folfiri seri 2 (10/9/26), pasien saat ini lemas di bed tapi masih bisa duduk sendiri dan makan.';

  assert.strictEqual(isOncologyText(input), true, 'Should detect input as oncology text');

  const res = convertOncologyDiagnosis(input);

  assert.strictEqual(res.isOncologyCase, true, 'Must identify as oncology case');
  assert.strictEqual(res.organ, 'kolorektal', 'Must identify organ as kolorektal');
  assert.strictEqual(res.histology, 'Adenocarcinoma', 'Must identify Adenocarcinoma');

  // TNM
  assert.ok(res.tnm, 'TNM must be parsed');
  assert.strictEqual(res.tnm?.rawT, 'T4b', 'T must be T4b');
  assert.strictEqual(res.tnm?.rawN, 'N3b', 'N must be N3b');
  assert.strictEqual(res.tnm?.rawM, 'M0', 'M must be M0');

  // AJCC 8th Stage Grouping
  assert.ok(res.ajccStage, 'AJCC stage must be looked up');
  assert.strictEqual(res.ajccStage?.stage, 'III C', 'T4bN3bM0 must map to Stage III C in AJCC 8th');
  assert.strictEqual(res.ajccStage?.stageRoman, 'Stadium III C', 'Roman stage display must be Stadium III C');

  // ECOG
  assert.strictEqual(res.ecog.score, 2, 'Lemas di bed tapi bisa duduk sendiri & makan must be ECOG PS 2');
  assert.strictEqual(res.ecog.label, 'ECOG PS 2', 'Label must be ECOG PS 2');

  // Therapies
  assert.ok(res.surgicalInterventions.length >= 1, 'Must detect surgical intervention');
  assert.ok(
    res.surgicalInterventions.some((s) => s.type.toLowerCase().includes('kolostomi') || s.type.toLowerCase().includes('colostomy')),
    'Must detect colostomy',
  );

  assert.ok(res.systemicTherapies.length >= 1, 'Must detect chemo');
  const chemo = res.systemicTherapies.find((t) => t.regimen === 'FOLFIRI');
  assert.ok(chemo, 'Must detect FOLFIRI regimen');
  assert.strictEqual(chemo?.setting, 'NAC', 'Setting must be NAC');
  assert.ok(chemo?.cycle?.includes('II'), 'Cycle must be seri II');

  // Diagnosis One-liner formatting
  assert.ok(res.diagnosisOneLiner.includes('Adenocarcinoma'), 'One-liner must include histology');
  assert.ok(res.diagnosisOneLiner.includes('Stadium III C'), 'One-liner must include Stadium III C');
  assert.ok(res.diagnosisOneLiner.includes('(cT4bN3bM0)'), 'One-liner must include TNM in parentheses');
  assert.ok(res.diagnosisOneLiner.includes('ECOG PS 2'), 'One-liner must include ECOG PS 2');
  assert.ok(res.diagnosisOneLiner.includes('post-'), 'One-liner must include post- therapy suffix');

  // Clinical notes
  assert.ok(res.clinicalNotes.length >= 2, 'Must generate detailed clinical notes');
  assert.ok(
    res.clinicalNotes.some((n) => n.includes('T4b') || n.includes('uterus') || n.includes('fistula')),
    'Notes must detail T4b local invasion',
  );
  assert.ok(
    res.clinicalNotes.some((n) => n.includes('N3b') || n.includes('Stadium III C')),
    'Notes must cite N-category stage confirmation',
  );

  // HOM Considerations
  assert.ok(res.therapyConsiderations.length >= 1, 'Must generate HOM considerations');
  assert.ok(
    res.therapyConsiderations.some((c) => c.includes('re-evaluasi imaging') || c.includes('downstaging') || c.includes('KRAS')),
    'HOM must advise imaging re-staging or biomarker screening',
  );

  console.log('  ✅ Output One-Liner:', res.diagnosisOneLiner);
  console.log('  ✅ Pass!\n');
}

// ── Test 2: M1 Metastasis Universal Rule (Stage IV) ──────────────────────────
console.log('Test 2: Universal Distant Metastasis Rule (M1 → Stadium IV)');
{
  const input =
    'Carcinoma mammae dextra cT2N1M1a, metastasis hepar multiple, ECOG PS 1, rencana kemoterapi lini 1.';
  const res = convertOncologyDiagnosis(input);

  assert.strictEqual(res.organ, 'payudara');
  assert.ok(res.ajccStage?.stage.startsWith('IV'), 'Any M1 must be Stadium IV');
  assert.strictEqual(res.ecog.score, 1, 'ECOG PS 1 must be captured');
  assert.ok(res.metastasisSites.some((s) => s.toLowerCase().includes('hepar')), 'Must detect hepar metastasis');

  console.log('  ✅ Output One-Liner:', res.diagnosisOneLiner);
  console.log('  ✅ Pass!\n');
}

// ── Test 3: Missing Functional Data → Placeholder ────────────────────────────
console.log('Test 3: Missing Functional Description (Placeholder Rule)');
{
  const input = 'Adenocarcinoma colon transversum cT3N1M0 post hemikolektomi kanan.';
  const res = convertOncologyDiagnosis(input);

  assert.strictEqual(res.ecog.score, null, 'Score must be null when no functional narrative is present');
  assert.strictEqual(
    res.ecog.label,
    '[ECOG PS: periksa status fungsional saat visite]',
    'Must emit exact placeholder string',
  );
  assert.ok(
    res.diagnosisOneLiner.includes('[ECOG PS: periksa status fungsional saat visite]'),
    'One-liner must include the exact placeholder',
  );

  console.log('  ✅ Output One-Liner:', res.diagnosisOneLiner);
  console.log('  ✅ Pass!\n');
}

// ── Test 4: Comorbidity Detection ────────────────────────────────────────────
console.log('Test 4: Comorbidities Separated from Primary Oncology Diagnosis');
{
  const input =
    'Adenocarcinoma rectum cT3N0M0, pasien riwayat DM tipe 2 dan Hipertensi grade 2, lemas di ranjang tapi bisa jalan mandiri ke toilet.';
  const res = convertOncologyDiagnosis(input);

  assert.ok(res.comorbidities.length >= 2, 'Must detect DM and Hipertensi');
  assert.ok(res.comorbidities.some((c) => c.name.includes('DM Tipe 2')), 'Must detect DM Tipe 2');
  assert.ok(res.comorbidities.some((c) => c.name.includes('Hipertensi')), 'Must detect Hipertensi');

  // Verify diagnosis one-liner does NOT mix comorbidities directly into the primary oncologic line
  assert.strictEqual(
    res.diagnosisOneLiner.includes('DM Tipe 2'),
    false,
    'One-liner should focus purely on oncologic assessment',
  );

  console.log('  ✅ Comorbidities detected:', res.comorbidities.map((c) => c.name).join(', '));
  console.log('  ✅ Pass!\n');
}

// ── Test 5: End-to-End Integration in InternalMedicineEngine ─────────────────
console.log('Test 5: Integration in InternalMedicineEngine.identifySpPdProblems');
{
  const input =
    'Konsul Onkologi: Adenocarcinoma rectum cT4bN3bM0, infiltrasi uterus, post colostomy (11/8/26), post kemo NAC folfiri seri 2 (10/9/26), lemas di bed tapi masih bisa duduk sendiri dan makan. RPD: DM tipe 2 tidak terkontrol.';

  const vitals = InternalMedicineEngine.extractVitals(input);
  const { abnormalLabs } = InternalMedicineEngine.extractLabTrendsAndAbnormal(input);
  const problems = InternalMedicineEngine.identifySpPdProblems(input, vitals, abnormalLabs);

  assert.ok(problems.length >= 1, 'Problems must be generated');

  // Problem #1 should be the oncologic problem
  const oncoProblem = problems.find((p) => p.division === 'hemato');
  assert.ok(oncoProblem, 'Must have a Hemato/Onkologi problem');
  assert.ok(
    oncoProblem?.title.includes('Adenocarcinoma Rektum Stadium III C (cT4bN3bM0) ECOG PS 2'),
    `Problem title must follow standard: got "${oncoProblem?.title}"`,
  );
  assert.ok(
    oncoProblem?.pdx.some((p) => p.includes('imaging pasca-NAC') || p.includes('KRAS')),
    'Pdx must contain oncology-specific staging/biomarker evaluations',
  );

  // DM comorbidity should also be identified as a separate problem
  const endokrinProblem = problems.find((p) => p.division === 'endokrin');
  assert.ok(endokrinProblem, 'Must have a separate Endokrin problem for DM comorbidity');

  console.log('  ✅ Problem #1:', oncoProblem?.title);
  console.log('  ✅ Comorbid Problem:', endokrinProblem?.title);
  console.log('  ✅ Pass!\n');
}

console.log('🎉 All 5 Oncology Conversion Engine unit tests passed successfully!');

  });
});
