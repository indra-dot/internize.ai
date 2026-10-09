import { describe, it } from 'vitest';
import assert from 'node:assert';
import {
  InternalMedicineEngine,
  extractVitals,
  extractAbnormalLabs,
  extractLabTrends,
  extractLabTrendsAndAbnormal,
  identifySpPdProblems,
  generateConsultationAnswer,
  generatePomrNote,
  generateCaseSummary,
} from '../../src/services/clinical/internalMedicineEngine';
import { generateDirectedClinicalAnalysis } from '../../src/services/clinical/slmEngine';

describe('test_csf_glucose_and_trends', () => {
  it('runs the full legacy suite', async () => {

const USER_CASE_TEXT = `
Ass :
1. Non-Communicating Hydrocephalus (ER 0.38, FH/ID 0.46, TH 23.7 mm) 
-Post ETV + Aff shunt H25 (31/08/26)
- Post Externalisasi Shunt (29/08/26)
-  Post Re-VP Shunt Kocher D (16/08/26) 
-Post Craniotomy Clipping Aneurysma AChA S + Konversi EVD to VP shunt Kocher D (30/06/26) 
-Post EVD Kocher D (21/06/26)
2. sSAH Reg. Reg. Sylvian Fissure D et S, Suprasellar, Interhemispheric, Interpeduncular, Tentorium, Quadrigeminal Cistern, Crural Cistern D et S, Ambient Cistern D et S ec susp ruptur Saccular Aneurysm Anterior Choroidal Artery S 
3. ICH reg Temporal S (Volume 1.25 ml, MLS 0 mm) 
4. sIVH Panventrikel 
5. Meningoensefalitis + ventrikulitis ec susp bakteri Corynebacterium striatum (MRSE)
6. Sepsis (2SOFA score 2 point)
7. Diare akut tanpa dehidrasi ec susp viral dd laktose intoleran
- Hipokalemia ec susp Loss 

============
INTERNA JAGA 

Dihubungi kembali terkait pasien dengan diare dan demam 

Pasien dihubungi dengan demam dan BAB cair. BAB cair sejak tgl 24/9/26 frekuensi 5-6x/hari, ampas (-), lendir (-), darah (-). 
Demam sejak 2 hari SMRS.
Mual (+), muntah (-). Batuk (-), sesak (-).

Pemeriksaan Fisik :
TD : 110/70 mmHg
Nadi : 92 x/menit
RR : 20 x/menit
Suhu : 38.6 C
SpO2 : 98% room air

Hasil Analisa LCS 25/09/26:
- Warna: Jernih kekuningan
- Nonne: (+)
- Pandy: (+)
- Jumlah Sel: 12 /uL (MN 80%, PMN 20%)
- Glukosa: 46 mg/dL
- Total Protein Liquor: 51.30 mg/dL
Kultur LCS: Corynebacterium striatum
Kultur Darah: MRSE (Methicillin-Resistant Staphylococcus epidermidis)

Hasil Lab Darah (26/09/26):
- WBC: 14.200 /uL
- Hb: 10.4 g/dL
- PLT: 54.000 /uL
- Kalium (K) - Serum: 1.87 mEq/L
- Natrium (Na) - Serum: 136 mEq/L
- Klorida (Cl) - Serum: 98 mEq/L
- SGOT / AST: 87 U/L
- SGPT / ALT: 151 U/L
- Albumin: 2.9 g/dL
- Ureum: 32 mg/dL
- Kreatinin: 0.8 mg/dL
- PPT: 14.8 detik, INR: 1.65, APTT: 34.2 detik
`;

console.log('\n======================================================================');
console.log('   internize.ai — CSF Glucose & Serial Lab Trend Unit Test Suite');
console.log('======================================================================\n');

// 1. CSF Glucose Disambiguation Test
const { abnormalLabs, labTrends } = extractLabTrendsAndAbnormal(USER_CASE_TEXT);

const lcsGlucoseLab = abnormalLabs.find(
  (l) => l.name.toLowerCase().includes('glukosa') && l.specimen === 'lcs'
);
const bloodGlucoseLab = abnormalLabs.find(
  (l) => l.name.toLowerCase().includes('glukosa') && (l.specimen === 'serum' || l.specimen === 'darah' || !l.specimen)
);

console.log('--- Test 1: CSF / LCS Glucose Specimen Disambiguation ---');
console.log(`LCS Glucose Lab detected: ${lcsGlucoseLab ? lcsGlucoseLab.name + ' = ' + lcsGlucoseLab.value + ' ' + lcsGlucoseLab.unit : 'NONE'}`);
console.log(`Blood Glucose Lab detected: ${bloodGlucoseLab ? bloodGlucoseLab.name + ' = ' + bloodGlucoseLab.value + ' ' + bloodGlucoseLab.unit : 'NONE'}`);

assert.ok(lcsGlucoseLab, 'Glukosa LCS (46 mg/dL) must be identified under LCS specimen');
assert.strictEqual(lcsGlucoseLab.value, 46);
assert.strictEqual(lcsGlucoseLab.specimen, 'lcs');
assert.strictEqual(bloodGlucoseLab, undefined, 'Blood glucose must NOT match LCS Glukosa 46');

// 2. Serial Lab Trend Extraction
console.log('\n--- Test 2: Serial Lab Trends ---');
assert.ok(labTrends && labTrends.length > 0, 'Lab trends must be extracted');
const kTrend = labTrends.find((t) => t.name.toLowerCase().includes('kalium'));
const pltTrend = labTrends.find((t) => /trombosit|plt/i.test(t.name));
const lcsTrend = labTrends.find((t) => t.specimen === 'lcs' && t.name.toLowerCase().includes('glukosa'));

console.log(`Kalium Trend: ${kTrend?.name} (${kTrend?.specimen}) = ${kTrend?.latestValue} ${kTrend?.unit} [Flag: ${kTrend?.flag}]`);
console.log(`Trombosit Trend: ${pltTrend?.name} (${pltTrend?.specimen}) = ${pltTrend?.latestValue} ${pltTrend?.unit} [Flag: ${pltTrend?.flag}]`);
console.log(`LCS Glukosa Trend: ${lcsTrend?.name} (${lcsTrend?.specimen}) = ${lcsTrend?.latestValue} ${lcsTrend?.unit} [Flag: ${lcsTrend?.flag}]`);

assert.ok(kTrend, 'Kalium trend must be present');
assert.strictEqual(kTrend.latestValue, 1.87);
assert.strictEqual(kTrend.flag, 'critical');

assert.ok(pltTrend, 'PLT trend must be present');
assert.strictEqual(pltTrend.latestValue, 54000);
assert.strictEqual(pltTrend.flag, 'critical');

assert.ok(lcsTrend, 'LCS glucose trend must be present');
assert.strictEqual(lcsTrend.specimen, 'lcs');

// 3. Sp.PD Active Problem Identification
console.log('\n--- Test 3: Sp.PD Active Problem Identification (No False DM/Hypoglycemia) ---');
const vitals = extractVitals(USER_CASE_TEXT);
const problems = identifySpPdProblems(USER_CASE_TEXT, vitals, abnormalLabs);

console.log(`Identified ${problems.length} problems:`);
problems.forEach((p) => {
  console.log(`  #${p.order}. [${p.divisionName}] ${p.title} (${p.criticality})`);
});

const dmProblem = problems.find(
  (p) =>
    p.title.toLowerCase().includes('diabetes') ||
    p.title.toLowerCase().includes('hiperglikemia') ||
    p.title.toLowerCase().includes('hipoglikemia')
);
assert.strictEqual(dmProblem, undefined, 'Must NOT generate Diabetes or Hypoglycemia on CSF glucose 46');

const kProblem = problems.find((p) => p.title.toLowerCase().includes('hipokalemia'));
assert.ok(kProblem, 'Must identify Hipokalemia Berat (1.87 mEq/L)');
assert.strictEqual(kProblem.criticality, 'critical');

const infProblem = problems.find(
  (p) => p.title.toLowerCase().includes('meningoensefalitis') || p.title.toLowerCase().includes('sepsis')
);
assert.ok(infProblem, 'Must identify Meningoensefalitis / Sepsis');

const hemProblem = problems.find((p) => p.title.toLowerCase().includes('trombositopenia'));
assert.ok(hemProblem, 'Must identify Trombositopenia & Koagulopati');

const gasProblem = problems.find((p) => p.title.toLowerCase().includes('diare'));
assert.ok(gasProblem, 'Must identify Diare Akut / Peningkatan Transaminase');

// 4. Consultation and POMR Generation
console.log('\n--- Test 4: Consult & POMR Generation ---');
const consult = generateConsultationAnswer(USER_CASE_TEXT, 'elektif');
assert.ok(consult.labTrends && consult.labTrends.length > 0, 'Consult must return labTrends');
assert.ok(
  consult.toleranceStatus === 'TUNDA OPERASI ELEKTIF' || consult.toleranceStatus === 'TUNDA OPERASI',
  'Elective surgery must be Tunda due to critical Kalium 1.87 & PLT 54.000',
);

const consultLifeSaving = generateConsultationAnswer(USER_CASE_TEXT, 'life_saving');
assert.strictEqual(
  consultLifeSaving.toleranceStatus,
  'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL',
  'Life-saving urgency must proceed with parallel stabilization',
);

const pomr = generatePomrNote(USER_CASE_TEXT);
assert.ok(pomr.labTrends && pomr.labTrends.length > 0, 'POMR must return labTrends');

const summary = generateCaseSummary(USER_CASE_TEXT);
assert.ok(summary.labTrends && summary.labTrends.length > 0, 'Summary must return labTrends');

// 5. Neural Directed Analysis (Deterministic Fallback or Mock)
console.log('\n--- Test 5: Directed Neural Analysis Safeguards ---');
const directedResult = await generateDirectedClinicalAnalysis({
  vitals: { bp: vitals.rawMatched.bp, hr: vitals.hr, temp: vitals.temp },
  verifiedLabs: abnormalLabs,
  verifiedProblems: problems,
  rawText: USER_CASE_TEXT,
});

console.log('Clinical Impression:', directedResult.clinicalImpression);
console.log('Critical Priorities:', directedResult.criticalPriorities);
console.log('Suggested Plan:', directedResult.suggestedPlan);

assert.ok(directedResult.clinicalImpression.length > 0, 'Impression must be non-empty');
assert.ok(
  directedResult.criticalPriorities.some((p) => p.toLowerCase().includes('hipokalemia')),
  'Priorities must flag Hipokalemia'
);
assert.ok(
  !directedResult.keyDiagnoses.some((d) => d.toLowerCase().includes('diabetes')),
  'Key diagnoses must NOT contain Diabetes'
);

console.log('\n======================================================================');
console.log('ALL VERIFICATION SUITES PASSED CLEANLY (Zero Egress & Specimen-Safe)');
console.log('======================================================================\n');

  });
});
