/**
 * test_cloud_guardrail.test.ts
 * ============================
 * Unit tests for the three-layer client-side Cloud Synthesizer guardrail.
 * Runs with: tsx tests/unit/test_cloud_guardrail.test.ts
 *
 * Tests:
 *   Layer 1 — Schema validation (required fields, type checks)
 *   Layer 2 — Token invariant assertion (tokens from sanitized text survive)
 *   Layer 3 — Anti-leakage scan (NIK, phone, IP blocked)
 *   Integration — full happy-path pass
 *   Re-identification — token swap correctness
 */

import {
  runGuardrail,
  reidentifyOutput,
  extractTokens,
  runMarkdownGuardrail,
  reidentifyMarkdown,
} from '../../src/services/clinical/cloudGuardrail';

// ─── Test helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ─── Valid fixture ────────────────────────────────────────────────────────────

const VALID_SANITIZED_TEXT = `
Pasien [PATIENT_1], [AGE_1], [GENDER_1], No. RM [MRN_1] di [HOSPITAL_1].
DPJP: [DOCTOR_1]. Tgl Masuk: [DATE_1].
Keluhan: Sesak napas sejak 3 hari.
TD 160/100 mmHg, HR 92 x/m, SpO2 94%.
Diagnosis kerja: CHF NYHA III + HT Grade 2.
`.trim();

