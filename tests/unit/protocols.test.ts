import { describe, it } from 'vitest';
/**
 * internize.ai — Clinical Protocols & Scoring Calculators Unit Test Suite
 *
 * Verifies:
 * 1. Protocol Registry & Keyword Detection
 * 2. Scoring Calculators (Calculate when data present, leave blank/null when absent)
 * 3. Titration Tables & Formatting
 */

import {
  getAllProtocols,
  matchProtocols,
  getProtocolById,
  formatProtocolDraft,
  calculateARISCAT,
  calculateRCRI,
  calculateCaprini,
  calculateImprove,
  calculateMorse,
  calculateDeliriumPAPDI,
  calculateBurchWartofsky,
  calculateMexSledai,
  calculateACREularSLE,
} from '../../src/services/clinical/protocols';
import { extractVitals, extractAbnormalLabs } from '../../src/services/clinical/internalMedicineEngine';

describe('protocols', () => {
  it('runs the full legacy suite', () => {

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failed++;
  }
}

console.log('\n======================================================================');
console.log('   internize.ai — Clinical Protocols & Scoring Engine Test Suite');
console.log('======================================================================\n');

// ── Suite 1: Protocol Registry & Completeness ──
console.log('=== SUITE 1: Protocol Registry & Completeness ===');
const allProtocols = getAllProtocols();
assert(allProtocols.length >= 30, `Registry contains >= 30 protocols (found: ${allProtocols.length})`);

const preopBiasa = getProtocolById('preop-biasa');
assert(preopBiasa !== null, 'Protocol preop-biasa is registered');
assert(preopBiasa?.category === 'preop-clearance', 'preop-biasa has preop-clearance category');

const hyperkalemia = getProtocolById('triple-drug-hyperkalemia');
assert(hyperkalemia !== null, 'Protocol triple-drug-hyperkalemia is registered');
assert(hyperkalemia?.urgency === 'cito', 'triple-drug-hyperkalemia has urgency cito');

const ntg1 = getProtocolById('drip-ntg-v1');
assert(ntg1 !== null && (ntg1.titrationTables?.length ?? 0) > 0, 'drip-ntg-v1 has titration table');

const nabic = getProtocolById('koreksi-nabic');
assert(nabic !== null && (nabic.calculations?.length ?? 0) > 0, 'koreksi-nabic has calculations');

// ── Suite 2: Keyword Matching & Relevance ──
console.log('\n=== SUITE 2: Keyword Matching & Relevance ===');
const matchHyperK = matchProtocols('Pasien di IGD dengan hiperkalemia berat kalium 6.8 mEq/L');
assert(matchHyperK.some((p) => p.id === 'triple-drug-hyperkalemia'), 'Matches triple-drug-hyperkalemia on "hiperkalemia"');

const matchPreop = matchProtocols('Konsul toleransi operasi laparotomi elektif pro pre-op clearance');
assert(matchPreop.some((p) => p.id === 'preop-biasa'), 'Matches preop-biasa on "pre-op clearance"');

const matchGeriatri = matchProtocols('Pasien geriatri usia 76 th pro operasi fraktur femur');
assert(matchGeriatri.some((p) => p.id === 'preop-geriatri'), 'Matches preop-geriatri on "geriatri usia 76 th"');

const matchHIV = matchProtocols('Pasien baru HIV stadium 3 pro evaluasi inisiasi ARV');
assert(matchHIV.some((p) => p.id === 'hiv-baru'), 'Matches hiv-baru on "pasien baru hiv"');

const matchSLE = matchProtocols('Evaluasi flare lupus SLE dengan kecurigaan nefritis dan vaskulitis');
assert(matchSLE.some((p) => p.id === 'acr-eular-sle-2019' || p.id === 'mex-sledai'), 'Matches SLE protocols on lupus/SLE');

const matchEmpty = matchProtocols('');
assert(matchEmpty.length === 0, 'Empty input returns empty protocol list');

// ── Suite 3: Scoring Calculators — Missing Data Philosophy (Blank / ___) ──
console.log('\n=== SUITE 3: Scoring Calculators — Null on Missing Data ===');
const emptyVitals = extractVitals('');
const emptyLabs = extractAbnormalLabs('');

// 3.1 ARISCAT with no data should have null score or ___
const ariscatEmpty = calculateARISCAT('', emptyVitals, emptyLabs);
assert(ariscatEmpty.score === null || ariscatEmpty.totalScore === null, 'ARISCAT score is null when data is missing');
assert(ariscatEmpty.displayText.includes('___'), 'ARISCAT displayText contains placeholder ___ when data is missing');

// 3.2 ARISCAT with data should calculate
const ariscatText = 'Pasien 65 tahun pro operasi intratoraks cito durasi > 2 jam, SpO2 92%';
const ariscatVitals = extractVitals(ariscatText);
const ariscatLabs = extractAbnormalLabs(ariscatText);
const ariscatFull = calculateARISCAT(ariscatText, ariscatVitals, ariscatLabs);
assert(ariscatFull.score !== null || ariscatFull.totalScore !== null, 'ARISCAT calculates numerical score when data present');

// 3.3 RCRI calculation
const rcriText = 'Pasien riwayat CAD, stroke, gagal jantung CHF, DM insulin pro laparotomi';
const rcriResult = calculateRCRI(rcriText, emptyVitals, emptyLabs);
assert((rcriResult.score ?? rcriResult.totalScore ?? 0) >= 4, 'RCRI identifies multiple cardiac risk factors (>= 4 points)');

// 3.4 Caprini calculation
const capriniText = 'Pasien usia 72 th dengan kanker kolon pro major surgery tirah baring > 72 jam';
const capriniResult = calculateCaprini(capriniText, emptyVitals, emptyLabs);
assert((capriniResult.score ?? capriniResult.totalScore ?? 0) > 0, 'Caprini identifies VTE risk factors');

// 3.5 Delirium PAPDI Geriatric
const deliriumText = 'Pasien usia 75 th dengan alkohol dan kognitif demensia pro operasi ortopedi';
const deliriumResult = calculateDeliriumPAPDI(deliriumText, emptyVitals, emptyLabs);
assert((deliriumResult.score ?? deliriumResult.totalScore ?? 0) >= 3, 'Delirium PAPDI detects geriatric risk factors');

// 3.6 Burch-Wartofsky Score
const bwText = 'Krisis tiroid febris Suhu 39.5 C, HR 135 bpm, diare mual muntah, ikterus parah, infeksi pencetus';
const bwVitals = extractVitals(bwText);
const bwLabs = extractAbnormalLabs(bwText);
const bwResult = calculateBurchWartofsky(bwText, bwVitals, bwLabs);
assert((bwResult.score ?? bwResult.totalScore ?? 0) >= 45, 'Burch-Wartofsky >= 45 highly suggestive of thyroid storm');

// ── Suite 4: Protocol Drafting & Plain Text Output ──
console.log('\n=== SUITE 4: Protocol Drafting & Plain Text Output ===');
if (hyperkalemia) {
  const draft = formatProtocolDraft(hyperkalemia);
  assert(draft.includes('TRIPLE DRUG HIPERKALEMIA'), 'Draft includes uppercase title');
  assert(draft.includes('Ca Gluconas'), 'Draft includes Ca Gluconas section');
  assert(draft.includes('D10%'), 'Draft includes D10% section');
}

console.log('\n======================================================================');
console.log(`TOTAL: ${passed} Passed, ${failed} Failed across ${passed + failed} tests`);
console.log('======================================================================\n');

if (failed > 0) {
  throw new Error('Legacy test failures: see output above');
}

  });
});
