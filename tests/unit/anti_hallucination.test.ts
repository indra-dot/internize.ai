/**
 * Anti-Hallucination & Clinical Negation Verification Test Suite
 * Validates:
 * 1. Indonesian & English NegEx accuracy in CROGE (isNegatedSpan)
 * 2. Indonesian abbreviation disambiguation (no rm / no telp vs English 'no')
 * 3. Prevention of 2-3 letter abbreviation collisions (Mr, PE, AI, ALL, MS, ED, PAD, CTS, cut)
 * 4. Isolation of Family History (RPK) from patient active problems
 * 5. Elimination of false positive active problems in 11 PAPDI divisions
 * 6. SOAP note anti-leakage protection for pertinent negatives
 */

import { isNegatedSpan, extractSnomed, extractEntities } from '../../src/services/clinical/croge';
import {
  extractVitals,
  extractAbnormalLabs,
  identifySpPdProblems,
  stripFamilyHistory,
  hasAffirmativeMatch,
} from '../../src/services/clinical/internalMedicineEngine';
import { synthesizeSoapNote } from '../../src/services/clinical/soapSynthesizer';

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

async function runAntiHallucinationTests() {
  console.log('\n======================================================================');
  console.log('   internize.ai — Anti-Hallucination & Indonesian NegEx Test Suite    ');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // Suite 1: Indonesian NegEx Engine (isNegatedSpan)
  // -------------------------------------------------------------------------
  console.log('=== SUITE 1: Indonesian NegEx Engine (isNegatedSpan) ===');

  // 1.1 "disangkal" post-trigger
  const t1 = 'Riwayat DM disangkal oleh pasien.';
  const dmIdx = t1.indexOf('DM');
  assert(isNegatedSpan(t1, dmIdx, dmIdx + 2), 'T1.1: "DM disangkal" correctly recognized as negated');

  // 1.2 "tidak ada" pre-trigger
  const t2 = 'Pasien mengaku tidak ada riwayat hipertensi.';
  const htIdx = t2.indexOf('hipertensi');
  assert(isNegatedSpan(t2, htIdx, htIdx + 'hipertensi'.length), 'T1.2: "tidak ada riwayat hipertensi" recognized as negated');

  // 1.3 Symbol "(-)" post-trigger
  const t3 = 'Keluhan: batuk (-), sesak (-), demam (-).';
  const batukIdx = t3.indexOf('batuk');
  const sesakIdx = t3.indexOf('sesak');
  const demamIdx = t3.indexOf('demam');
  assert(isNegatedSpan(t3, batukIdx, batukIdx + 5), 'T1.3a: "batuk (-)" recognized as negated');
  assert(isNegatedSpan(t3, sesakIdx, sesakIdx + 5), 'T1.3b: "sesak (-)" recognized as negated');
  assert(isNegatedSpan(t3, demamIdx, demamIdx + 5), 'T1.3c: "demam (-)" recognized as negated');

  // 1.4 Symbol "(-/-)" post-trigger (Physical exam)
  const t4 = 'Thorax: cor dbn, pulmo ronki (-/-), wheezing (-/-).';
  const ronkiIdx = t4.indexOf('ronki');
  const wheezingIdx = t4.indexOf('wheezing');
  assert(isNegatedSpan(t4, ronkiIdx, ronkiIdx + 5), 'T1.4a: "ronki (-/-)" recognized as negated');
  assert(isNegatedSpan(t4, wheezingIdx, wheezingIdx + 8), 'T1.4b: "wheezing (-/-)" recognized as negated');

  // 1.5 Conjunction breaking negation: "tidak ada DM, tetapi ada hipertensi"
  const t5 = 'Pasien tidak ada riwayat diabetes, tetapi memiliki riwayat hipertensi lama.';
  const dm5Idx = t5.indexOf('diabetes');
  const ht5Idx = t5.indexOf('hipertensi');
  assert(isNegatedSpan(t5, dm5Idx, dm5Idx + 8), 'T1.5a: "diabetes" is negated in pre-conjunction clause');
  assert(!isNegatedSpan(t5, ht5Idx, ht5Idx + 10), 'T1.5b: "hipertensi" is NOT negated after "tetapi"');

  // 1.6 Disambiguation: "no rm" and "no telp" should not negate subsequent diagnosis
  const t6 = 'Pasien dengan no rm 123456, no telp 081234567, riwayat hipertensi terkontrol.';
  const ht6Idx = t6.indexOf('hipertensi');
  assert(!isNegatedSpan(t6, ht6Idx, ht6Idx + 10), 'T1.6: "no rm / no telp" does NOT falsely negate "hipertensi"');

  // 1.7 "menyangkal" and "tanpa"
  const t7 = 'Pasien menyangkal nyeri dada. Pasien datang tanpa sesak napas.';
  const chestPainIdx = t7.indexOf('nyeri dada');
  const dyspneaIdx = t7.indexOf('sesak napas');
  assert(isNegatedSpan(t7, chestPainIdx, chestPainIdx + 10), 'T1.7a: "menyangkal nyeri dada" recognized as negated');
  assert(isNegatedSpan(t7, dyspneaIdx, dyspneaIdx + 11), 'T1.7b: "tanpa sesak napas" recognized as negated');

  // -------------------------------------------------------------------------
  // Suite 2: SNOMED Abbreviation Collision Prevention
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 2: SNOMED Abbreviation Collision Prevention ===');

  // 2.1 "Mr. Budi" must NOT trigger Mitral Regurgitation
  const mrNote = 'Pasien Mr. Budi, 45 tahun, datang untuk konsultasi.';
  const mrConcepts = extractSnomed(mrNote);
  const mrMatches = mrConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('mitral'));
  assert(mrMatches.length === 0, 'T2.1: "Mr. Budi" does NOT trigger Mitral Regurgitation');

  // 2.2 "PE: compos mentis" must NOT trigger Pulmonary Embolism
  const peNote = 'Catatan dokter: PE: compos mentis, TD 120/80 mmHg, nadi 80.';
  const peConcepts = extractSnomed(peNote);
  const peMatches = peConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('pulmonary embolism'));
  assert(peMatches.length === 0, 'T2.2: "PE:" does NOT trigger Pulmonary Embolism');

  // 2.3 "internize.ai" must NOT trigger Aortic Insufficiency
  const aiNote = 'Dianalisis menggunakan platform internize.ai untuk asisten klinis.';
  const aiConcepts = extractSnomed(aiNote);
  const aiMatches = aiConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('aortic'));
  assert(aiMatches.length === 0, 'T2.3: "internize.ai" does NOT trigger Aortic Insufficiency');

  // 2.4 "all vitals stable" must NOT trigger Leukemia
  const allNote = 'Evaluasi post visite: all vitals stable, all labs normal.';
  const allConcepts = extractSnomed(allNote);
  const allMatches = allConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('leukemia'));
  assert(allMatches.length === 0, 'T2.4: "all vitals stable" does NOT trigger Leukemia');

  // 2.5 "PR 160 ms" must NOT trigger Multiple Sclerosis
  const msNote = 'Rekam EKG: irama sinus, PR interval 160 ms, durasi QRS 84 ms.';
  const msConcepts = extractSnomed(msNote);
  const msMatches = msConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('multiple sclerosis'));
  assert(msMatches.length === 0, 'T2.5: "160 ms" does NOT trigger Multiple Sclerosis');

  // 2.6 "Rujukan ED" must NOT trigger Erectile Dysfunction
  const edNote = 'Pasien rujukan dari triage ED RSUD, kondisi stabil.';
  const edConcepts = extractSnomed(edNote);
  const edMatches = edConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('erectile'));
  assert(edMatches.length === 0, 'T2.6: "triage ED" does NOT trigger Erectile Dysfunction');

  // 2.7 "alcohol pad" must NOT trigger Peripheral Vascular Disease
  const padNote = 'Bersihkan area kulit dengan alcohol pad sebelum tindakan.';
  const padConcepts = extractSnomed(padNote);
  const padMatches = padConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('peripheral vascular'));
  assert(padMatches.length === 0, 'T2.7: "alcohol pad" does NOT trigger Peripheral Vascular Disease');

  // 2.8 "CT-Scan (CTS)" must NOT trigger Carpal Tunnel Syndrome
  const ctsNote = 'Pemeriksaan radiologi CTS kepala: tidak tampak perdarahan intrakranial.';
  const ctsConcepts = extractSnomed(ctsNote);
  const ctsMatches = ctsConcepts.filter((c) => c.preferredTerm.toLowerCase().includes('carpal tunnel'));
  assert(ctsMatches.length === 0, 'T2.8: "CTS kepala" does NOT trigger Carpal Tunnel Syndrome');

  // -------------------------------------------------------------------------
  // Suite 3: Family History (RPK) Isolation
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 3: Family History (RPK) Isolation ===');

  const rpkNote = `Anamnesis: Pasien laki-laki 35 tahun, keluhan pusing ringan.
RPK: Ibu menderita DM tipe 2 dan hipertensi, Ayah meninggal karena stroke hemoragik.
Pasien sendiri tidak ada riwayat diabetes, darah tinggi, maupun penyakit jantung.`;

  const stripped = stripFamilyHistory(rpkNote);
  assert(!stripped.includes('Ibu menderita DM'), 'T3.1: stripFamilyHistory successfully removed relative disease context');
  assert(stripped.length === rpkNote.length, 'T3.2: stripFamilyHistory preserved exact character offsets');

  const rpkVitals = extractVitals('TD 118/75 mmHg, HR 72 x/m');
  const rpkLabs = extractAbnormalLabs('GDS 102 mg/dL');
  const rpkProblems = identifySpPdProblems(rpkNote, rpkVitals, rpkLabs);

  const hasDmProblem = rpkProblems.some((p) => p.title.toLowerCase().includes('diabetes'));
  const hasHtProblem = rpkProblems.some((p) => p.title.toLowerCase().includes('hipertensi'));
  const hasStrokeProblem = rpkProblems.some((p) => p.title.toLowerCase().includes('stroke'));

  assert(!hasDmProblem, 'T3.3: Patient is NOT diagnosed with family DM');
  assert(!hasHtProblem, 'T3.4: Patient is NOT diagnosed with family Hypertension');
  assert(!hasStrokeProblem, 'T3.5: Patient is NOT diagnosed with family Stroke');

  // -------------------------------------------------------------------------
  // Suite 4: 11 PAPDI Division Negation Filtering (Zero Hallucination)
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 4: 11 PAPDI Division Negation Filtering ===');

  const healthyNegatedNote = `Pasien 40 tahun kontrol kesehatan rutin tahunan.
Keluhan: Lemas (-), demam (-), batuk (-), sesak (-), mual muntah disangkal, nyeri sendi disangkal.
RPD: DM disangkal, HT disangkal, asma disangkal, alergi obat tidak ada.
Pemeriksaan Fisik: TD 120/80 mmHg, HR 76 x/m, RR 18 x/m, Suhu 36.5 C, SpO2 99%.
Cor/Pulmo: S1 S2 reguler, murmur (-), gallop (-), ronki (-/-), wheezing (-/-).
Abdomen: supel, bising usus normal, nyeri tekan (-), asites (-).
Ekstremitas: akral hangat, CRT < 2 dtk, edema tungkai (-/-).
Laboratorium: Hb 14.2 g/dL, Leukosit 6.800 /uL, Trombosit 245.000 /uL, GDS 98 mg/dL, Ureum 24 mg/dL, Kreatinin 0.9 mg/dL.`;

  const healthyVitals = extractVitals(healthyNegatedNote);
  const healthyLabs = extractAbnormalLabs(healthyNegatedNote);
  const healthyProblems = identifySpPdProblems(healthyNegatedNote, healthyVitals, healthyLabs);

  const falseDm = healthyProblems.some((p) => p.title.toLowerCase().includes('diabetes'));
  const falseHt = healthyProblems.some((p) => p.title.toLowerCase().includes('hipertensi'));
  const falseCap = healthyProblems.some((p) => p.title.toLowerCase().includes('pneumonia') || p.title.toLowerCase().includes('respirasi'));
  const falseAlergi = healthyProblems.some((p) => p.title.toLowerCase().includes('alergi'));
  const falseInfeksi = healthyProblems.some((p) => p.title.toLowerCase().includes('infeksi') || p.title.toLowerCase().includes('febris'));

  assert(!falseDm, 'T4.1: NO false Diabetes Mellitus problem generated');
  assert(!falseHt, 'T4.2: NO false Hypertension problem generated');
  assert(!falseCap, 'T4.3: NO false Pneumonia/CAP problem generated on "ronki (-/-)"');
  assert(!falseAlergi, 'T4.4: NO false Allergy problem generated on "alergi obat tidak ada"');
  assert(!falseInfeksi, 'T4.5: NO false Infection/Fever problem generated on "demam (-)"');

  // Should contain only the fallback general exam problem
  assert(healthyProblems.length === 1, 'T4.6: Exactly 1 general examination problem created for healthy checkup');
  assert(healthyProblems[0].title.includes('Pemeriksaan Klinis Umum'), 'T4.7: Fallback is Pemeriksaan Klinis Umum');

  // -------------------------------------------------------------------------
  // Suite 5: SOAP Synthesizer Anti-Leakage of Pertinent Negatives
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 5: SOAP Synthesizer Anti-Leakage of Pertinent Negatives ===');

  const soapConcepts = extractSnomed(healthyNegatedNote);
  const soapNote = synthesizeSoapNote(healthyNegatedNote, soapConcepts, []);

  // Assessment lines must NOT contain negated conditions
  const assText = soapNote.assessment.content.join(' ');
  assert(!assText.toLowerCase().includes('diabetes'), 'T5.1: SOAP Assessment does NOT contain negated diabetes');
  assert(!assText.toLowerCase().includes('hipertensi'), 'T5.2: SOAP Assessment does NOT contain negated hipertensi');

  // Subjective should properly contain anamnesis negatives
  const subjText = soapNote.subjective.content.join(' ');
  assert(subjText.toLowerCase().includes('disangkal') || subjText.toLowerCase().includes('tidak'), 'T5.3: Subjective contains pertinent negatives');

  // Objective should contain physical exam negatives
  const objText = soapNote.objective.content.join(' ');
  assert(objText.toLowerCase().includes('ronki') || objText.toLowerCase().includes('edema') || objText.includes('(-/-)'), 'T5.4: Objective contains physical exam negative findings');

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

runAntiHallucinationTests().catch((err) => {
  console.error('Test runner encountered error:', err);
  process.exit(1);
});
