## 2026-09-27T10:44:48Z

You are Worker M1 for internize.ai.
Your mission is to implement Milestone 1: CROGE Engine (<15ms), OpenMed PII Scrubbing, Curated SNOMED/RxNorm grounding, and On-Demand Neural SLM Toggle (R1).

Read these files before starting work:
1. `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\orchestrator\M1_SCOPE.md`
3. `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_1\survey_report.md`
4. `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_1\handoff.md`

Your working directory is:
`c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\m1_worker\`

Exclusive File Ownership:
You own and can modify:
- `src/features/clinical/ClinicalServiceTab.tsx`
- `src/services/clinical/engine.ts`
- `src/services/clinical/croge.ts`
- `src/services/clinical/rxnormDictionary.ts`
- `tests/unit/clinical.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Tasks:
1. In `src/features/clinical/ClinicalServiceTab.tsx`:
   - Change `enableNeural` initial state from `true` to `false` (default: OFF / Unloaded).
   - In the mount `useEffect`, ensure `prewarmSlmEngine` is NEVER called when `enableNeural` is false. Only trigger prewarm when user actively toggles it to true.
   - Update the toggle switch label to: `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"`
   - Update the tooltip to: `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."`
2. In `src/services/clinical/engine.ts` (and `croge.ts` if appropriate):
   - Integrate OpenMed-aligned PII scrubbing (`deidentifyText` from `src/services/deid/deidentifier.ts`) prior to entity extraction, SNOMED/RxNorm lookup, and clinical reasoning.
   - Pass the scrubbed text downstream so clinical entities are extracted cleanly and zero PHI is passed to the SLM.
   - In `ClinicalEngineCoordinator.analyze(text, options)`:
     When `options?.enableNeural` is true, extract CROGE-verified facts (vitals via `extractVitals`, verified labs via `extractAbnormalLabs` / `extractLabTrendsAndAbnormal`, active problems via `identifySpPdProblems`) and inject them into `generateDirectedClinicalAnalysis(...)` from `src/services/clinical/slmEngine.ts`.
     Map the directed analysis output into the resulting `SoapNote`.
3. In `src/services/clinical/rxnormDictionary.ts`:
   - Fix the stateful regex bug: ensure `FREQUENCY_REGEX.lastIndex = 0` and `ROUTE_REGEX.lastIndex = 0` are reset before executing regex matches so repeated calls never drop frequency or route.
4. In `tests/unit/clinical.test.ts`:
   - Add unit tests verifying:
     * CROGE executes in <15ms.
     * Default state does not prewarm or download weights.
     * PII scrubbing runs prior to entity extraction (e.g., patient name / MRN is redacted before diagnosis extraction).
     * RxNorm frequency extraction is deterministic across repeated calls.
     * Directed clinical analysis is wired with CROGE facts when neural mode is ON.
5. Verification:
   - Run `npx tsc --noEmit` and `npm run build` -> must compile cleanly with 0 errors.
   - Run `npm test` -> all test suites must pass cleanly.
   - Run CROGE latency benchmark and record results.
6. Deliver handoff report:
   - Write comprehensive handoff report to `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\m1_worker\handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification Method.
   - Send completion message to orchestrator.
