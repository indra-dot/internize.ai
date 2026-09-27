/**
 * tests/unit/m1_challenger_2_empirical.ts
 *
 * Empirical Challenge Harness for Milestone 1 (internize.ai)
 * Challenger 2: Empirical stress-testing of Neural SLM Co-Pilot toggle & Directed Analysis wiring.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { ClinicalEngineCoordinator } from '../../src/services/clinical/engine';
import { CrogeEngine } from '../../src/services/clinical/croge';
import { SlmEngine } from '../../src/services/clinical/slmEngine';
import { deidentifyText } from '../../src/services/deid/deidentifier';
import { lookupRxNormConcepts } from '../../src/services/clinical/rxnormDictionary';
import ClinicalServiceTab from '../../src/features/clinical/ClinicalServiceTab';

interface TestResult {
  task: string;
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  details?: string;
}

const testResults: TestResult[] = [];

function check(
  task: string,
  name: string,
  condition: boolean,
  expected?: any,
  actual?: any,
  details?: string,
) {
  testResults.push({ task, name, passed: condition, expected, actual, details });
  if (condition) {
    console.log(`  ✓ [PASS] [${task}] ${name}`);
  } else {
    console.error(`  ✗ [FAIL] [${task}] ${name}`);
    console.error(`           Expected: ${JSON.stringify(expected)}`);
    console.error(`           Actual:   ${JSON.stringify(actual)}`);
    if (details) console.error(`           Details:  ${details}`);
  }
}

export async function runEmpiricalHarness(): Promise<{
  passedCount: number;
  failedCount: number;
  results: TestResult[];
}> {
  console.log('\n======================================================================');
  console.log('   CHALLENGER 2: EMPIRICAL HARNESS — NEURAL SLM TOGGLE & DIRECTED WIRING');
  console.log('======================================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1: Initial Mount State of ClinicalServiceTab
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TASK 1: Initial mount state of ClinicalServiceTab (enableNeural = false, 0 network requests) ---');

  // 1.1 Source-level contract verification
  const tabSourcePath = path.resolve('src/features/clinical/ClinicalServiceTab.tsx');
  const tabSource = fs.readFileSync(tabSourcePath, 'utf-8');

  const hasEnableNeuralFalse = /const\s+\[enableNeural,\s*setEnableNeural\]\s*=\s*useState<boolean>\(false\);/.test(tabSource);
  check(
    'Task 1',
    'ClinicalServiceTab initializes enableNeural state to strictly false',
    hasEnableNeuralFalse,
    true,
    hasEnableNeuralFalse,
    'Verified line 124: useState<boolean>(false)',
  );

  const hasFirstMountRefGuard = /isFirstMountRef\.current\s*=\s*false;\s*return;/.test(tabSource);
  check(
    'Task 1',
    'ClinicalServiceTab contains isFirstMountRef guard to prevent prewarm on initial mount',
    hasFirstMountRefGuard,
    true,
    hasFirstMountRefGuard,
  );

  // 1.2 Verify exact UI text & tooltip requirements
  const expectedToggleLabel = '⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)';
  const expectedTooltip = 'Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik.';
  const hasRequiredLabel = tabSource.includes(expectedToggleLabel);
  const hasRequiredTooltip = tabSource.includes(expectedTooltip);
  const hasOffUnloadedBadge = tabSource.includes('OFF / Unloaded');

  check('Task 1', 'Toggle label matches required copy exactly', hasRequiredLabel, true, hasRequiredLabel);
  check('Task 1', 'Toggle tooltip matches required clinical copy exactly', hasRequiredTooltip, true, hasRequiredTooltip);
  check('Task 1', 'Toggle displays "OFF / Unloaded" badge when disabled', hasOffUnloadedBadge, true, hasOffUnloadedBadge);

  // 1.3 Empirical Network Request Interception during Mount
  let networkRequestCount = 0;
  const interceptedUrls: string[] = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: any) => {
    networkRequestCount++;
    const url = typeof input === 'string' ? input : input?.url || String(input);
    interceptedUrls.push(url);
    return originalFetch(input, init);
  }) as typeof fetch;

  // Mount/SSR render component & run hardware detection
  const initialStatus = SlmEngine.getStatus();
  ReactDOMServer.renderToString(React.createElement(ClinicalServiceTab));
  await ClinicalEngineCoordinator.detectInferenceDevice();
  const statusAfterMount = SlmEngine.getStatus();

  // Restore fetch
  globalThis.fetch = originalFetch;

  check(
    'Task 1',
    'Component mount triggers zero external network requests / downloads',
    networkRequestCount === 0,
    0,
    networkRequestCount,
    interceptedUrls.length > 0 ? `Intercepted: ${interceptedUrls.join(', ')}` : 'Zero requests made',
  );

  check(
    'Task 1',
    'SLM engine status remains strictly "unloaded" after mount',
    initialStatus === 'unloaded' && statusAfterMount === 'unloaded',
    'unloaded',
    statusAfterMount,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 2: Directed Analysis Wiring when enableNeural: true
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TASK 2: Directed Analysis Wiring with CROGE Facts (enableNeural: true) ---');

  const complexEmergencyCase =
    'Pasien Tn. Budi, No. RM 998877. T: 140/90 mmHg, N: 92 x/m, R: 22 x/m, S: 37.8 C, SpO2: 97%. ' +
    'Kalium: 1.87 mEq/L, PLT: 54000 /uL, Hb: 8.0 g/dL. ' +
    'Pasien demam, penurunan kesadaran, kecurigaan meningoensefalitis bakterial dan sepsis. ' +
    'Riwayat hipertensi kronis, terapi lisinopril 10mg daily oral.';

  const neuralResult = await ClinicalEngineCoordinator.analyze(complexEmergencyCase, {
    enableNeural: true,
  });

  check(
    'Task 2',
    'Coordinator returns neuralMode: true when enableNeural: true is passed',
    neuralResult.neuralMode === true,
    true,
    neuralResult.neuralMode,
  );

  check(
    'Task 2',
    'Directed analysis synthesizes structured assessment lines',
    Array.isArray(neuralResult.soapNote.assessment.content) &&
      neuralResult.soapNote.assessment.content.length >= 2,
    '>= 2 lines',
    neuralResult.soapNote.assessment.content.length,
  );

  const assessmentText = neuralResult.soapNote.assessment.content.join('\n');
  const planText = neuralResult.soapNote.plan.content.join('\n');

  check(
    'Task 2',
    'Directed analysis surfaces severe hypokalemia priority (1.87 mEq/L)',
    assessmentText.includes('Hipokalemia') && assessmentText.includes('1.87'),
    true,
    assessmentText.includes('Hipokalemia'),
  );

  check(
    'Task 2',
    'Directed analysis surfaces neurosurgical thrombocytopenia priority (54.000 /uL)',
    assessmentText.includes('trombosit') || assessmentText.includes('Trombosit'),
    true,
    assessmentText.includes('trombosit') || assessmentText.includes('Trombosit'),
  );

  check(
    'Task 2',
    'Directed analysis merges verified CROGE SNOMED CT ontology codes into Assessment',
    assessmentText.includes('SNOMED CT') && neuralResult.diagnoses.length > 0,
    true,
    assessmentText.includes('SNOMED CT'),
  );

  check(
    'Task 2',
    'Directed analysis merges verified CROGE RxNorm medication codes into Plan',
    planText.includes('RxNorm') && neuralResult.medications.length > 0,
    true,
    planText.includes('RxNorm'),
  );

  // Guardrail test: CSF glucose must NOT be confused with blood glucose
  const csfLcsCase =
    'Pemeriksaan LCS: Glukosa LCS 46 mg/dL, protein LCS 90 mg/dL. TD: 120/80 mmHg. Tidak ada riwayat DM.';
  const csfResult = await ClinicalEngineCoordinator.analyze(csfLcsCase, { enableNeural: true });
  const csfAssessment = csfResult.soapNote.assessment.content.join(' ');

  check(
    'Task 2',
    'Directed analysis avoids phantom Diabetes Mellitus on normal CSF glucose (46 mg/dL)',
    !csfAssessment.includes('Diabetes') && !csfAssessment.includes('Hipoglikemia'),
    true,
    !csfAssessment.includes('Diabetes'),
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 3: enableNeural: false Execution & Inference Device
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TASK 3: enableNeural: false Execution & Inference Device ---');

  const defaultResult = await ClinicalEngineCoordinator.analyze(complexEmergencyCase, {
    enableNeural: false,
  });

  check(
    'Task 3',
    'Coordinator executes zero neural inference when enableNeural: false (neuralMode is false)',
    defaultResult.neuralMode === false,
    false,
    defaultResult.neuralMode,
  );

  check(
    'Task 3',
    'SLM engine status remains unloaded after enableNeural: false execution',
    SlmEngine.getStatus() === 'unloaded',
    'unloaded',
    SlmEngine.getStatus(),
  );

  // Pure CROGE engine direct verification
  const crogeDirectResult = await CrogeEngine.analyze(complexEmergencyCase);
  check(
    'Task 3',
    'CrogeEngine.analyze returns inferenceDevice strictly "cpu"',
    crogeDirectResult.inferenceDevice === 'cpu',
    'cpu',
    crogeDirectResult.inferenceDevice,
  );

  // CHECKING COORDINATOR RETURN DEVICE:
  // Requirement 3 states: "Verify that when enableNeural: false is passed, zero neural inference is executed and device is 'cpu'."
  const coordinatorReportsCpu = defaultResult.inferenceDevice === 'cpu';
  check(
    'Task 3',
    'ClinicalEngineCoordinator.analyze with enableNeural: false returns inferenceDevice "cpu"',
    coordinatorReportsCpu,
    'cpu',
    defaultResult.inferenceDevice,
    coordinatorReportsCpu
      ? 'Coordinator properly reflects CPU device for deterministic CROGE execution'
      : `DEFECT FOUND: Coordinator returned '${defaultResult.inferenceDevice}' instead of 'cpu' on pure Tier 1 CROGE execution (engine.ts:319)`,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 4: Additional Stress-Tests & Edge Cases
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TASK 4: Edge Cases, Determinism & Latency Stress-Testing ---');

  // 4.1 Empty / whitespace input handling
  const emptyRes = await ClinicalEngineCoordinator.analyze('   ', { enableNeural: false });
  check(
    'Task 4',
    'Empty input returns valid empty result without crashing',
    emptyRes.diagnoses.length === 0 && emptyRes.medications.length === 0,
    true,
    emptyRes.diagnoses.length === 0,
  );

  // 4.2 Deterministic Sig Parsing across 50 repeated runs
  let sigDeterministic = true;
  for (let i = 0; i < 50; i++) {
    const rx = lookupRxNormConcepts('lisinopril 10mg daily oral tablet');
    if (rx.length === 0 || rx[0]?.frequency !== 'daily' || rx[0]?.route?.toLowerCase() !== 'oral') {
      sigDeterministic = false;
      break;
    }
  }
  check(
    'Task 4',
    'RxNorm sig extraction is 100% deterministic across 50 consecutive runs',
    sigDeterministic,
    true,
    sigDeterministic,
  );

  // 4.3 CROGE Latency Benchmark across 100 runs
  const benchmarkDischarge =
    'Patient with essential hypertension and type 2 diabetes mellitus. Prescribed lisinopril 10mg daily and metformin 500mg BID.';
  const latencies: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    await CrogeEngine.analyze(benchmarkDischarge);
    latencies.push(performance.now() - t0);
  }
  latencies.sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];

  check(
    'Task 4',
    'CROGE average latency benchmark executes in < 15ms',
    avgLatency < 15,
    '< 15ms',
    `${avgLatency.toFixed(2)}ms`,
  );
  check(
    'Task 4',
    'CROGE 95th percentile latency is strictly < 15ms',
    p95Latency < 15,
    '< 15ms',
    `${p95Latency.toFixed(2)}ms`,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  console.log('\n======================================================================');
  console.log(`CHALLENGER 2 SUMMARY: ${passedCount} Passed, ${failedCount} Failed across ${testResults.length} checks`);
  console.log('======================================================================\n');

  return { passedCount, failedCount, results: testResults };
}

// Execute directly if run as main module
runEmpiricalHarness()
  .then(({ failedCount }) => {
    if (failedCount > 0) {
      console.log(`Harness finished with ${failedCount} failure(s). Documenting in handoff.`);
    } else {
      console.log('All tests passed.');
    }
  })
  .catch((err) => {
    console.error('Harness execution error:', err);
    process.exit(1);
  });