function buildValidOutput(overrides: Record<string, unknown> = {}): unknown {
  return {
    summary_one_liner: '[PATIENT_1], [AGE_1], [GENDER_1] (RM [MRN_1]), keluhan sesak napas 3 hari, CHF NYHA III + HT Grade 2 di [HOSPITAL_1]. DPJP [DOCTOR_1]. Tgl Masuk [DATE_1].',
    problem_list: [
      {
        priority: 1,
        division: 'Kardiologi',
        diagnosis: 'CHF NYHA III',
        evidence_rationale: 'Sesak napas, SpO2 94%, TD 160/100 pada [PATIENT_1] (RM [MRN_1]) di [HOSPITAL_1]',
        differential_diagnoses: ['PPOK eksaserbasi', 'Edema paru akut'],
        urgency: 'high',
      },
      {
        priority: 2,
        division: 'Ginjal-Hipertensi',
        diagnosis: 'Hipertensi Grade 2',
        evidence_rationale: 'TD 160/100 mmHg pada [PATIENT_1]',
        differential_diagnoses: ['Hipertensi sekunder'],
        urgency: 'moderate',
      },
    ],
    pertinent_negatives: ['Nyeri dada disangkal', 'Tanda meningeal negatif'],
    cross_specialty_safety_alerts: {
      renal_risk: 'Monitor eGFR jika inisiasi ACEi/ARB pada [PATIENT_1]. Data kreatinin belum tersedia.',
      hepatic_risk: 'Tidak ada tanda hepatotoksisitas aktif pada [PATIENT_1].',
      cardiac_qtc_risk: 'Hindari obat pemanjang QTc tanpa EKG baseline. Konsul [DOCTOR_1] jika diperlukan.',
      bleeding_hemostasis_risk: 'Tidak ada trombositopenia terdeteksi pada [PATIENT_1].',
    },
    soap_note: {
      subjective: 'Pasien [PATIENT_1], [AGE_1], [GENDER_1], No. RM [MRN_1] mengeluh sesak napas sejak 3 hari, dirawat di [HOSPITAL_1] sejak [DATE_1] di bawah DPJP [DOCTOR_1].',
      objective: 'TD 160/100 mmHg, HR 92 x/m, SpO2 94%. EKG dan foto toraks pending.',
      assessment: 'CHF NYHA III dengan HT Grade 2 pada [PATIENT_1]. Perlu optimalisasi terapi gagal jantung dan kontrol tekanan darah.',
      plan: {
        diagnostik: ['Foto toraks AP', 'EKG 12 lead', 'Echocardiografi', 'BNP/NT-proBNP — untuk [PATIENT_1] (RM [MRN_1])'],
        terapeutik: ['Furosemide 40mg IV bolus', 'Candesartan 8mg PO 1x1', 'O2 target SpO2 ≥ 95%'],
        monitoring: ['TTV tiap 4 jam', 'Balans cairan ketat', 'Target diuresis 0.5 mL/kgBB/jam'],
        edukasi: ['Jelaskan pentingnya pembatasan cairan kepada keluarga [PATIENT_1]', 'Diet rendah garam < 2g/hari. Kontrol ulang dengan [DOCTOR_1].'],
      },
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

section('Layer 1: Schema Validation');

// 1a. Valid output passes schema
{
  const result = runGuardrail(buildValidOutput(), VALID_SANITIZED_TEXT);
  expect('Valid complete output passes schema', result.status === 'pass', result.reason);
}

// 1b. Missing summary_one_liner
{
  const bad = buildValidOutput() as Record<string, unknown>;
  delete bad.summary_one_liner;
  const result = runGuardrail(bad, VALID_SANITIZED_TEXT);
  expect('Missing summary_one_liner → schema_error', result.status === 'schema_error');
}

// 1c. problem_list not an array
{
  const bad = buildValidOutput({ problem_list: 'not-an-array' });
  const result = runGuardrail(bad, VALID_SANITIZED_TEXT);
  expect('problem_list not array → schema_error', result.status === 'schema_error');
}

// 1d. Invalid urgency value
{
  const bad = buildValidOutput();
  (bad as Record<string, unknown[]>).problem_list = [
    {
      priority: 1,
      division: 'Kardiologi',
      diagnosis: 'CHF',
      evidence_rationale: 'sesak',
      differential_diagnoses: [],
      urgency: 'INVALID_VALUE', // bad
    },
  ];
  const result = runGuardrail(bad, VALID_SANITIZED_TEXT);
  expect('Invalid urgency → schema_error', result.status === 'schema_error');
}

// 1e. Missing soap_note.plan.diagnostik
{
  const bad = buildValidOutput();
  const soap = (bad as Record<string, unknown>).soap_note as Record<string, unknown>;
  const plan = soap.plan as Record<string, unknown>;
  delete plan.diagnostik;
  const result = runGuardrail(bad, VALID_SANITIZED_TEXT);
  expect('Missing soap_note.plan.diagnostik → schema_error', result.status === 'schema_error');
}

// 1f. Null root
{
  const result = runGuardrail(null, VALID_SANITIZED_TEXT);
  expect('Null root → schema_error', result.status === 'schema_error');
}

// 1g. Missing cross_specialty_safety_alerts.renal_risk
{
  const bad = buildValidOutput();
  const alerts = (bad as Record<string, Record<string, unknown>>).cross_specialty_safety_alerts;
  delete alerts.renal_risk;
  const result = runGuardrail(bad, VALID_SANITIZED_TEXT);
  expect('Missing renal_risk → schema_error', result.status === 'schema_error');
}

section('Layer 2: Token Invariant Assertion');

// 2a. extractTokens correctly extracts all tokens from text
{
  const tokens = extractTokens(VALID_SANITIZED_TEXT);
  const expected = ['[PATIENT_1]', '[AGE_1]', '[GENDER_1]', '[MRN_1]', '[HOSPITAL_1]', '[DOCTOR_1]', '[DATE_1]'];
  const allFound = expected.every(tok => tokens.includes(tok));
  expect(`extractTokens finds all ${expected.length} tokens`, allFound, `Found: ${tokens.join(', ')}`);
}

// 2b. Cloud output missing [MRN_1] → token_leak
{
  const output = buildValidOutput();
  // Remove [MRN_1] from output entirely (simulate token loss)
  const withoutMrn = JSON.parse(
    JSON.stringify(output).replace(/\[MRN_1\]/g, 'REDACTED')
  );
  const result = runGuardrail(withoutMrn, VALID_SANITIZED_TEXT);
  expect('Missing [MRN_1] in output → token_leak', result.status === 'token_leak', result.reason);
}

// 2c. Cloud output missing [HOSPITAL_1] → token_leak
{
  const output = buildValidOutput();
  const withoutHosp = JSON.parse(
    JSON.stringify(output).replace(/\[HOSPITAL_1\]/g, '')
  );
  const result = runGuardrail(withoutHosp, VALID_SANITIZED_TEXT);
  expect('Missing [HOSPITAL_1] in output → token_leak', result.status === 'token_leak');
}

// 2d. Sanitized text with no tokens → token check trivially passes
{
  const noTokenText = 'Pasien mengeluh sesak napas. TD 120/80 mmHg.';
  const result = runGuardrail(buildValidOutput(), noTokenText);
  // All tokens in output not in source → no invariant to enforce
  expect('No tokens in sanitized text → passes token check', result.status === 'pass');
}

section('Layer 3: Anti-Leakage Scan');

// 3a. NIK 16 digits blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'NIK pasien: 3578010203045678 masuk ke [HOSPITAL_1]',
  });
  const result = runGuardrail(bad, '');
  expect('16-digit NIK in output → phi_leak', result.status === 'phi_leak', result.reason);
}

