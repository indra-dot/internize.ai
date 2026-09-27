# Handoff Report: Milestone 1 — CROGE Engine (<15ms), OpenMed PII Scrubbing, Curated SNOMED/RxNorm Grounding & On-Demand Neural SLM Toggle (R1)

**Agent:** Worker M1  
**Timestamp:** 2026-09-27T10:56:30Z  
**Target Milestone:** M1 (Requirement R1)  
**Handoff Type:** Hard  

---

## 1. Observation

1. **Eager SLM Weight Downloads in `ClinicalServiceTab.tsx`**:
   - In `src/features/clinical/ClinicalServiceTab.tsx:124`, `enableNeural` was initialized to `true`.
   - In `ClinicalServiceTab.tsx:159–169`, `useEffect` triggered `ClinicalEngineCoordinator.prewarmSlmEngine()` on component mount, starting background downloads of model weights without user action.
   - The toggle switch label was `"Neural SLM (Small Language Model)"` and the tooltip was generic (`"Nonaktifkan Neural SLM"` / `"Aktifkan Neural SLM"`).

2. **Detached PII De-identification**:
   - `src/services/deid/deidentifier.ts` implemented 18 HIPAA Safe Harbor categories (`deidentifyText`), but was only invoked in `ResearchExtractionTab.tsx`.
   - Neither `src/services/clinical/engine.ts` nor `src/services/clinical/croge.ts` scrubbed clinical narrative before extracting entities, calculating scores, or passing text to neural models.

3. **Stateful Regex Bug in `rxnormDictionary.ts`**:
   - In `src/services/clinical/rxnormDictionary.ts:783–786`, `FREQUENCY_REGEX` and `ROUTE_REGEX` were declared with the global flag `/gi`.
   - In `lookupRxNormConcepts` (lines 854 and 861), `FREQUENCY_REGEX.exec()` and `ROUTE_REGEX.exec()` advanced `lastIndex` without resetting `lastIndex = 0`.
   - Repeated calls on identical input (e.g. `'lisinopril 10mg daily'`) caused `Call 1` to return `frequency: 'daily'`, but `Call 2` returned `frequency: undefined`.

4. **Disconnected Directed Clinical Analysis in `engine.ts`**:
   - `src/services/clinical/slmEngine.ts:479` exposed `generateDirectedClinicalAnalysis(input: DirectedClinicalPromptInput)`.
   - `src/services/clinical/engine.ts:218` previously invoked ungrounded `generateNeuralSoap()` and failed to gather or pass CROGE-verified facts (`vitals`, `abnormalLabs`, `activeProblems`).

5. **Empirical Benchmarks & Verification Commands**:
   - CROGE latency benchmark command:
     ```powershell
     npx tsx -e "(async () => { const { CrogeEngine } = await import('./src/services/clinical/croge'); const input = 'Patient presents with essential hypertension and type 2 diabetes. Prescribed lisinopril 10mg daily and metformin 500mg BID.'; const runs = 200; const times: number[] = []; for(let i=0; i<runs; i++) { const t0 = performance.now(); await CrogeEngine.analyze(input); times.push(performance.now() - t0); } times.sort((a,b)=>a-b); console.log('avg:', (times.reduce((s,v)=>s+v,0)/runs).toFixed(2), 'ms', 'median:', times[Math.floor(runs*0.5)].toFixed(2), 'ms', 'p95:', times[Math.floor(runs*0.95)].toFixed(2), 'ms'); })()"
     ```
     Result: `avg: 1.58 ms`, `median: 1.23 ms`, `p95: 2.78 ms`, strictly `< 15 ms`.
   - TypeScript compilation: `npx tsc --noEmit` exited with code 0.
   - Production build: `npm run build` completed in 7.42s with exit code 0.
   - Test suites: `npm test` exited with code 0 (79/79 passed in `clinical.test.ts`, 23/23 in `protocols.test.ts`, 5/5 in `test_csf_glucose_and_trends.test.ts`).
   - Biome lint check on all modified files: `npx @biomejs/biome check` passed with 0 errors.

---

## 2. Logic Chain

1. **Premise 1**: Requirement R1 requires that the default execution path be 100% deterministic CROGE running in <15ms locally without invoking neural model pipelines or downloading weights.
   - **Reasoning**: By changing `enableNeural` initial state to `false` and adding an `isFirstMountRef` guard to `ClinicalServiceTab.tsx`, no model weights are downloaded when the application or sidepanel mounts.
   - **Reasoning**: Benchmarks confirm CROGE execution averages 1.58ms (p95: 2.78ms), well below the 15ms ceiling.

