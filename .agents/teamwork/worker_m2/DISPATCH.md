## 2026-09-26T12:33:02Z
**Context**: Milestone 2 Implementation (Clinical Service Tab & Local AI)
**Identity**: You are worker_m2, a teamwork_preview_worker.
**Working Directory**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\worker_m2
**Project Root**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai
**Original Request**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\ORIGINAL_REQUEST.md (MANDATORY: Read this first).
**Project Document**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\PROJECT.md
**Survey Reference**: c:\Users\Wib PC\Documents\Project\myproject\internize.ai\.agents\teamwork\explorer_survey_2\survey_report.md

**MANDATORY INTEGRITY WARNING**:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

**Exclusive Write Ownership**:
`src/services/clinical/**`, `src/features/clinical/**`, and any necessary exports in `src/types/clinical.ts`.

**Implementation Scope**:
1. Implement `src/services/clinical/snomedDictionary.ts`:
   - Curated high-frequency SNOMED CT Clinical Core Lexicon (200+ conditions including hypertension SCTID 38341003, type 2 diabetes SCTID 44054006, chest pain SCTID 29857009, myocardial infarction, asthma, etc.).
   - Includes synonym mapping ("high blood pressure", "htn", "essential hypertension" -> 38341003).
2. Implement `src/services/clinical/rxnormDictionary.ts`:
   - Curated RxNorm Clinical Drug Lexicon (lisinopril IN 29046, SCD 314076; metformin, atorvastatin, amlodipine, etc.).
   - Regex/matcher for strengths (e.g. "10mg", "20 mg"), frequencies ("daily", "BID"), routes ("oral", "PO").
3. Implement `src/services/clinical/croge.ts`:
   - Clinical Rules & Ontology Grounding Engine.
   - Synchronous, deterministic entity extraction (<5ms) for DISEASES and MEDICATIONS.
   - NegEx-style negation detection ("denies", "no history of", "negative for").
   - Resolves matches to SNOMED concepts and RxNorm concepts with character offsets [start, end].
4. Implement `src/services/clinical/soapSynthesizer.ts`:
   - Generates structured SOAP note with 4 canonical headers: Subjective, Objective, Assessment, Plan.
   - Embeds input character span citations [start:end] to guarantee zero clinical hallucination.
   - For sample discharge summary `"Patient presents with hypertension and is on lisinopril 10mg daily."`, outputs all four section headers with clinical assessments and plans.
5. Implement `src/services/clinical/engine.ts`:
   - Multi-tiered coordinator: Executes CROGE for instant <10ms response, and integrates `@huggingface/transformers` (v3) on-device inference with WebGPU (`device: 'webgpu'`) and WASM fallback.
   - Verifies 0 external API calls (100% on-device local computation, zero PHI egress).
6. Implement `src/features/clinical/`:
   - `ClinicalServiceTab.tsx`: Textarea auto-populated from content script selection via `useSelection`, Sample Loader button inserting `"Patient presents with hypertension and is on lisinopril 10mg daily."`, "Analyze Clinical Narrative" action button, execution latency badge, WebGPU/WASM badge, and copy note button.
   - `SoapNoteViewer.tsx`: Clean UI displaying Subjective, Objective, Assessment, Plan with citation badges and copy functionality.
   - `SnomedTable.tsx`: Table listing identified diagnoses with SCTID badges, preferred terms, FSN, hierarchy, and confidence scores.
   - `RxNormTable.tsx`: Table listing identified medications with RxCUI badges, drug names, dosage, term types (IN / SCD), and reconciliation status.
   - Permanent clinical decision support disclaimer banner.
7. Verification:
   - Run `npm run lint` -> 0 errors.
   - Run `npx tsc --noEmit` -> 0 errors.
   - Run `npm run build` -> compiles cleanly to `dist/` in <4s.
   - Run `npm test` -> all 223 E2E tests pass (100%).
