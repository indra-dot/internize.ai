# Scope: Milestone 1 — CROGE Engine (<15ms), OpenMed PII Scrubbing & On-Demand SLM Toggle (R1)

## Architecture & Assigned Features
- Feature 1: Deterministic CROGE Primary Engine (<15ms)
- Feature 2: OpenMed-Aligned PII Scrubbing prior to CROGE / SLM layers
- Feature 3: Curated SNOMED CT & RxNorm Grounding (including fix for stateful `lastIndex = 0` regex in `rxnormDictionary.ts`)
- Feature 4: On-Demand Neural SLM Co-Pilot Toggle (default OFF / Unloaded, exact label and tooltip, 0 eager weight downloads)
- Feature 5: CROGE-Directed Neural Analysis (wire `ClinicalEngineCoordinator.analyze` to extract verified facts and pass to `generateDirectedClinicalAnalysis` when neural toggle is ON)

## Reference Survey
- Read `c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\redesign_explorer_1\survey_report.md` and `handoff.md`.

## File Ownership
The Worker exclusively owns and modifies:
- `src/features/clinical/ClinicalServiceTab.tsx`
- `src/services/clinical/engine.ts`
- `src/services/clinical/croge.ts`
- `src/services/clinical/rxnormDictionary.ts`
- `tests/unit/clinical.test.ts`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria
1. `enableNeural` in `ClinicalServiceTab.tsx` defaults to `false`. Pre-warming occurs ONLY when explicitly toggled ON.
2. Toggle UI displays: `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` with tooltip `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."`.
3. OpenMed-aligned PII scrubbing (`deidentifyText`) executes prior to entity extraction and clinical categorization.
4. `FREQUENCY_REGEX` and `ROUTE_REGEX` in `rxnormDictionary.ts` have `lastIndex = 0` reset, ensuring deterministic extraction.
5. In neural mode (`enableNeural: true`), `ClinicalEngineCoordinator.analyze` extracts CROGE-verified facts and passes them to `generateDirectedClinicalAnalysis`.
6. CROGE latency benchmark executes in <15ms.
7. `npm test` and `npm run build` pass with exit code 0.
