/**
 * Milestone 2 Challenger Empirical Stress-Test Harness
 * Tests SOAP note generation, span citations, terminology concepts (SNOMED, RxNorm),
 * and execution latency.
 */

import { CrogeEngine, analyze, extractSnomed, extractRxNorm, extractEntities, isNegatedSpan } from '../src/services/clinical/croge';
import { synthesizeSoapNote } from '../src/services/clinical/soapSynthesizer';
import { ClinicalEngineCoordinator, detectInferenceDevice } from '../src/services/clinical/engine';
import { SNOMED_LEXICON, lookupSnomedConcepts } from '../src/services/clinical/snomedDictionary';
import { RXNORM_LEXICON, lookupRxNormConcepts } from '../src/services/clinical/rxnormDictionary';
import type { SoapCitation, SoapNote, ClinicalAnalysisResult } from '../src/types/clinical';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
  durationMs?: number;
}

const results: TestResult[] = [];

function record(category: string, name: string, condition: boolean, expected: any, actual: any, error?: string, durationMs?: number) {
  results.push({
    category,
    name,
    passed: condition,
    expected,
    actual,
    error,
    durationMs,
  });
  const status = condition ? '✓ PASS' : '✗ FAIL';
  console.log(`[${status}] [${category}] ${name}`);
  if (!condition) {
    console.error(`       Expected: ${JSON.stringify(expected)}`);
    console.error(`       Actual:   ${JSON.stringify(actual)}`);
    if (error) console.error(`       Error:    ${error}`);
  }
}