// 3b. Indonesian +62 phone blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'Hubungi +62812345678 untuk konfirmasi.',
  });
  const result = runGuardrail(bad, '');
  expect('+62 phone number → phi_leak', result.status === 'phi_leak');
}

// 3c. Indonesian 08xx phone blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'Call 081234567890 jika ada perubahan.',
  });
  const result = runGuardrail(bad, '');
  expect('08xx phone number → phi_leak', result.status === 'phi_leak');
}

// 3d. IPv4 address blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'Data tersimpan di server 192.168.1.100.',
  });
  const result = runGuardrail(bad, '');
  expect('IPv4 address → phi_leak', result.status === 'phi_leak');
}

// 3e. Email address blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'Hasil dikirim ke pasien@gmail.com.',
  });
  const result = runGuardrail(bad, '');
  expect('Email address → phi_leak', result.status === 'phi_leak');
}

// 3f. SSN pattern blocked
{
  const bad = buildValidOutput({
    summary_one_liner: 'SSN: 123-45-6789',
  });
  const result = runGuardrail(bad, '');
  expect('SSN pattern → phi_leak', result.status === 'phi_leak');
}

section('Integration: Full Happy-Path');

// 4a. Complete pass → output typed correctly
{
  const result = runGuardrail(buildValidOutput(), VALID_SANITIZED_TEXT);
  expect('Full happy-path → status pass', result.status === 'pass');
  expect('Full happy-path → output defined', result.output !== undefined);
  expect('Full happy-path → no reason', result.reason === undefined);
  expect('Full happy-path → output has problem_list', Array.isArray(result.output?.problem_list));
  expect('Full happy-path → 2 problems', result.output?.problem_list.length === 2);
  expect('Full happy-path → soap_note subjective is string', typeof result.output?.soap_note.subjective === 'string');
}

section('Re-identification');