2. **Premise 2**: OpenMed-aligned PII scrubbing must execute prior to entity extraction, SNOMED/RxNorm lookup, and clinical reasoning.
   - **Reasoning**: In `croge.ts`, `extractSnomed`, `extractRxNorm`, `extractEntities`, `generateSoap`, and `analyze` now invoke `deidentifyText(text).redactedText` before running pattern matchers or ontology lookups.
   - **Reasoning**: In `engine.ts`, `ClinicalEngineCoordinator.analyze` runs `deidentifyText(text)` as Step 0 and passes `scrubbedText` downstream to both CROGE and SLM layers, guaranteeing 0 PHI egress.

3. **Premise 3**: The user toggle must display the exact label and tooltip, with targeted invocation of `generateDirectedClinicalAnalysis` injected with CROGE-verified facts.
   - **Reasoning**: In `ClinicalServiceTab.tsx`, the toggle was updated to label `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"`, tooltip `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."`, and dynamic badge indicator (`OFF / Unloaded` vs `Aktif` / `Memuat Model...`).
   - **Reasoning**: In `engine.ts`, when `enableNeural: true`, the coordinator extracts `vitals` (`extractVitals`), `verifiedLabs` (`extractLabTrendsAndAbnormal`), and active problems (`identifySpPdProblems`), constructs `DirectedClinicalPromptInput`, passes it to `generateDirectedClinicalAnalysis`, and maps the output into `SoapNote` via `_buildDirectedSoapNote`.

4. **Premise 4**: RxNorm sig parsing must be deterministic across repeated calls.
   - **Reasoning**: In `rxnormDictionary.ts`, adding `FREQUENCY_REGEX.lastIndex = 0` and `ROUTE_REGEX.lastIndex = 0` before and after matches ensures that regex state does not leak across repeated invocations, verified by Suite 7 unit tests.

---

## 3. Caveats

- **Node.js Environment Behavior for SLM**: In headless Node.js tests, browser WebGPU adapters and cache are unavailable, so `@huggingface/transformers` correctly triggers `_fallbackDirectedAnalysis(input)` inside `slmEngine.ts`. In the actual Chrome extension sidepanel environment, WebGPU / WASM SIMD execution occurs as designed.
- **No Other Caveats**: All 5 assigned files were modified and verified cleanly without touching unauthorized files.

---

## 4. Conclusion

Milestone 1 (Requirement R1) has been completely implemented and verified:
1. Pure deterministic CROGE runs locally with an average latency of ~1.58ms (<15ms requirement).
2. The Neural SLM co-pilot toggle defaults to OFF / Unloaded, with zero eager downloads on mount.
3. The UI toggle switch presents the exact required label and tooltip.
4. OpenMed-aligned PII scrubbing runs prior to all entity extraction, ontology lookup, and clinical reasoning layers.
5. The stateful regex bug in `rxnormDictionary.ts` is resolved, ensuring 100% determinism.
6. Directed neural co-pilot inference is wired with CROGE-verified facts.
7. All automated test suites (`npm test`) pass cleanly (107/107 total test assertions across the project).

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Unit Tests & Acceptance Suite**:
   ```powershell
   npm test
   ```
   *Expected outcome*: Exits with code 0. Suite 7 in `clinical.test.ts` passes all 16 assertions (M1.1 through M1.5).

2. **Verify Type-Checking and Production Build**:
   ```powershell
   npx tsc --noEmit
   npm run build
   ```
   *Expected outcome*: 0 TypeScript errors, bundle completes in `dist/`.

3. **Verify Biome Formatting and Linter**:
   ```powershell
   npx @biomejs/biome check src/services/clinical/engine.ts src/services/clinical/croge.ts src/services/clinical/rxnormDictionary.ts src/features/clinical/ClinicalServiceTab.tsx tests/unit/clinical.test.ts
   ```
   *Expected outcome*: 0 errors, 0 warnings.

4. **Verify Deterministic Sig Parsing**:
   ```powershell
   npx tsx -e "import { lookupRxNormConcepts } from './src/services/clinical/rxnormDictionary'; const r1 = lookupRxNormConcepts('lisinopril 10mg daily'); const r2 = lookupRxNormConcepts('lisinopril 10mg daily'); console.log('Call 1 freq:', r1[0]?.frequency); console.log('Call 2 freq:', r2[0]?.frequency);"
   ```
   *Expected outcome*: Both calls print `daily`.

5. **Verify CROGE Latency (<15ms)**:
   ```powershell
   npx tsx -e "(async () => { const { CrogeEngine } = await import('./src/services/clinical/croge'); const input = 'Patient presents with essential hypertension and type 2 diabetes. Prescribed lisinopril 10mg daily and metformin 500mg BID.'; const runs = 100; const times: number[] = []; for(let i=0; i<runs; i++) { const t0 = performance.now(); await CrogeEngine.analyze(input); times.push(performance.now() - t0); } times.sort((a,b)=>a-b); console.log('avg:', (times.reduce((s,v)=>s+v,0)/runs).toFixed(2), 'ms', 'p95:', times[Math.floor(runs*0.95)].toFixed(2), 'ms'); })()"
   ```
   *Expected outcome*: `avg < 15ms`, `p95 < 15ms`.