export async function runAllEmpiricalTests() {
  console.log('========================================================================');
  console.log('   M2 EMPIRICAL CHALLENGER: SOAP, CITATIONS, ONTOLOGY & LATENCY TESTS   ');
  console.log('========================================================================\n');

  // =========================================================================
  // Section 1: Benchmark Acceptance Criteria Verification
  // Input: "Patient presents with hypertension and is on lisinopril 10mg daily."
  // =========================================================================
  console.log('--- SECTION 1: BENCHMARK ACCEPTANCE CRITERIA ---');
  const benchmarkInput = 'Patient presents with hypertension and is on lisinopril 10mg daily.';

  const tStart = performance.now();
  const benchmarkAnalysis = await analyze(benchmarkInput);
  const benchmarkDuration = performance.now() - tStart;

  // 1.1 All 4 Headers exist in SoapNote
  const soap = benchmarkAnalysis.soapNote;
  record(
    'Benchmark',
    'Subjective header exists and matches "Subjective"',
    soap.subjective !== undefined && soap.subjective.title === 'Subjective',
    'Subjective',
    soap.subjective?.title
  );
  record(
    'Benchmark',
    'Objective header exists and matches "Objective"',
    soap.objective !== undefined && soap.objective.title === 'Objective',
    'Objective',
    soap.objective?.title
  );
  record(
    'Benchmark',
    'Assessment header exists and matches "Assessment"',
    soap.assessment !== undefined && soap.assessment.title === 'Assessment',
    'Assessment',
    soap.assessment?.title
  );
  record(
    'Benchmark',
    'Plan header exists and matches "Plan"',
    soap.plan !== undefined && soap.plan.title === 'Plan',
    'Plan',
    soap.plan?.title
  );

  // 1.2 Non-empty content in sections
  record('Benchmark', 'Subjective has non-empty content', soap.subjective.content.length > 0, true, soap.subjective.content.length > 0);
  record('Benchmark', 'Objective has non-empty content', soap.objective.content.length > 0, true, soap.objective.content.length > 0);
  record('Benchmark', 'Assessment has non-empty content', soap.assessment.content.length > 0, true, soap.assessment.content.length > 0);
  record('Benchmark', 'Plan has non-empty content', soap.plan.content.length > 0, true, soap.plan.content.length > 0);

  // 1.3 SNOMED concept with display containing "hypertension" (SCTID 38341003)
  const htnConcept = benchmarkAnalysis.diagnoses.find(
    (d) => d.code === '38341003' || d.display.toLowerCase().includes('hypertension') || d.preferredTerm.toLowerCase().includes('hypertension')
  );
  record(
    'Benchmark',
    'Returns SNOMED concept with display/preferredTerm containing "hypertension" (SCTID 38341003)',
    htnConcept !== undefined && (htnConcept.code === '38341003' || htnConcept.display.toLowerCase().includes('hypertension')),
    'SCTID 38341003 / hypertension',
    htnConcept ? `${htnConcept.code} (${htnConcept.display})` : 'none'
  );

  // 1.4 RxNorm concept with display containing "lisinopril" (RxCUI 29046)
  const lisinoprilConcept = benchmarkAnalysis.medications.find(
    (m) => m.rxcui === '29046' || m.name.toLowerCase().includes('lisinopril') || m.ttyDisplay.toLowerCase().includes('lisinopril')
  );
  record(
    'Benchmark',
    'Returns RxNorm concept with name/display containing "lisinopril" (RxCUI 29046)',
    lisinoprilConcept !== undefined && (lisinoprilConcept.rxcui === '29046' || lisinoprilConcept.name.toLowerCase().includes('lisinopril')),
    'RxCUI 29046 / lisinopril',
    lisinoprilConcept ? `${lisinoprilConcept.rxcui} (${lisinoprilConcept.name})` : 'none'
  );

  // =========================================================================
  // Section 2: Span Citations Verbatim Indexing Accuracy Stress Test
  // For all generated citations, verify:
  // rawText.slice(citation.start, citation.end) === citation.sourceText
  // and 0 <= start <= end <= rawText.length
  // =========================================================================
  console.log('\n--- SECTION 2: VERBATIM SPAN CITATION VALIDATION ---');

  const testCorpora = [
    { name: 'Benchmark Input', text: benchmarkInput },
    {
      name: 'Multi-Condition Complex Discharge',
      text: 'Patient presents with essential hypertension, type 2 diabetes mellitus, and chronic kidney disease. Taking metformin 500mg BID and lisinopril 20mg daily.',
    },
    {
      name: 'Explicit Headers Formatting',
      text: 'Subjective: Patient reports chronic headaches and fatigue.\nObjective: BP 155/95 mmHg, heart rate 78 bpm.\nAssessment: Essential hypertension uncontrolled.\nPlan: Increase lisinopril to 20mg daily PO.',
    },
    {
      name: 'Punctuation Variety & Exclamation',
      text: 'Patient feels dizzy! Blood pressure was 160/100 yesterday? Diagnosed with hypertension; prescribed amlodipine 5mg daily.',
    },
    {
      name: 'Single Clause Without End Punctuation',
      text: 'Patient reports chest pain and hypertension',
    },
    {
      name: 'Brand Name Medication',
      text: 'Patient taking Zestril 10mg daily for high blood pressure.',
    },
    {
      name: 'Negative Clinical Findings',
      text: 'Patient denies hypertension and no history of asthma. Evaluated for chest pain.',
    },
    {
      name: 'Multi-line with irregular spaces and tabs',
      text: 'Patient\t\tpresents with   hypertension.\n\n   Taking   lisinopril 10mg  daily.   ',
    },
    {
      name: 'Only medication without condition',
      text: 'Current prescriptions: atorvastatin 20mg daily and metformin 1000mg BID.',
    },
    {
      name: 'Only condition without medication',
      text: 'Chief complaint: severe migraine headache and nausea.',
    },
    {
      name: 'Mixed-case clinical names',
      text: 'Patient with HyPeRtEnSiOn taking LiSiNoPrIl 10mg daily and MeTfOrMiN 500mg BID.',
    },
    {
      name: 'Repeated mentions in same document',
      text: 'Patient with hypertension. Blood pressure elevated due to hypertension. Continuing lisinopril 10mg daily; was previously on lisinopril 5mg.',
    },
    {
      name: 'Clinical abbreviations',
      text: 'History of HTN and T2D. Currently on ACE inhibitor lisinopril 10mg QD.',
    },
    {
      name: 'Special unicode and parenthetical formatting',
      text: 'Patient (age 64) with hypertension [diagnosed 2021] on lisinopril 10mg (morning) + aspirin 81mg (PRN).',
    },
  ];

  let totalCitationsTested = 0;
  let invalidCitationsCount = 0;
  const failureDetails: string[] = [];

  for (const corpus of testCorpora) {
    const analysis = await analyze(corpus.text);
    const sections: Array<{ title: string; citations?: SoapCitation[] }> = [
      analysis.soapNote.subjective,
      analysis.soapNote.objective,
      analysis.soapNote.assessment,
      analysis.soapNote.plan,
    ];

    let corpusAllCitationsValid = true;

    for (const sec of sections) {
      if (!sec.citations || sec.citations.length === 0) continue;
      for (const cite of sec.citations) {
        totalCitationsTested++;
        // Check bounds
        const inBounds = cite.start >= 0 && cite.end <= corpus.text.length && cite.start <= cite.end;
        const actualSlice = corpus.text.slice(cite.start, cite.end);
        const matchesVerbatim = actualSlice === cite.sourceText;

        if (!inBounds || !matchesVerbatim) {
          corpusAllCitationsValid = false;
          invalidCitationsCount++;
          failureDetails.push(`[${corpus.name}][${sec.title}] Span [${cite.start}:${cite.end}], expected "${cite.sourceText}", got "${actualSlice}"`);
        }
      }
    }

    record(
      'Span Citations',
      `Verbatim source slice check: "${corpus.name}"`,
      corpusAllCitationsValid,
      'all citations exactly match rawText.slice(start, end)',
      corpusAllCitationsValid ? 'All matched verbatim' : failureDetails[failureDetails.length - 1]
    );
  }

  record(
    'Span Citations',
    `Overall verbatim citation integrity across all test corpora (${totalCitationsTested} citations tested)`,
    invalidCitationsCount === 0,
    0,
    invalidCitationsCount,
    failureDetails.join('; ')
  );

  // =========================================================================
  // Section 3: Latency & Performance Benchmarks
  // Target: Sub-second (<100ms for CROGE)
  // =========================================================================
  console.log('\n--- SECTION 3: LATENCY & PERFORMANCE BENCHMARKS ---');

  // Cold start execution time
  record(
    'Latency',
    'Cold start CROGE execution latency < 100ms',
    benchmarkDuration < 100,
    '<100ms',
    `${benchmarkDuration.toFixed(2)}ms`,
    undefined,
    benchmarkDuration
  );

  // 100-run distribution test on benchmark text
  const latencies: number[] = [];
  const RUNS = 100;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await analyze(benchmarkInput);
    latencies.push(performance.now() - t0);
  }

  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const sumLatency = latencies.reduce((acc, v) => acc + v, 0);
  const avgLatency = sumLatency / latencies.length;
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`  Latency Distribution over ${RUNS} runs:`);
  console.log(`    Min: ${minLatency.toFixed(3)}ms | Avg: ${avgLatency.toFixed(3)}ms | Median: ${p50Latency.toFixed(3)}ms`);
  console.log(`    p95: ${p95Latency.toFixed(3)}ms | p99: ${p99Latency.toFixed(3)}ms | Max: ${maxLatency.toFixed(3)}ms`);

  record('Latency', `Mean execution latency < 20ms (Actual: ${avgLatency.toFixed(2)}ms)`, avgLatency < 20, '<20ms', `${avgLatency.toFixed(2)}ms`);
  record('Latency', `p95 execution latency < 50ms (Actual: ${p95Latency.toFixed(2)}ms)`, p95Latency < 50, '<50ms', `${p95Latency.toFixed(2)}ms`);
  record('Latency', `Max execution latency < 100ms (Actual: ${maxLatency.toFixed(2)}ms)`, maxLatency < 100, '<100ms', `${maxLatency.toFixed(2)}ms`);

  // Stress test with medium text (11KB)
  const paragraph = 'Patient with hypertension taking lisinopril 10mg daily and metformin 500mg BID. Reports occasional chest pain. ';
  const largeText = paragraph.repeat(100); // ~11,000 characters
  const tLargeStart = performance.now();
  const largeResult = await analyze(largeText);
  const largeDuration = performance.now() - tLargeStart;

  record(
    'Latency Stress',
    `Large text (11KB, ~1,100 clinical tokens) executes in < 100ms`,
    largeDuration < 100,
    '<100ms',
    `${largeDuration.toFixed(2)}ms`,
    undefined,
    largeDuration
  );

  // Extreme Stress test: 50KB text (~5,000 clinical tokens)
  const massiveText = paragraph.repeat(500); // ~55,000 characters
  const tMassiveStart = performance.now();
  const massiveResult = await analyze(massiveText);
  const massiveDuration = performance.now() - tMassiveStart;

  record(
    'Latency Stress',
    `Massive text (55KB, ~5,500 clinical tokens) executes in < 250ms`,
    massiveDuration < 250,
    '<250ms',
    `${massiveDuration.toFixed(2)}ms`,
    undefined,
    massiveDuration
  );

  // =========================================================================
  // Section 4: Edge Cases & Adversarial Robustness
  // =========================================================================
  console.log('\n--- SECTION 4: EDGE CASES & ADVERSARIAL ROBUSTNESS ---');

  // 4.1 Empty input
  const emptyRes = await analyze('');
  record(
    'Edge Case',
    'Empty string produces valid SOAP with all 4 headers without throwing',
    emptyRes.soapNote.subjective.title === 'Subjective' &&
      emptyRes.soapNote.objective.title === 'Objective' &&
      emptyRes.soapNote.assessment.title === 'Assessment' &&
      emptyRes.soapNote.plan.title === 'Plan',
    true,
    true
  );

  // 4.2 Whitespace only
  const wsRes = await analyze('   \n\t\r   ');
  record(
    'Edge Case',
    'Whitespace-only string produces valid SOAP note without errors',
    wsRes.soapNote.subjective.title === 'Subjective' && wsRes.diagnoses.length === 0,
    true,
    true
  );

  // 4.3 Punctuation only
  const punctRes = await analyze('... !? ,,, ;;;');
  record(
    'Edge Case',
    'Punctuation-only string does not throw and produces valid structure',
    punctRes.soapNote.subjective.title === 'Subjective',
    true,
    true
  );

  // 4.4 NegEx Negation Scope: "Patient denies hypertension"
  const negExRes = await analyze('Patient denies hypertension.');
  const negHtnExtracted = negExRes.diagnoses.some((d) => d.code === '38341003');
  record(
    'NegEx',
    'Denies hypertension: negated condition is excluded from active diagnoses',
    !negHtnExtracted,
    'excluded (length 0)',
    negExRes.diagnoses.length
  );

  // 4.5 NegEx Conjunction Reset: "Patient has no fever, but reports hypertension."
  const conjRes = await analyze('Patient has no fever, but reports hypertension.');
  const conjHtnExtracted = conjRes.diagnoses.some((d) => d.code === '38341003');
  record(
    'NegEx',
    'Conjunction "but" resets negation scope: reports hypertension is captured',
    conjHtnExtracted,
    true,
    conjHtnExtracted
  );

  // 4.6 Determinism check
  const det1 = await analyze(benchmarkInput);
  const det2 = await analyze(benchmarkInput);
  const isDeterministic =
    JSON.stringify(det1.soapNote.subjective) === JSON.stringify(det2.soapNote.subjective) &&
    JSON.stringify(det1.diagnoses) === JSON.stringify(det2.diagnoses) &&
    JSON.stringify(det1.medications) === JSON.stringify(det2.medications);
  record('Robustness', 'Deterministic execution across identical calls', isDeterministic, true, isDeterministic);

  // 4.7 ClinicalEngineCoordinator integration
  const coordRes = await ClinicalEngineCoordinator.analyze(benchmarkInput);
  record(
    'Coordinator',
    'ClinicalEngineCoordinator delivers valid result with inferenceDevice',
    coordRes.soapNote.subjective.content.length > 0 && ['webgpu', 'wasm', 'cpu'].includes(coordRes.inferenceDevice),
    true,
    coordRes.inferenceDevice
  );

  // =========================================================================
  // Summary & Verdict
  // =========================================================================
  console.log('\n========================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  console.log(`TOTAL AUDIT RESULTS: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(1)}%), ${failed} FAILED`);
  console.log('========================================================================\n');

  return {
    total,
    passed,
    failed,
    verdict: failed === 0 ? 'APPROVE' : 'CHALLENGE_FAILED',
    results,
    latencies: {
      min: minLatency,
      max: maxLatency,
      mean: avgLatency,
      p50: p50Latency,
      p95: p95Latency,
      p99: p99Latency,
      benchmarkCold: benchmarkDuration,
      large11KB: largeDuration,
      massive55KB: massiveDuration,
    },
  };
}

// Execute when run directly via tsx
runAllEmpiricalTests().then((res) => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error('Fatal execution error in empirical harness:', err);
  process.exit(1);
});