// 5a. reidentifyOutput swaps tokens correctly
{
  // Build fresh result — tokens are now all in the fixture so this should pass
  const freshResult = runGuardrail(buildValidOutput(), VALID_SANITIZED_TEXT);
  if (freshResult.status !== 'pass' || !freshResult.output) {
    console.error('  [SKIP] Re-id tests skipped because guardrail failed:', freshResult.reason);
    failed++;
  } else {
    const tokenMap = new Map<string, string>([
      ['[PATIENT_1]', 'Budi Santoso'],
      ['[AGE_1]', '58 tahun'],
      ['[GENDER_1]', 'Laki-laki'],
      ['[MRN_1]', '123456'],
      ['[HOSPITAL_1]', 'RSUD Moewardi'],
      ['[DOCTOR_1]', 'dr. Andi Sp.PD'],
      ['[DATE_1]', '29 Sep 2026'],
    ]);
    const reidentified = reidentifyOutput(freshResult.output, tokenMap);
    const jsonStr = JSON.stringify(reidentified);
    expect('Re-id: [PATIENT_1] → Budi Santoso', jsonStr.includes('Budi Santoso') && !jsonStr.includes('[PATIENT_1]'));
    expect('Re-id: [HOSPITAL_1] → RSUD Moewardi', jsonStr.includes('RSUD Moewardi'));
    expect('Re-id: no residual [PATIENT_1] token', !jsonStr.includes('[PATIENT_1]'));
    expect('Re-id: no residual [DOCTOR_1] token', !jsonStr.includes('[DOCTOR_1]'));
  }
}

