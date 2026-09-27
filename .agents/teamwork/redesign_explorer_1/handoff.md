# Handoff Report: Requirement R1 Survey & Architecture Audit

**Agent:** Survey Explorer 1  
**Timestamp:** 2026-09-27T10:45:00Z  
**Target Milestone:** redesign-survey-r1  
**Handoff Type:** Hard  

---

## 1. Observation

1. **Eager Weight Download in `ClinicalServiceTab.tsx`**:
   - `src/features/clinical/ClinicalServiceTab.tsx:124`:
     ```typescript
     const [enableNeural, setEnableNeural] = useState<boolean>(true);
     ```
   - `src/features/clinical/ClinicalServiceTab.tsx:159-168`:
     ```typescript
     useEffect(() => {
       if (!enableNeural) return;
       if (getSlmStatus() === 'unloaded') {
         ClinicalEngineCoordinator.prewarmSlmEngine((evt) => {
           setSlmProgress(evt);
           if (evt.status === 'ready' || evt.status === 'error') {
             setTimeout(() => setSlmProgress(null), 3000);
           }
         });
       }
     }, [enableNeural]);
     ```
   - Because `enableNeural` initializes to `true`, `prewarmSlmEngine()` triggers immediately when the component mounts, initiating network downloads of model shards for `onnx-community/Qwen2.5-0.5B-Instruct` or `onnx-community/SmolLM2-135M-Instruct` from Hugging Face Hub without user consent.

2. **CROGE Latency Measurement**:
   - Command run: `npx tsx tests/m2_challenger_empirical.ts`
   - Output from benchmark test section:
     ```
     [✓ PASS] [Latency] Cold start CROGE execution latency < 100ms
       Latency Distribution over 100 runs:
         Min: 0.964ms | Avg: 1.166ms | Median: 1.163ms
         p95: 1.389ms | p99: 2.992ms | Max: 2.992ms
     ```
   - Execution of deterministic CROGE takes ~1.17ms on average and 2.99ms maximum, well below the required <15ms ceiling.

3. **PII De-identification Isolation in `deidentifier.ts`**:
   - `src/services/deid/deidentifier.ts:169`: `export function deidentifyText(rawText: string): DeidentificationResult`
   - Grep search across `src/` for `deidentifyText`:
     ```
     src/features/research/ResearchExtractionTab.tsx:15:  const [{ deidentifyText }, { checkHipaaCompliance }] = await Promise.all([
     src/features/research/ResearchExtractionTab.tsx:19:  const deidResult = deidentifyText(text);
     src/services/deid/deidentifier.ts:169:export function deidentifyText(rawText: string): DeidentificationResult {
     ```
   - `deidentifyText` is exclusively used in `ResearchExtractionTab.tsx`. Neither `croge.ts`, `engine.ts`, nor `internalMedicineEngine.ts` invoke PII redaction. Raw clinical narratives are processed directly by entity extraction and clinical parsers.

4. **Disconnected `generateDirectedClinicalAnalysis` in `engine.ts`**:
   - `src/services/clinical/slmEngine.ts:479`:
     ```typescript
     export async function generateDirectedClinicalAnalysis(
       input: DirectedClinicalPromptInput,
       onProgress?: SlmProgressCallback,
     ): Promise<DirectedClinicalAnalysisOutput>
     ```
   - `src/services/clinical/engine.ts:218`:
     ```typescript
     const neuralSoap = await generateNeuralSoap(text, options.onSlmProgress);
     ```
   - `ClinicalEngineCoordinator` invokes ungrounded `generateNeuralSoap()` instead of `generateDirectedClinicalAnalysis()`. No CROGE-verified facts (`vitals`, `verifiedLabs`, `verifiedProblems`) are gathered or injected.

5. **Stateful RegExp Bug in `rxnormDictionary.ts`**:
   - `src/services/clinical/rxnormDictionary.ts:784`:
     ```typescript
     export const FREQUENCY_REGEX = /\b(once daily|...|daily|...)\b/gi;
     ```
   - `src/services/clinical/rxnormDictionary.ts:854-857`:
     ```typescript
     const freqMatch = FREQUENCY_REGEX.exec(fullContextWindow);
     if (freqMatch) {
       frequency = freqMatch[1].toLowerCase();
     }
     ```
   - When run in a loop with identical input text (`Patient presents with hypertension and is on lisinopril 10mg daily.`), the first call returns `frequency: 'daily'`, and the second call returns `frequency: undefined` because `FREQUENCY_REGEX.lastIndex` is not reset to 0.

6. **UI Toggle Mismatch in `ClinicalServiceTab.tsx`**:
   - Lines 621–623:
     ```tsx
     <span className="font-semibold text-slate-800 text-[11px]">
       Neural SLM (Small Language Model)
     </span>
     ```
   - Lines 637:
     ```tsx
     title={enableNeural ? 'Nonaktifkan Neural SLM' : 'Aktifkan Neural SLM'}
     ```
   - Neither the label `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` nor the required tooltip `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."` is present.

---

## 2. Logic Chain

