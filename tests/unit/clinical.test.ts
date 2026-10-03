/**
 * Unit Test Suite for Clinical Service Engine & Rules
 * Verifies SNOMED CT Lexicon, RxNorm Dictionary, CROGE Engine, SOAP Synthesizer, and Local Coordinator.
 */

import {
  CrogeEngine,
  analyze,
  extractEntities,
  extractRxNorm,
  extractSnomed,
  generateSoap,
  isNegatedSpan,
} from '../../src/services/clinical/croge';
import {
  ClinicalEngineCoordinator,
  detectInferenceDevice,
} from '../../src/services/clinical/engine';
import {
  DOSAGE_REGEX,
  FREQUENCY_REGEX,
  ROUTE_REGEX,
  RXNORM_LEXICON,
  lookupRxNormConcepts,
} from '../../src/services/clinical/rxnormDictionary';
import { SlmEngine } from '../../src/services/clinical/slmEngine';
import { SNOMED_LEXICON, lookupSnomedConcepts } from '../../src/services/clinical/snomedDictionary';
import { synthesizeSoapNote } from '../../src/services/clinical/soapSynthesizer';
import { deidentifyText } from '../../src/services/deid/deidentifier';

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

async function runClinicalUnitTests() {
  console.log('\n======================================================================');
  console.log('   internize.ai — Clinical Service Tab Unit & Regression Test Suite   ');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // Suite 1: SNOMED CT Lexicon & Synonym Grounding
  // -------------------------------------------------------------------------
  console.log('=== SUITE 1: SNOMED CT Lexicon & Synonym Grounding ===');

  assert(
    SNOMED_LEXICON.length >= 200,
    'U1.1: SNOMED CT Clinical Core Lexicon contains >= 200 conditions',
    `Found ${SNOMED_LEXICON.length} concepts`,
  );

  const htnConcepts = lookupSnomedConcepts('Patient diagnosed with essential hypertension.');
  assert(
    htnConcepts.some((c) => c.code === '38341003' || c.code === '59621000'),
    'U1.2: Essential hypertension resolves to valid SCTID',
  );

  const htnSynonyms = ['hypertension', 'HTN', 'high blood pressure', 'essential hypertension'];
  let allHtnMatched = true;
  for (const syn of htnSynonyms) {
    const res = lookupSnomedConcepts(`Patient has ${syn}.`);
    if (!res.some((c) => c.code === '38341003' || c.code === '59621000')) {
      allHtnMatched = false;
      break;
    }
  }
  assert(allHtnMatched, 'U1.3: All standard hypertension synonyms resolve correctly');

  const miConcepts = lookupSnomedConcepts('Emergency evaluation for acute myocardial infarction.');
  assert(
    miConcepts.some((c) => c.code === '22298006'),
    'U1.4: Acute myocardial infarction maps to SCTID 22298006',
  );

  const chestPain = lookupSnomedConcepts('Substernal chest pain radiating to left arm.');
  assert(
    chestPain.some((c) => c.code === '29857009'),
    'U1.5: Chest pain maps to SCTID 29857009',
  );

  // -------------------------------------------------------------------------
  // Suite 2: RxNorm Clinical Drug Lexicon & Sig Parsing
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 2: RxNorm Clinical Drug Lexicon & Sig Parsing ===');

  assert(
    RXNORM_LEXICON.length >= 25,
    'U2.1: Curated RxNorm Drug Lexicon contains comprehensive primary care formulary',
    `Found ${RXNORM_LEXICON.length} drugs`,
  );

  const lisinoprilMatch = lookupRxNormConcepts('Prescribed lisinopril 10mg daily oral tablet.');
  assert(lisinoprilMatch.length === 1, 'U2.2: Lisinopril identified as single drug');
  assert(lisinoprilMatch[0]?.rxcui === '29046', 'U2.3: Lisinopril ingredient RxCUI is 29046');
  assert(lisinoprilMatch[0]?.dosage === '10mg', 'U2.4: Dosage 10mg extracted accurately');
  assert(lisinoprilMatch[0]?.scdRxcui === '314076', 'U2.5: Reconciled to SCD 314076');
  assert(lisinoprilMatch[0]?.route?.toLowerCase() === 'oral', 'U2.6: Route identified as Oral');
  assert(
    lisinoprilMatch[0]?.frequency?.toLowerCase() === 'daily',
    'U2.7: Frequency identified as daily',
  );

  const decimalDosage = lookupRxNormConcepts('Started on amlodipine 2.5mg once daily.');
  assert(decimalDosage[0]?.dosage === '2.5mg', 'U2.8: Decimal dosage 2.5mg captured');

  DOSAGE_REGEX.lastIndex = 0;
  assert(DOSAGE_REGEX.test('500mg'), 'U2.9: DOSAGE_REGEX matches 500mg');
  DOSAGE_REGEX.lastIndex = 0;
  assert(DOSAGE_REGEX.test('20 mg'), 'U2.10: DOSAGE_REGEX matches 20 mg');
  FREQUENCY_REGEX.lastIndex = 0;
  assert(FREQUENCY_REGEX.test('BID'), 'U2.11: FREQUENCY_REGEX matches BID');
  ROUTE_REGEX.lastIndex = 0;
  assert(ROUTE_REGEX.test('PO'), 'U2.12: ROUTE_REGEX matches PO');

  // -------------------------------------------------------------------------
  // Suite 3: CROGE Engine & NegEx Negation Logic
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 3: CROGE Engine & NegEx Negation Logic ===');

  const negText = 'Patient denies hypertension and no history of asthma.';
  assert(
    isNegatedSpan(negText, negText.indexOf('hypertension'), negText.indexOf('hypertension') + 12),
    'U3.1: NegEx detects denies hypertension',
  );
  assert(
    isNegatedSpan(negText, negText.indexOf('asthma'), negText.indexOf('asthma') + 6),
    'U3.2: NegEx detects no history of asthma',
  );

  const cancelledNegText = 'Patient has no fever, but reports hypertension.';
  assert(
    !isNegatedSpan(
      cancelledNegText,
      cancelledNegText.indexOf('hypertension'),
      cancelledNegText.indexOf('hypertension') + 12,
    ),
    'U3.3: Conjunction "but" cancels negation scope',
  );

  const crogeSnomed = extractSnomed('Patient presents with hypertension.');
  assert(
    crogeSnomed.length === 1 && crogeSnomed[0].code === '38341003',
    'U3.4: extractSnomed returns valid concept',
  );

  const crogeEntities = extractEntities('Patient with hypertension taking lisinopril 10mg daily.');
  assert(
    crogeEntities.some((e) => e.label === 'DISEASE'),
    'U3.5: extractEntities extracts DISEASE',
  );
  assert(
    crogeEntities.some((e) => e.label === 'DRUG'),
    'U3.6: extractEntities extracts DRUG',
  );
  assert(
    crogeEntities.some((e) => e.label === 'DOSAGE'),
    'U3.7: extractEntities extracts DOSAGE',
  );

  const t0 = performance.now();
  const analysisRes = await analyze(
    'Patient presents with hypertension and is on lisinopril 10mg daily.',
  );
  const execTime = performance.now() - t0;
  assert(
    execTime < 50,
    'U3.8: CROGE execution completes in <50ms (sub-second requirement)',
    `${execTime.toFixed(2)}ms`,
  );
  assert(analysisRes.diagnoses.length > 0, 'U3.9: Analysis result includes diagnoses');
  assert(analysisRes.medications.length > 0, 'U3.10: Analysis result includes medications');

  // -------------------------------------------------------------------------
  // Suite 4: SOAP Synthesizer & Anti-Hallucination Citations
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 4: SOAP Synthesizer & Anti-Hallucination Citations ===');

  const sampleDischarge = 'Patient presents with hypertension and is on lisinopril 10mg daily.';
  const soap = synthesizeSoapNote(sampleDischarge, analysisRes.diagnoses, analysisRes.medications);

  assert(soap.subjective.title === 'Subjective', 'U4.1: Subjective title is correct');
  assert(soap.subjective.content.length > 0, 'U4.2: Subjective has content');
  assert(
    soap.subjective.citations !== undefined && soap.subjective.citations.length > 0,
    'U4.3: Subjective has input span citation',
  );

  assert(soap.objective.title === 'Objective', 'U4.4: Objective title is correct');
  assert(soap.assessment.title === 'Assessment', 'U4.5: Assessment title is correct');
  assert(soap.assessment.content.length > 0, 'U4.6: Assessment has content');
  assert(soap.plan.title === 'Plan', 'U4.7: Plan title is correct');
  assert(soap.plan.content.length > 0, 'U4.8: Plan has content');

  // Verify citation spans point to exact substring in input
  const subCite = soap.subjective.citations?.[0];
  if (subCite) {
    const sliced = sampleDischarge.slice(subCite.start, subCite.end);
    assert(
      sliced === subCite.sourceText,
      'U4.9: Subjective citation matches exact character slice',
      `"${sliced}" === "${subCite.sourceText}"`,
    );
  }

  const emptySoap = synthesizeSoapNote('');
  assert(
    emptySoap.subjective.title === 'Subjective',
    'U4.10: Empty input returns valid Subjective section',
  );
  assert(
    emptySoap.assessment.title === 'Assessment',
    'U4.11: Empty input returns valid Assessment section',
  );

  // -------------------------------------------------------------------------
  // Suite 5: Clinical Coordinator & Hardware Detection
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 5: Clinical Coordinator & Hardware Detection ===');

  const dev = await detectInferenceDevice();
  assert(
    ['webgpu', 'wasm', 'cpu'].includes(dev),
    'U5.1: Inference device is valid runtime type',
    dev,
  );

  const coordResult = await ClinicalEngineCoordinator.analyze(sampleDischarge);
  assert(
    coordResult.soapNote.subjective.content.length > 0,
    'U5.2: Coordinator delivers valid SOAP Subjective',
  );
  assert(
    coordResult.diagnoses.some((d) => d.code === '38341003'),
    'U5.3: Coordinator delivers SNOMED 38341003',
  );
  // -------------------------------------------------------------------------
  // Suite 6: Multi-Source Clinical Feed Normalizer & Synthesis
  // -------------------------------------------------------------------------
  console.log('\n=== SUITE 6: Multi-Source Clinical Feed Normalizer & Synthesis ===');

  const {
    cleanClinicalText,
    normalizeClinicalAbbreviations,
    formatMultiSourceFeed,
    parseMultiSourceFeed,
    hasAnySourceContent,
    SAMPLE_MULTI_SOURCE_FEED,
    FEED_BLOCK_HEADERS,
  } = await import('../../src/services/clinical/feedFormatter');

  // Test cleanClinicalText
  const dirtyText = 'Sample\u200B text\u00A0with\u201Cquotes\u201D\r\nand\u2013dashes\x00\x08';
  const cleaned = cleanClinicalText(dirtyText);
  assert(
    !cleaned.includes('\u200B') && !cleaned.includes('\x00') && !cleaned.includes('\u00A0'),
    'U6.1: cleanClinicalText strips zero-width, non-breaking, and control chars',
  );
  assert(
    cleaned.includes('"quotes"') && cleaned.includes('-dashes'),
    'U6.2: cleanClinicalText normalizes quotes and dashes',
  );

  // Test normalizeClinicalAbbreviations
  const abbrevInput =
    'os datang dengan keluhan pusing, th/ amlodipine 10mg 1x1, acc rawat poli, konsul ts pro evaluasi.';
  const normOutput = normalizeClinicalAbbreviations(abbrevInput);
  assert(normOutput.includes('pasien datang'), 'U6.3: "os" normalizes to "pasien"');
  assert(normOutput.includes('terapi: amlodipine'), 'U6.4: "th/" normalizes to "terapi:"');
  assert(normOutput.includes('disetujui rawat'), 'U6.5: "acc" normalizes to "disetujui"');
  assert(
    normOutput.includes('konsultasi teman sejawat untuk evaluasi'),
    'U6.6: "konsul ts pro" normalizes to "konsultasi teman sejawat untuk"',
  );

  // Test formatMultiSourceFeed
  const multiSources = {
    externalReferral: 'Rujukan faskes asal: DM dan hipertensi. th/ metformin 500mg.',
    specialistConsultation: 'Konsul Sp.JP: acc titrasi terapi lisinopril.',
    labResults: 'GDS 210 mg/dL, HbA1c 8.5%.',
    currentEncounter: 'os mengeluh lemas sejak 3 hari.',
  };

  const formattedFeed = formatMultiSourceFeed(multiSources);
  assert(
    formattedFeed.includes(FEED_BLOCK_HEADERS.externalReferral),
    'U6.7: Formatted feed contains external referral header',
  );
  assert(
    formattedFeed.includes(FEED_BLOCK_HEADERS.specialistConsultation),
    'U6.8: Formatted feed contains consultation header',
  );
  assert(
    formattedFeed.includes(FEED_BLOCK_HEADERS.labResults),
    'U6.9: Formatted feed contains lab results header',
  );
  assert(
    formattedFeed.includes(FEED_BLOCK_HEADERS.currentEncounter),
    'U6.10: Formatted feed contains current encounter header',
  );
  assert(
    formattedFeed.includes('terapi: metformin'),
    'U6.11: Feed normalizes abbreviations inside referral block',
  );
  assert(
    formattedFeed.includes('pasien mengeluh'),
    'U6.12: Feed normalizes "os" inside current encounter block',
  );

  // Test parseMultiSourceFeed
  const parsedSources = parseMultiSourceFeed(formattedFeed);
  assert(
    Boolean(parsedSources.externalReferral?.includes('metformin')),
    'U6.13: parseMultiSourceFeed extracts externalReferral',
  );
  assert(
    Boolean(parsedSources.labResults?.includes('GDS 210')),
    'U6.14: parseMultiSourceFeed extracts labResults',
  );

  // Test hasAnySourceContent
  assert(
    hasAnySourceContent(multiSources) === true,
    'U6.15: hasAnySourceContent detects populated sources',
  );
  assert(
    hasAnySourceContent({ externalReferral: '', labResults: '  ' }) === false,
    'U6.16: hasAnySourceContent detects empty sources',
  );

  // Test End-to-End Analysis on Multi-Source Feed
  const sampleFormattedFeed = formatMultiSourceFeed(SAMPLE_MULTI_SOURCE_FEED);
  const multiSourceResult = await ClinicalEngineCoordinator.analyze(sampleFormattedFeed);

  assert(
    multiSourceResult.soapNote.subjective.content.length > 0,
    'U6.17: Multi-source feed produces valid Subjective section',
  );
  assert(
    multiSourceResult.soapNote.objective.content.length > 0,
    'U6.18: Multi-source feed produces valid Objective section',
  );
  assert(
    multiSourceResult.soapNote.assessment.content.length > 0,
    'U6.19: Multi-source feed produces valid Assessment section',
  );
  assert(
    multiSourceResult.soapNote.plan.content.length > 0,
    'U6.20: Multi-source feed produces valid Plan section',
  );
  assert(
    multiSourceResult.diagnoses.length > 0,
    'U6.21: Multi-source feed extracts SNOMED diagnoses',
  );
  assert(
    multiSourceResult.medications.length > 0,
    'U6.22: Multi-source feed extracts RxNorm medications',
  );

  // -------------------------------------------------------------------------
  // Suite 7: Milestone 1 Acceptance Suite (CROGE <15ms, De-ID, RxNorm Determinism, Neural Co-Pilot)
  // -------------------------------------------------------------------------
  console.log(
    '\n=== SUITE 7: Milestone 1 Acceptance Suite (CROGE <15ms, De-ID, RxNorm, Neural SLM) ===',
  );

  // M1.1: CROGE execution latency benchmark < 15ms
  const benchmarkDischarge =
    'Patient presents with essential hypertension and type 2 diabetes. Prescribed lisinopril 10mg daily and metformin 500mg BID.';
  const latencies: number[] = [];
  const BENCHMARK_RUNS = 100;
  for (let i = 0; i < BENCHMARK_RUNS; i++) {
    const tStart = performance.now();
    await CrogeEngine.analyze(benchmarkDischarge);
    latencies.push(performance.now() - tStart);
  }
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  assert(
    avgLatency < 15,
    'M1.1a: CROGE core analysis executes in < 15ms average latency benchmark',
    `avg: ${avgLatency.toFixed(2)}ms, p95: ${p95Latency.toFixed(2)}ms`,
  );
  assert(
    p95Latency < 15,
    'M1.1b: CROGE 95th percentile latency is strictly < 15ms',
    `p95: ${p95Latency.toFixed(2)}ms`,
  );

  // M1.2: Default state does not prewarm or download weights
  assert(
    SlmEngine.getStatus() === 'unloaded',
    'M1.2a: Default state of Neural SLM co-pilot is strictly "unloaded"',
    `Current status: ${SlmEngine.getStatus()}`,
  );
  const defaultCoordRes = await ClinicalEngineCoordinator.analyze(benchmarkDischarge);
  assert(
    defaultCoordRes.neuralMode === false,
    'M1.2b: Default coordinator execution uses pure deterministic CROGE (neuralMode: false)',
  );
  assert(
    SlmEngine.getStatus() === 'unloaded',
    'M1.2c: Executing default analyze() does not trigger model weight loading or prewarm',
    `Status after analyze: ${SlmEngine.getStatus()}`,
  );

  // M1.3: PII scrubbing executes prior to entity extraction and clinical categorization
  const patientRecordWithPhi =
    'Patient John Doe, MRN: AB-1234, diagnosed with essential hypertension, prescribed lisinopril 10mg daily.';
  const deidOutput = deidentifyText(patientRecordWithPhi);
  assert(
    deidOutput.redactedText.includes('[NAME]') && deidOutput.redactedText.includes('[MRN]'),
    'M1.3a: OpenMed-aligned deidentifyText redacts patient name and MRN',
    deidOutput.redactedText,
  );
  assert(
    !deidOutput.redactedText.includes('John Doe') && !deidOutput.redactedText.includes('AB-1234'),
    'M1.3b: Raw PHI strings (John Doe, AB-1234) are completely absent from scrubbed text',
  );

  const deidCrogeResult = await ClinicalEngineCoordinator.analyze(patientRecordWithPhi);
  assert(
    deidCrogeResult.diagnoses.some((d) => d.code === '38341003'),
    'M1.3c: CROGE extracts SNOMED hypertension from scrubbed clinical narrative',
  );
  assert(
    deidCrogeResult.medications.some((m) => m.name.toLowerCase() === 'lisinopril'),
    'M1.3d: CROGE extracts RxNorm lisinopril from scrubbed clinical narrative',
  );
  const subjectiveContent = deidCrogeResult.soapNote.subjective.content.join(' ');
  const assessmentContent = deidCrogeResult.soapNote.assessment.content.join(' ');
  const planContent = deidCrogeResult.soapNote.plan.content.join(' ');
  const allSoapText = `${subjectiveContent} ${assessmentContent} ${planContent}`;
  assert(
    !allSoapText.includes('John Doe') && !allSoapText.includes('AB-1234'),
    'M1.3e: Resulting SOAP note contains zero PHI leakage across Subjective, Assessment, and Plan',
  );

  // M1.4: Deterministic RxNorm frequency and route extraction across repeated calls
  let deterministicSigPass = true;
  for (let i = 0; i < 10; i++) {
    const rxMatches = lookupRxNormConcepts('Prescribed lisinopril 10mg daily oral tablet.');
    if (
      rxMatches.length === 0 ||
      rxMatches[0]?.frequency !== 'daily' ||
      rxMatches[0]?.route?.toLowerCase() !== 'oral'
    ) {
      deterministicSigPass = false;
      break;
    }
  }
  assert(
    deterministicSigPass,
    'M1.4: RxNorm sig extraction (frequency: daily, route: Oral) is 100% deterministic across repeated calls',
  );

  // M1.5: CROGE execution is verified and robust with SLM removed
  const complexCase =
    'T: 140/90 mmHg, N: 88 x/m, R: 20 x/m, S: 37.0 C. Kalium: 1.87 mEq/L, PLT: 54000 /uL. Pasien mengeluh lemas dan pusing, riwayat hipertensi, th/ lisinopril 10mg daily.';
  const analysisResult = await ClinicalEngineCoordinator.analyze(complexCase, { enableNeural: false });
  assert(
    analysisResult.neuralMode === false,
    'M1.5a: Coordinator runs in pure CROGE deterministic mode (SLM removed)',
  );
  assert(
    analysisResult.soapNote.assessment.content.length > 0,
    'M1.5b: CROGE generates structured Assessment content',
  );
  assert(
    analysisResult.soapNote.plan.content.length > 0,
    'M1.5c: CROGE generates structured Plan content',
  );
  assert(
    analysisResult.diagnoses.length > 0 && analysisResult.medications.length > 0,
    'M1.5d: Verified CROGE diagnoses and medications are preserved in result',
  );

  console.log('\n======================================================================');
  console.log(`TOTAL: ${passedTests} Passed, ${failedTests} Failed across ${totalTests} tests`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runClinicalUnitTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
