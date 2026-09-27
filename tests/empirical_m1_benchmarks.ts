/**
 * empirical_m1_benchmarks.ts
 *
 * Independent Empirical Challenge & Stress-Testing Suite for Milestone 1:
 * 1. Microbenchmark for CROGE latency across 200+ runs with 6 diverse clinical narratives.
 * 2. Stress test RxNorm regex determinism: 50 consecutive runs + interleaved stress test.
 * 3. Verify PII scrubbing and Concept Grounding on Indonesian narratives (Names, MRNs, Phones, Dates).
 * 4. Adversarial Edge Cases (Name collision with eponyms, offset shifts, zero leakage).
 */

import { CrogeEngine } from '../src/services/clinical/croge';
import { ClinicalEngineCoordinator } from '../src/services/clinical/engine';
import { lookupRxNormConcepts } from '../src/services/clinical/rxnormDictionary';
import { deidentifyText } from '../src/services/deid/deidentifier';

interface BenchmarkStat {
  narrativeName: string;
  charCount: number;
  runs: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  passed: boolean;
}

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  details?: string;
}

const allResults: TestResult[] = [];

function recordTest(suite: string, name: string, condition: boolean, details?: string, expected?: any, actual?: any) {
  allResults.push({ suite, name, passed: condition, details, expected, actual });
  const statusTag = condition ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`  ${statusTag} ${name}${details ? ` (${details})` : ''}`);
  if (!condition && expected !== undefined) {
    console.error(`      Expected: ${JSON.stringify(expected)}`);
    console.error(`      Actual:   ${JSON.stringify(actual)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 1: Diverse Clinical Narratives & CROGE Latency Benchmarks
// ─────────────────────────────────────────────────────────────────────────────

const DIVERSE_NARRATIVES: { id: string; name: string; text: string }[] = [
  {
    id: 'n1_minimal',
    name: 'Narrative 1: Minimal Single-Sentence Note',
    text: 'Patient diagnosed with essential hypertension, prescribed lisinopril 10mg daily.',
  },
  {
    id: 'n2_outpatient',
    name: 'Narrative 2: Standard Outpatient Encounter',
    text: `Anamnesis: Pasien datang untuk kontrol rutin penyakit kronis. Mengeluh pusing ringan.
Pemeriksaan Fisik: TD 145/90 mmHg, Nadi 78 x/menit, Suhu 36.8 C, RR 18 x/menit.
Diagnosis: Essential hypertension and type 2 diabetes mellitus.
Terapi saat ini: Lisinopril 10mg daily oral dan Metformin 500mg BID PO setelah makan.
Edukasi diet rendah garam dan olahraga teratur.`,
  },
  {
    id: 'n3_polypharmacy',
    name: 'Narrative 3: Multimorbid Geriatric Polypharmacy Case',
    text: `Pasien geriatri 74 tahun dengan riwayat coronary artery disease, chronic kidney disease stage 3,
essential hypertension, heart failure dengan preserved ejection fraction, dan osteoarthritis genu bilateral.
Mengeluh sesak nafas saat aktivitas berat dan nyeri kedua lutut saat berjalan.
Obat rutin:
1. Lisinopril 20mg once daily oral
2. Bisoprolol 5mg once daily oral
3. Atorvastatin 40mg at bedtime oral
4. Furosemide 40mg daily oral pagi
5. Paracetamol 500mg three times daily oral as needed
Pemeriksaan lab menunjukkan Kreatinin 1.8 mg/dL, eGFR 38 mL/min, Kalium 4.4 mEq/L, Natrium 138 mEq/L.`,
  },
  {
    id: 'n4_shorthand_indonesian',
    name: 'Narrative 4: Indonesian Ward Admission Clinical Shorthand',
    text: `os datang ke IGD dengan keluhan lemas sejak 3 hari SMRS.
T: 150/90 mmHg, N: 92 x/m, R: 20 x/m, S: 37.2 C.
RPD: DM tipe 2 sejak 8 tahun, Hipertensi grade 2, riwayat stroke infark 2 tahun lalu.
RPO: Metformin 500mg 2x1, Amlodipine 10mg 1x1, Asam Asetilsalisilat 80mg 1x1.
Hasil Lab CITO: GDS 248 mg/dL, HbA1c 8.2%, Kalium 3.4 mEq/L, Natrium 136 mEq/L, Ureum 48 mg/dL, Kreatinin 1.4 mg/dL.
Th/ infus NaCl 0.9% 1500 cc/24 jam, lanjutkan amlodipine dan metformin. Konsul TS Sp.PD pro evaluasi gula darah.`,
  },
  {
    id: 'n5_negex_clauses',
    name: 'Narrative 5: Heavy NegEx Negation Scope & Clause Boundaries',
    text: `Emergency Department Evaluation:
Patient denies chest pain, denies shortness of breath, and no history of asthma.
Examination reveals no signs of heart failure and patient has never had myocardial infarction.
Abdomen is soft, no tenderness, and ruled out acute appendicitis.
However, patient reports essential hypertension and chronic type 2 diabetes mellitus.
Family history of stroke was ruled out. Current medications: prescribed lisinopril 10mg daily oral.`,
  },
  {
    id: 'n6_extreme_long',
    name: 'Narrative 6: Extreme Stress Long Clinical Summary (2500+ chars)',
    text: `RINGKASAN MEDIS RESUME RAWAT INAP LENGKAP RUANG INTENSIF / BANGSAL PENYAKIT DALAM
Nama Pasien: Ny. Siti Rahmawati | No. Rekam Medis: MRN: 48-29-10 | Tgl Lahir: 14/07/1962 | Tgl Masuk: 10/09/2026

1. ANAMNESIS & KELUHAN UTAMA:
Pasien wanita 64 tahun dirawat dengan penurunan kesadaran ec sepsis dengan fokus infeksi pneumonia aspirasi dan ulkus diabetikum pedis dekstra Wagner 3. Pasien memiliki riwayat diabetes mellitus tipe 2 tidak terkontrol selama 12 tahun, hipertensi derajat II selama 15 tahun, dan gagal jantung kongestif NYHA II-III. Tidak ada riwayat asma, riwayat alergi obat disangkal. Pasien menyangkal nyeri dada tipikal angina, namun keluarga menyatakan pasien cepat lelah dan sesak bila berbaring terlentang.

2. PEMERIKSAAN FISIK:
- Keadaan Umum: Tampak sakit berat, Somnolen, GCS E3M5V4 (12).
- Tanda Vital: Tensi: 165/95 mmHg, Nadi: 108 x/menit regular isi cukup, Respirasi: 26 x/menit kussmaul minimal, Suhu: 38.6 C aksiler, SpO2: 93% on room air naik ke 98% dengan O2 nasal kanul 3 lpm.
- Kepala/Leher: Konjungtiva anemis (+/+), Sklera ikterik (-/-), JVP 5+2 cmH2O.
- Thorax: Cor S1-S2 reguler, murmur sistolik grade II/VI di apeks, gallop S3 (-). Pulmo vesikuler melemah di basal paru kanan, ronki basah kasar di basal paru kanan, wheezing (-).
- Abdomen: Supel, bising usus 8x/menit, hepar dan lien tidak teraba membesar, nyeri tekan (-).
- Ekstremitas: Akral hangat, CRT < 2 detik, edema pitting kedua tungkai (+/+). Pedis dekstra: ulkus ukuran 4x3 cm di plantar pedis, dasar slough dan pus, bau khas, pulsasi dorsalis pedis teraba melemah.

3. DATA LABORATORIUM SERIAL & PENUNJANG:
- Darah Rutin: Hb 8.1 g/dL, Leukosit 18.400 /uL, Hematokrit 26%, Trombosit 340.000 /uL.
- Elektrolit & Fungsi Ginjal: Kalium: 3.1 mEq/L (hipokalemia ringan), Natrium: 132 mEq/L, Klorida: 98 mEq/L. Ureum: 78 mg/dL, Kreatinin: 2.3 mg/dL (eGFR 24 mL/min/1.73m2).
- Profil Glukosa: GDS Masuk: 385 mg/dL, Keton darah: 0.4 mmol/L (tidak DKA), HbA1c: 10.4%.
- Penanda Inflamasi & Kardiak: CRP kuantitatif 68 mg/L, Prokalsitonin 2.4 ng/mL, Troponin I kualitatif negatif.
- Analisis Gas Darah (AGD): pH 7.36, pCO2 34, pO2 88, HCO3 19, BE -4.2, SaO2 96%.
- Rontgen Thorax AP: Kardiomegali dengan CTR 58%, infiltrat di lapang tengah dan bawah paru dekstra kesan pneumonia bronkopneumonia.

4. MASALAH MEDIS AKTIF & DAFTAR DIAGNOSIS (SNOMED CT):
1. Sepsis berat ec pneumonia aspirasi (SCTID: 233604007)
2. Ulkus diabetikum pedis dekstra Wagner III terinfeksi
3. Diabetes mellitus type 2 dengan komplikasi mikrovaskuler & hiperglikemia reaktif (SCTID: 44054006)
4. Essential hypertension grade II (SCTID: 38341003)
5. Chronic kidney disease stage 4 ec nefropati diabetik (SCTID: 433144002)
6. Anemia normositik normokromik ec ACD dd perdarahan kronis (Hb 8.1 g/dL)
7. Gagal jantung kongestif (SCTID: 84114007)

5. REKONSILIASI OBAT & RENCANA TERAPI MEDIKAMENTOSA (RxNorm):
1. Ceftriaxone 2g IV once daily
2. Metronidazole 500mg IV three times daily
3. Lisinopril 10mg daily oral ditunda sementara karena AKI on CKD
4. Amlodipine 10mg once daily oral tablet
5. Furosemide 40mg IV twice daily
6. Paracetamol 1000mg IV three times daily drip
7. Atorvastatin 20mg once daily oral at bedtime
8. Omeprazole 40mg IV once daily
9. Koreksi drip KCl 25 mEq dalam 500 mL NaCl 0.9% per 6 jam target K >= 3.5 mEq/L`,
  },
];

async function runBenchmarkSuite(): Promise<BenchmarkStat[]> {
  console.log('\n======================================================================');
  console.log(' TASK 1: CROGE Execution Latency Microbenchmarks (250+ Runs/Narrative)');
  console.log('======================================================================\n');

  const stats: BenchmarkStat[] = [];
  const RUNS_PER_NARRATIVE = 250;

  for (const n of DIVERSE_NARRATIVES) {
    // Warm-up 10 runs
    for (let w = 0; w < 10; w++) {
      await CrogeEngine.analyze(n.text);
    }

    const latencies: number[] = [];
    for (let i = 0; i < RUNS_PER_NARRATIVE; i++) {
      const t0 = performance.now();
      await CrogeEngine.analyze(n.text);
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
    }

    latencies.sort((a, b) => a - b);
    const minMs = latencies[0];
    const maxMs = latencies[latencies.length - 1];
    const meanMs = latencies.reduce((s, v) => s + v, 0) / latencies.length;
    const medianMs = latencies[Math.floor(latencies.length * 0.5)];
    const p95Ms = latencies[Math.floor(latencies.length * 0.95)];
    const p99Ms = latencies[Math.floor(latencies.length * 0.99)];

    const passed = meanMs < 15.0 && p95Ms < 15.0;

    stats.push({
      narrativeName: n.name,
      charCount: n.text.length,
      runs: RUNS_PER_NARRATIVE,
      minMs,
      maxMs,
      meanMs,
      medianMs,
      p95Ms,
      p99Ms,
      passed,
    });

    console.log(`[BENCHMARK] ${n.name} (${n.text.length} chars, ${RUNS_PER_NARRATIVE} runs):`);
    console.log(
      `   Mean: ${meanMs.toFixed(3)} ms | Median (p50): ${medianMs.toFixed(3)} ms | p95: ${p95Ms.toFixed(3)} ms | p99: ${p99Ms.toFixed(3)} ms | Min: ${minMs.toFixed(3)} ms | Max: ${maxMs.toFixed(3)} ms`,
    );

    recordTest(
      'Task 1 (Latency)',
      `${n.id} Mean latency < 15ms`,
      meanMs < 15.0,
      `Mean: ${meanMs.toFixed(2)}ms`,
      '<15ms',
      `${meanMs.toFixed(2)}ms`,
    );

    recordTest(
      'Task 1 (Latency)',
      `${n.id} p95 latency < 15ms`,
      p95Ms < 15.0,
      `p95: ${p95Ms.toFixed(2)}ms`,
      '<15ms',
      `${p95Ms.toFixed(2)}ms`,
    );
  }

  // Combined stats
  const allMean = stats.reduce((s, st) => s + st.meanMs, 0) / stats.length;
  const maxP95 = Math.max(...stats.map((st) => st.p95Ms));
  console.log(`\n--> Aggregate Across All 6 Narratives (${stats.length * RUNS_PER_NARRATIVE} total runs):`);
  console.log(`    Overall Mean: ${allMean.toFixed(3)} ms | Highest p95: ${maxP95.toFixed(3)} ms`);

  recordTest(
    'Task 1 (Latency)',
    'Global average latency strictly < 15ms across all narratives',
    allMean < 15.0,
    `Overall Mean: ${allMean.toFixed(2)}ms`,
  );
  recordTest(
    'Task 1 (Latency)',
    'Global highest p95 strictly < 15ms across all narratives',
    maxP95 < 15.0,
    `Highest p95: ${maxP95.toFixed(2)}ms`,
  );

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2: RxNorm Regex Determinism Stress Testing (50+ runs + Interleaved)
// ─────────────────────────────────────────────────────────────────────────────

const COMPLEX_PRESCRIPTIONS = [
  {
    name: 'Prescription 1 (Standard ACEi tablet)',
    text: 'Prescribed lisinopril 10mg daily oral tablet for blood pressure control.',
    expectedDrug: 'lisinopril',
    expectedDosage: '10mg',
    expectedRoute: 'Oral',
    expectedFreq: 'daily',
    expectedScdRxcui: '314076',
  },
  {
    name: 'Prescription 2 (Biguanide with meals BID)',
    text: 'Initiated metformin 500mg bid po with meals for glycemic regulation.',
    expectedDrug: 'metformin',
    expectedDosage: '500mg',
    expectedRoute: 'PO',
    expectedFreq: 'bid',
    expectedScdRxcui: '860975',
  },
  {
    name: 'Prescription 3 (Multi-drug cardiology combination)',
    text: 'Discharge regimen: amlodipine 5mg once daily oral, atorvastatin 20mg at bedtime, furosemide 40mg daily iv.',
    expectedDrugCount: 3,
  },
  {
    name: 'Prescription 4 (Indonesian clinical shorthand prescription)',
    text: 'R/ Paracetamol 500mg tab No. XV S. 3x1 tab prn oral diminum; R/ Omeprazole 20mg caps No. VII S. 2x1 ac oral; R/ Bisoprolol 2.5mg tab S. 1x1 pagi oral.',
    expectedDrugCount: 3,
  },
  {
    name: 'Prescription 5 (Insulin + Antiplatelet with decimal & unit dosages)',
    text: 'Therapy: insulin glargine 10 units subcutaneous at bedtime, aspirin 81mg once daily oral.',
    expectedDrugCount: 2,
  },
];

function runRxNormDeterminismSuite() {
  console.log('\n======================================================================');
  console.log(' TASK 2: RxNorm Regex Determinism Stress Test (50+ Consecutive Runs)');
  console.log('======================================================================\n');

  // Test 2.1: 50 Consecutive runs on each prescription individually
  for (const p of COMPLEX_PRESCRIPTIONS) {
    const runsCount = 50;
    const initialMatch = lookupRxNormConcepts(p.text);
    const initialJson = JSON.stringify(initialMatch);

    let identicalCount = 0;
    let anyDrift = false;
    let driftDetails = '';

    for (let r = 1; r <= runsCount; r++) {
      const currentMatch = lookupRxNormConcepts(p.text);
      const currentJson = JSON.stringify(currentMatch);

      if (currentJson === initialJson) {
        identicalCount++;
      } else {
        anyDrift = true;
        driftDetails = `Run #${r} drifted from baseline! Initial: ${initialJson}, Current: ${currentJson}`;
        break;
      }
    }

    recordTest(
      'Task 2 (RxNorm Determinism)',
      `${p.name}: 50 consecutive runs produce 100% identical outputs`,
      !anyDrift && identicalCount === runsCount,
      driftDetails || `50/50 runs identical (matches: ${initialMatch.length} drugs)`,
      true,
      !anyDrift,
    );

    // Verify properties if specified
    if (p.expectedDrug) {
      const match = initialMatch.find((m) => m.name.toLowerCase() === p.expectedDrug);
      recordTest(
        'Task 2 (RxNorm Extraction)',
        `${p.name}: Drug ${p.expectedDrug} extracted correctly`,
        Boolean(match),
      );
      if (match && p.expectedDosage) {
        recordTest(
          'Task 2 (RxNorm Extraction)',
          `${p.name}: Dosage extracted as ${p.expectedDosage}`,
          match.dosage === p.expectedDosage,
          match.dosage,
        );
      }
      if (match && p.expectedFreq) {
        recordTest(
          'Task 2 (RxNorm Extraction)',
          `${p.name}: Frequency extracted as ${p.expectedFreq}`,
          match.frequency?.toLowerCase() === p.expectedFreq.toLowerCase(),
          match.frequency,
        );
      }
      if (match && p.expectedRoute) {
        recordTest(
          'Task 2 (RxNorm Extraction)',
          `${p.name}: Route extracted as ${p.expectedRoute}`,
          match.route?.toLowerCase() === p.expectedRoute.toLowerCase(),
          match.route,
        );
      }
      if (match && p.expectedScdRxcui) {
        recordTest(
          'Task 2 (RxNorm Extraction)',
          `${p.name}: SCD RxCUI mapped to ${p.expectedScdRxcui}`,
          match.scdRxcui === p.expectedScdRxcui,
          match.scdRxcui,
        );
      }
    }
  }

  // Test 2.2: Interleaved Round-Robin Stress Test (100 rounds across 5 prescriptions)
  console.log('\n--- Test 2.2: Interleaved Cross-Call Pollution Stress Test (100 cycles) ---');
  const baselines = COMPLEX_PRESCRIPTIONS.map((p) => ({
    name: p.name,
    text: p.text,
    baselineJson: JSON.stringify(lookupRxNormConcepts(p.text)),
  }));

  let interleavedDrift = false;
  let interleavedDriftMsg = '';
  const CYCLES = 100;

  for (let c = 0; c < CYCLES; c++) {
    for (const b of baselines) {
      const res = lookupRxNormConcepts(b.text);
      const json = JSON.stringify(res);
      if (json !== b.baselineJson) {
        interleavedDrift = true;
        interleavedDriftMsg = `Cycle ${c} on [${b.name}] drifted! Baseline: ${b.baselineJson}, Current: ${json}`;
        break;
      }
    }
    if (interleavedDrift) break;
  }

  recordTest(
    'Task 2 (RxNorm Determinism)',
    '100 interleaved cycles across diverse prescriptions show zero cross-call regex state leakage',
    !interleavedDrift,
    interleavedDriftMsg || '500 interleaved executions verified 100% deterministic',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 3: PII Scrubbing and Concept Grounding Verification
// ─────────────────────────────────────────────────────────────────────────────

interface PiiTestCase {
  name: string;
  narrative: string;
  expectedRedactions: { category: string; rawSnippet: string }[];
  expectedSnomedCodes: string[];
  expectedRxNormNames: string[];
}

const PII_TEST_CASES: PiiTestCase[] = [
  {
    name: 'Case 1: Standard Indonesian Patient Record (Budi Santoso)',
    narrative:
      'Pasien Budi Santoso, MRN: AB-1234, tgl 12/05/2023, Telp: 555-123-4567, didiagnosis essential hypertension dan type 2 diabetes mellitus, terapi lisinopril 10mg daily oral.',
    expectedRedactions: [
      { category: 'NAME', rawSnippet: 'Budi Santoso' },
      { category: 'MRN', rawSnippet: 'AB-1234' },
      { category: 'DATE', rawSnippet: '12/05/2023' },
      { category: 'PHONE', rawSnippet: '555-123-4567' },
    ],
    expectedSnomedCodes: ['38341003', '44054006'],
    expectedRxNormNames: ['lisinopril'],
  },
  {
    name: 'Case 2: Indonesian Name with Title & 3 Words (Ny. Siti Rahmawati)',
    narrative:
      'Ny. Siti Rahmawati, Medical Record: MR-987654, tgl lahir 15-08-1980, no telp (021) 555-4321, riwayat acute myocardial infarction dan chest pain, konsumsi aspirin 80mg daily oral dan atorvastatin 20mg at bedtime.',
    expectedRedactions: [
      { category: 'NAME', rawSnippet: 'Siti Rahmawati' },
      { category: 'MRN', rawSnippet: 'MR-987654' },
      { category: 'DATE', rawSnippet: '15-08-1980' },
      { category: 'PHONE', rawSnippet: '555-4321' },
    ],
    expectedSnomedCodes: ['22298006', '29857009'],
    expectedRxNormNames: ['aspirin', 'atorvastatin'],
  },
  {
    name: 'Case 3: Indonesian Javanese Name (Ahmad Dahlan) with DOB & Phone',
    narrative:
      'Tn. Ahmad Dahlan, MRN: 554433, DOB: 01/20/1975, HP: 555-987-6543, menderita heart failure dan pneumonia, pengobatan furosemide 40mg daily.',
    expectedRedactions: [
      { category: 'NAME', rawSnippet: 'Ahmad Dahlan' },
      { category: 'MRN', rawSnippet: '554433' },
      { category: 'DATE', rawSnippet: '01/20/1975' },
      { category: 'PHONE', rawSnippet: '555-987-6543' },
    ],
    expectedSnomedCodes: ['84114007', '233604007'],
    expectedRxNormNames: ['furosemide'],
  },
  {
    name: 'Case 4: Full Clinical Consult with Indonesian Identifiers',
    narrative:
      'Pasien Dewi Lestari, MR# 887766, tanggal periksa October 14, 2023, telp 555-321-7654. Keluhan sesak nafas, diagnosis bronchial asthma dan essential hypertension, terapi amlodipine 5mg once daily.',
    expectedRedactions: [
      { category: 'NAME', rawSnippet: 'Dewi Lestari' },
      { category: 'MRN', rawSnippet: '887766' },
      { category: 'DATE', rawSnippet: 'October 14, 2023' },
      { category: 'PHONE', rawSnippet: '555-321-7654' },
    ],
    expectedSnomedCodes: ['195967001', '38341003'],
    expectedRxNormNames: ['amlodipine'],
  },
];

async function runPiiAndGroundingSuite() {
  console.log('\n======================================================================');
  console.log(' TASK 3: PII Scrubbing & Ontological Concept Grounding Verification');
  console.log('======================================================================\n');

  for (const tc of PII_TEST_CASES) {
    console.log(`\n--- Evaluating ${tc.name} ---`);

    // 1. Direct deidentification test
    const deid = deidentifyText(tc.narrative);
    const redacted = deid.redactedText;

    // Check each expected redaction
    for (const exp of tc.expectedRedactions) {
      const isRedacted = !redacted.includes(exp.rawSnippet);
      recordTest(
        'Task 3 (PII Redaction)',
        `${tc.name}: Identifier '${exp.rawSnippet}' (${exp.category}) is redacted`,
        isRedacted,
        isRedacted ? 'Redacted successfully' : `LEAK DETECTED: '${exp.rawSnippet}' still present in redacted text!`,
      );
    }

    // Verify replacement tokens exist in redacted text
    const hasTokens =
      redacted.includes('[NAME]') ||
      redacted.includes('[MRN]') ||
      redacted.includes('[DATE]') ||
      redacted.includes('[PHONE]');
    recordTest(
      'Task 3 (PII Redaction)',
      `${tc.name}: Redacted text contains Safe Harbor placeholder tokens`,
      hasTokens,
      `Redacted sample: "${redacted.slice(0, 80)}..."`,
    );

    // 2. Ontology grounding from raw narrative (which calls deidentifyText under the hood)
    const snomedConcepts = CrogeEngine.extractSnomed(tc.narrative);
    const rxnormConcepts = CrogeEngine.extractRxNorm(tc.narrative);

    for (const expCode of tc.expectedSnomedCodes) {
      const found = snomedConcepts.some((s) => s.code === expCode);
      const matchingConcept = snomedConcepts.find((s) => s.code === expCode);
      recordTest(
        'Task 3 (SCTID Grounding)',
        `${tc.name}: SNOMED code ${expCode} correctly grounded from scrubbed text`,
        found,
        found ? `${matchingConcept?.preferredTerm} [${expCode}]` : `Missing SCTID ${expCode}`,
      );
    }

    for (const expDrug of tc.expectedRxNormNames) {
      const found = rxnormConcepts.some((r) => r.name.toLowerCase() === expDrug.toLowerCase());
      const matchingDrug = rxnormConcepts.find((r) => r.name.toLowerCase() === expDrug.toLowerCase());
      recordTest(
        'Task 3 (RxNorm Grounding)',
        `${tc.name}: RxNorm drug '${expDrug}' correctly grounded from scrubbed text`,
        found,
        found ? `${matchingDrug?.name} [RxCUI: ${matchingDrug?.rxcui}]` : `Missing drug ${expDrug}`,
      );
    }

    // 3. ClinicalEngineCoordinator End-to-End Analysis & Zero PHI Egress in SOAP
    const coordResult = await ClinicalEngineCoordinator.analyze(tc.narrative);
    const soap = coordResult.soapNote;
    const soapAllText = [
      soap.subjective.title,
      ...soap.subjective.content,
      soap.objective.title,
      ...soap.objective.content,
      soap.assessment.title,
      ...soap.assessment.content,
      soap.plan.title,
      ...soap.plan.content,
    ].join(' ');

    let anyLeakInSoap = false;
    let leakedSnippet = '';
    for (const exp of tc.expectedRedactions) {
      if (soapAllText.includes(exp.rawSnippet)) {
        anyLeakInSoap = true;
        leakedSnippet = exp.rawSnippet;
        break;
      }
    }

    recordTest(
      'Task 3 (SOAP Zero-Leakage)',
      `${tc.name}: Generated SOAP note has 0 PHI leakage of patient identifiers`,
      !anyLeakInSoap,
      anyLeakInSoap ? `LEAK DETECTED in SOAP: '${leakedSnippet}'` : 'Zero PHI detected in SOAP sections',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 4: Adversarial Stress & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

async function runAdversarialStressSuite() {
  console.log('\n======================================================================');
  console.log(' TASK 4: Adversarial Stress Tests & Potential Failure Modes');
  console.log('======================================================================\n');

  // Edge Case 4.1: Medical Eponyms vs Names (e.g. Parkinson Disease, Graves Disease, Crohn Disease)
  // Deidentifier should NOT redact condition eponyms if they are followed by 'Disease' or 'Syndrome'
  // Or if it DOES redact 'Parkinson', does SNOMED still recognize it or get corrupted?
  console.log('--- Test 4.1: Medical Eponyms and Entity Integrity ---');
  const eponymText = 'Patient John Smith presents with Parkinson disease and Hashimoto thyroiditis, takes levothyroxine 50mcg daily.';
  const eponymDeid = deidentifyText(eponymText);
  recordTest(
    'Task 4 (Adversarial)',
    'Eponym test: Patient name "John Smith" is redacted',
    !eponymDeid.redactedText.includes('John Smith'),
  );

  // Check if SNOMED or RxNorm still grounds
  const eponymRx = CrogeEngine.extractRxNorm(eponymText);
  recordTest(
    'Task 4 (Adversarial)',
    'Eponym test: Medication levothyroxine 50mcg is extracted',
    eponymRx.some((m) => m.name.toLowerCase() === 'levothyroxine'),
  );

  // Edge Case 4.2: Indonesian Phone Number Formats
  console.log('\n--- Test 4.2: Indonesian Local Phone Number Formats ---');
  const indoPhones = [
    '0812-345-6789',
    '555-123-4567',
    '+1 (555) 123-4567',
  ];

  for (const ph of indoPhones) {
    const phText = `Kontak keluarga: ${ph}, pasien stabil.`;
    const phDeid = deidentifyText(phText);
    const isRedacted = !phDeid.redactedText.includes(ph);
    recordTest(
      'Task 4 (Adversarial Phone)',
      `Phone format "${ph}" redaction behavior`,
      isRedacted,
      isRedacted ? 'Redacted' : `Not matched by HIPAA phone pattern: "${phDeid.redactedText}"`,
    );
  }

  // Edge Case 4.3: High Concurrency / Race Condition Simulation
  console.log('\n--- Test 4.3: Concurrency Stress Test (50 parallel CrogeEngine.analyze calls) ---');
  const parallelInput = 'Patient with essential hypertension on lisinopril 10mg daily and type 2 diabetes on metformin 500mg bid.';
  const tParallelStart = performance.now();
  const parallelPromises = Array.from({ length: 50 }, () => CrogeEngine.analyze(parallelInput));
  const parallelResults = await Promise.all(parallelPromises);
  const parallelTime = performance.now() - tParallelStart;

  const allParallelHaveDiag = parallelResults.every((r) => r.diagnoses.length >= 2);
  const allParallelHaveMeds = parallelResults.every((r) => r.medications.length >= 2);
  const avgParallelTime = parallelTime / 50;

  recordTest(
    'Task 4 (Concurrency)',
    '50 parallel CrogeEngine.analyze invocations complete without error or data race',
    allParallelHaveDiag && allParallelHaveMeds,
    `Total batch time: ${parallelTime.toFixed(2)}ms (avg per concurrent request: ${avgParallelTime.toFixed(2)}ms)`,
  );

  // Edge Case 4.4: Empty, whitespace, and malformed inputs
  console.log('\n--- Test 4.4: Robustness on Empty and Malformed Inputs ---');
  const emptyRes = await CrogeEngine.analyze('');
  recordTest('Task 4 (Robustness)', 'Empty input produces clean result object without throwing', emptyRes.diagnoses.length === 0 && emptyRes.medications.length === 0);

  const whitespaceRes = await CrogeEngine.analyze('   \n\t  \r\n   ');
  recordTest('Task 4 (Robustness)', 'Whitespace-only input handled gracefully', whitespaceRes.diagnoses.length === 0);

  const specialCharsRes = await CrogeEngine.analyze('!@#$%^&*()_+-=[]{}|;:",.<>?/~`');
  recordTest('Task 4 (Robustness)', 'Special-character gibberish handled gracefully without crashing', Array.isArray(specialCharsRes.diagnoses));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function runAllChallengerBenchmarks() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        internize.ai — CHALLENGER 1 INDEPENDENT EMPIRICAL HARNESS     ║');
  console.log('║          Milestone 1 Deliverables: CROGE, RxNorm & PII Scrubbing     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  await runBenchmarkSuite();
  runRxNormDeterminismSuite();
  await runPiiAndGroundingSuite();
  await runAdversarialStressSuite();

  console.log('\n======================================================================');
  console.log('                      OVERALL CHALLENGE SUMMARY                       ');
  console.log('======================================================================');

  const total = allResults.length;
  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;

  console.log(`TOTAL ASSERTIONS: ${total}`);
  console.log(`PASSED:           ${passed}`);
  console.log(`FAILED:           ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED ASSERTIONS:');
    for (const f of allResults.filter((r) => !r.passed)) {
      console.error(`- [${f.suite}] ${f.name}${f.details ? `: ${f.details}` : ''}`);
    }
  }

  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllChallengerBenchmarks().catch((err) => {
  console.error('Fatal benchmark runner error:', err);
  process.exit(1);
});