1. **Premise**: Requirement R1 mandates that the default execution path must be 100% deterministic CROGE running locally in <15ms without invoking neural model pipelines or downloading weights.
   - **From Observation 1**: In `ClinicalServiceTab.tsx`, `enableNeural` is initialized to `true` and immediately triggers `prewarmSlmEngine()` via `useEffect`, which starts downloading model weights.
   - **Deduction 1**: The default state directly violates the zero-download requirement. Initializing `enableNeural` to `false` and removing eager mount-time pre-warming is required to guarantee zero weight downloads and zero neural pipeline invocations on initial run.
   - **From Observation 2**: CROGE runs in ~1.17ms on CPU rules.
   - **Deduction 2**: CROGE easily meets the <15ms requirement once freed from eager neural pre-warming.

2. **Premise**: Requirement R1 mandates OpenMed-aligned PII scrubbing/de-identification prior to downstream analysis layers, and extracting clinical entities mapped deterministically to SNOMED CT and RxNorm.
   - **From Observation 3**: PII de-identification is currently only present in the research tab. Clinical analysis receives raw PHI.
   - **From Observation 5**: `rxnormDictionary.ts` drops frequency on subsequent calls due to missing `lastIndex = 0`.
   - **Deduction 3**: An OpenMed-aligned de-identification pass must be introduced at the beginning of `ClinicalEngineCoordinator.analyze(text)` or before CROGE. The scrubbed text must then feed `extractSnomed`, `extractRxNorm`, and `internalMedicineEngine.ts`. Fixing the `lastIndex` bug in `rxnormDictionary.ts` is required for deterministic RxNorm extraction.

3. **Premise**: Requirement R1 mandates an explicit user toggle `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` (default: OFF / Unloaded) with an informative tooltip, and only when toggled ON will the system invoke `generateDirectedClinicalAnalysis` injected with CROGE-verified facts.
   - **From Observation 4 & 6**: The toggle currently has the wrong label, wrong tooltip, and wrong default state. Furthermore, `ClinicalEngineCoordinator` calls `generateNeuralSoap()` instead of `generateDirectedClinicalAnalysis()`.
   - **Deduction 4**: The toggle in `ClinicalServiceTab.tsx` must be updated to default to `false`, with the exact required label and tooltip. When toggled ON, `ClinicalEngineCoordinator.analyze()` must extract CROGE-verified facts (`vitals` via `extractVitals`, `verifiedLabs` via `extractAbnormalLabs`, `verifiedProblems` via `identifySpPdProblems`) and pass them to `generateDirectedClinicalAnalysis`.

---

## 3. Caveats

- **No Caveats on Scope**: All files required by Requirement R1 were surveyed directly.
- **WASM Asset Location in Test Runner**: `tests/m1_challenger_empirical.ts` expects `wasm/*` to exist in `dist/wasm/`, but Vite places the bundled ONNX WASM binaries under `dist/assets/`. This does not impact runtime execution in Chrome sidepanel (which loads from `dist/assets/`), but is an artifact of the build configuration.
- **Node.js Environment SLM Execution**: In headless Node.js tests (e.g. `test_csf_glucose_and_trends.test.ts`), `@huggingface/transformers` cannot access browser cache or WebGPU, so `generateDirectedClinicalAnalysis` gracefully falls back to `_fallbackDirectedAnalysis`. This behavior is expected and correct in Node environments, but in browser runtime WebGPU/WASM is used.

---

## 4. Conclusion

The existing codebase already contains the key underlying engines (CROGE, 200+ SNOMED CT concepts, RxNorm dictionary, `deidentifier.ts`, and `generateDirectedClinicalAnalysis`), but they are wired incorrectly for Requirement R1:
1. `enableNeural` must default to `false` (OFF / Unloaded).
2. The UI toggle in `ClinicalServiceTab.tsx` must be updated with the exact label `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` and required tooltip.
3. Pre-warming must only occur when the user explicitly flips the toggle to ON.
4. PII de-identification must run before CROGE and SLM layers.
5. `ClinicalEngineCoordinator` must gather CROGE-verified facts and invoke `generateDirectedClinicalAnalysis` when neural mode is ON.
6. The regex `lastIndex = 0` bug in `rxnormDictionary.ts` must be fixed to ensure 100% determinism.

---

## 5. Verification Method

To independently verify the survey findings and ensure readiness for implementation:

1. **Verify Default State and Weight Download Invariant**:
   - Check `src/features/clinical/ClinicalServiceTab.tsx` line 124: ensure default state is boolean `false`.
   - Inspect network panel in Chrome DevTools: confirm 0 requests to `huggingface.co` on initial load.

2. **Verify CROGE Latency**:
   - Run: `npx tsx tests/m2_challenger_empirical.ts`
   - Observe Section 3 latency output: `Avg < 15ms`.

3. **Verify RxNorm Determinism Defect**:
   - Run:
     ```powershell
     npx tsx -e "import { lookupRxNormConcepts } from './src/services/clinical/rxnormDictionary'; const r1 = lookupRxNormConcepts('lisinopril 10mg daily'); const r2 = lookupRxNormConcepts('lisinopril 10mg daily'); console.log('Call 1 freq:', r1[0]?.frequency); console.log('Call 2 freq:', r2[0]?.frequency);"
     ```
   - In current code: Call 1 prints `daily`, Call 2 prints `undefined`.
   - After fix: Both calls must print `daily`.

4. **Verify Test Suite**:
   - Run: `npm test`
   - Ensure all 4 test tiers and 4 unit test suites pass cleanly with exit code 0.
   - Run: `npm run build`
   - Ensure clean compilation with zero TypeScript errors.