// 5b. Empty token map → output unchanged
{
  const freshResult = runGuardrail(buildValidOutput(), VALID_SANITIZED_TEXT);
  if (freshResult.output) {
    const reidentified = reidentifyOutput(freshResult.output, new Map());
    const before = JSON.stringify(freshResult.output);
    const after = JSON.stringify(reidentified);
    expect('Empty token map → output unchanged', before === after);
  } else {
    expect('Empty token map → output unchanged', false, 'Guard skipped: output undefined');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. Markdown Guardrail Tests
// ══════════════════════════════════════════════════════════════════════════════
section('Layer 1, 2, 3: Markdown Guardrail Validation');

const VALID_MARKDOWN_KONSUL = `
**RINGKASAN KLINIS (ONE-LINER)**
[PATIENT_1], [AGE_1], [GENDER_1] No RM [MRN_1] di [HOSPITAL_1] DPJP [DOCTOR_1] Tgl [DATE_1] datang untuk evaluasi pre-op.

**JAWABAN KONSUL & PRE-OPERATIVE CLEARANCE**
*   **Status Toleransi:** LAIK OPERASI DENGAN CATATAN
*   **Stratifikasi Risiko Kardiovaskular (RCRI Revised Lee):** Skor 1 (Kelas II).
*   **Justifikasi Klinis:** Kondisi stabil terkontrol.

**DAFTAR MASALAH AKTIF (PROBLEM LIST) & PERENCANAAN 4P**
**1. Hipertensi Grade 2**
*   **Divisi PAPDI:** Ginjal-Hipertensi | **Urgensi:** Routine
*   **Ptx (Terapeutik):** Amlodipine 10mg 1x1

**CROSS-SPECIALTY SAFETY ALERTS (AUDIT KESELAMATAN LINTAS ORGAN)**
*   **Fungsi Ginjal & Penyesuaian Dosis:** eGFR stabil, hindari NSAID.
*   **Fungsi Hati & Hepatotoksisitas:** Enzim hepar normal.
*   **Kardiologi & Risiko Aritmia (QTc):** Risiko rendah.
*   **Hemostasis & Risiko Perdarahan:** Trombosit aman.
`.trim();

const VALID_MARKDOWN_POMR = `
**RINGKASAN KLINIS (ONE-LINER)**
[PATIENT_1], [AGE_1], [GENDER_1] No RM [MRN_1] di [HOSPITAL_1] DPJP [DOCTOR_1] Tgl [DATE_1] dengan sindroma sesak.

**DAFTAR MASALAH AKTIF (PROBLEM LIST) & PERENCANAAN 4P**
**1. CHF NYHA III**
*   **Divisi PAPDI:** Kardiologi | **Urgensi:** High

**CROSS-SPECIALTY SAFETY ALERTS (AUDIT KESELAMATAN LINTAS ORGAN)**
*   **Fungsi Ginjal & Penyesuaian Dosis:** Kreatinin 1.2 mg/dL.
*   **Fungsi Hati & Hepatotoksisitas:** Aman.
*   **Kardiologi & Risiko Aritmia (QTc):** Monitor kalium.
*   **Hemostasis & Risiko Perdarahan:** Aman.

**CATATAN SOAP (HANDOFF SBAR READY)**
*   **Subjective (S):** Sesak bertambah saat aktivitas.
*   **Objective (O):** TD 160/100, HR 92.
*   **Assessment (A):** CHF NYHA III.
*   **Plan (P):** Furosemide 1x40mg IV.
`.trim();

// 6a. Valid Markdown Konsul passes
{
  const res = runMarkdownGuardrail(VALID_MARKDOWN_KONSUL, VALID_SANITIZED_TEXT, 'konsul');
  expect('Markdown konsul passes guardrail', res.status === 'pass');
  expect('Markdown konsul output retained', typeof res.output === 'string');
}

// 6b. Valid Markdown POMR passes
{
  const res = runMarkdownGuardrail(VALID_MARKDOWN_POMR, VALID_SANITIZED_TEXT, 'pomr');
  expect('Markdown pomr passes guardrail', res.status === 'pass');
}

// 6c. Missing required section header in konsul -> schema_error
{
  const invalidKonsul = VALID_MARKDOWN_KONSUL.replace('**JAWABAN KONSUL & PRE-OPERATIVE CLEARANCE**', '');
  const res = runMarkdownGuardrail(invalidKonsul, VALID_SANITIZED_TEXT, 'konsul');
  expect('Missing required section header in konsul → schema_error', res.status === 'schema_error');
}

// 6d. Accidental raw JSON output -> schema_error
{
  const jsonStr = JSON.stringify({ summary_one_liner: 'test' });
  const res = runMarkdownGuardrail(jsonStr, VALID_SANITIZED_TEXT, 'pomr');
  expect('Raw JSON output instead of Markdown → schema_error', res.status === 'schema_error');
}

// 6e. Missing token in Markdown -> token_leak
{
  const missingTokenMd = VALID_MARKDOWN_KONSUL.replace('[MRN_1]', '123456');
  const res = runMarkdownGuardrail(missingTokenMd, VALID_SANITIZED_TEXT, 'konsul');
  expect('Missing token [MRN_1] in Markdown → token_leak', res.status === 'token_leak');
}

// 6f. 16-digit NIK in Markdown -> phi_leak
{
  const nikLeakedMd = `${VALID_MARKDOWN_KONSUL}\nNIK: 3374012345678901`;
  const res = runMarkdownGuardrail(nikLeakedMd, VALID_SANITIZED_TEXT, 'konsul');
  expect('16-digit NIK in Markdown → phi_leak', res.status === 'phi_leak');
}

// 6g. Raw phone number in Markdown -> phi_leak
{
  const phoneLeakedMd = `${VALID_MARKDOWN_KONSUL}\nHubungi: 081234567890`;
  const res = runMarkdownGuardrail(phoneLeakedMd, VALID_SANITIZED_TEXT, 'konsul');
  expect('Raw Indonesian phone in Markdown → phi_leak', res.status === 'phi_leak');
}

// 6h. Markdown re-identification
{
  const tokenMap = new Map<string, string>([
    ['[PATIENT_1]', 'Budi Santoso'],
    ['[MRN_1]', 'RM-998811'],
  ]);
  const reidentified = reidentifyMarkdown(VALID_MARKDOWN_KONSUL, tokenMap);
  expect('Markdown re-id: [PATIENT_1] → Budi Santoso', reidentified.includes('Budi Santoso'));
  expect('Markdown re-id: [MRN_1] → RM-998811', reidentified.includes('RM-998811'));
  expect('Markdown re-id: no residual [PATIENT_1]', !reidentified.includes('[PATIENT_1]'));
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  GUARDRAIL TEST SUMMARY: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log('\n✅ ALL GUARDRAIL TESTS PASSED');
  process.exit(0);
}
