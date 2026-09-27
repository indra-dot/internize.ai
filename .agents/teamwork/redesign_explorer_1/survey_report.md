# Comprehensive Survey Report: Requirement R1 (internize.ai Redesign)

**Author:** Survey Explorer 1  
**Timestamp:** 2026-09-27T10:45:00Z  
**Scope:** Requirement R1 (Deterministic CROGE Primary Engine, OpenMed-Aligned PII Scrubbing, Deterministic SNOMED CT/RxNorm Entity Extraction, and Optional Neural SLM Co-Pilot Toggle)  
**Integrity Mode:** Strictly Read-Only Investigation  

---

## 1. Executive Summary

This survey analyzes the current codebase of `internize.ai` against **Requirement R1**:
1. **Default Execution Path**: Must be 100% deterministic CROGE running locally in <15ms without invoking neural model pipelines or downloading weights.
2. **OpenMed-Aligned PII De-identification**: Must execute prior to downstream analysis layers (entity extraction, clinical categorization, and any SLM pass), with deterministic mapping of diseases and medications to SNOMED CT and RxNorm.
3. **Explicit User Toggle**: Must provide `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` (default: **OFF / Unloaded**) with informative tooltip: `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."`.
4. **Targeted SLM Invocation**: Only when explicitly toggled ON may the system invoke `generateDirectedClinicalAnalysis`, injected with CROGE-verified facts.

### Key Discoveries & Critical Findings
1. **Eager Weight Download Violation**: In `src/features/clinical/ClinicalServiceTab.tsx` (line 124), `enableNeural` is currently initialized to `true` by default. An eager `useEffect` immediately fires `ClinicalEngineCoordinator.prewarmSlmEngine()` upon component mount, triggering background download of the ~500MB Qwen/SmolLM ONNX model from HuggingFace Hub without explicit user action.
2. **Missing PII Scrubbing in Clinical Flow**: While `src/services/deid/deidentifier.ts` implements HIPAA Safe Harbor rules, it is currently isolated exclusively to `ResearchExtractionTab.tsx`. Neither `croge.ts`, `engine.ts`, nor `internalMedicineEngine.ts` de-identify clinical text before extracting entities, calculating scores, or passing prompts to neural models.
3. **Disconnected Directed Analysis**: `generateDirectedClinicalAnalysis` is already fully implemented in `src/services/clinical/slmEngine.ts` with Sp.PD safety guards (CSF glucose vs. blood glucose disambiguation, zero false DM). However, the inference coordinator (`src/services/clinical/engine.ts`) never calls it; instead, it calls an ungrounded `generateNeuralSoap()`.
4. **Latency Verification**: CROGE benchmarks demonstrate that deterministic execution latency averages **1.16 ms** (median 1.16 ms, p95 1.39 ms, max 2.99 ms), well below the **< 15 ms** ceiling.
5. **Latent Stateful Regex Defect**: In `src/services/clinical/rxnormDictionary.ts`, `FREQUENCY_REGEX` and `ROUTE_REGEX` are declared with the global flag `/g` but their `lastIndex` is not reset in `lookupRxNormConcepts`. This causes alternating `undefined` values on repeated calls with identical text, violating strict determinism.

---

## 2. File-by-File Codebase Audit (R1 Scope)

### 2.1. `src/services/clinical/croge.ts`
- **Role**: Clinical Rules & Ontology Grounding Engine. Synchronous, deterministic entity extraction, NegEx negation detection, SNOMED CT & RxNorm ontology resolution, and SOAP note synthesis.
- **Observed Behavior**:
  - `analyze(text)`: Runs `extractSnomed()`, `extractRxNorm()`, and `synthesizeSoapNote()`.
  - Latency: Completes in 1–3 ms on standard discharge summaries.
  - Returns `ClinicalAnalysisResult` with `diagnoses`, `medications`, `soapNote`, and `executionTimeMs`.
- **Gaps & Defects**:
  - Does **not** invoke PII de-identification prior to running extraction.
  - Hardcodes `inferenceDevice: 'webgpu'` on line 225, even though CROGE is pure JavaScript/TypeScript CPU rule logic.

### 2.2. `src/services/clinical/engine.ts`
- **Role**: Multi-Tiered Clinical AI Inference Coordinator. Manages Tier 1 (CROGE) and Tier 2 (SLM).
- **Observed Behavior**:
  - `analyze(text, options)`: Always runs `CrogeEngine.analyze(text)`.
  - If `options.enableNeural` is true and device is `'webgpu'` or `'wasm'`, calls `generateNeuralSoap(text, options.onSlmProgress)`.
  - Merges ontology codes from CROGE into the generated SOAP note (`_buildNeuralSoapNote`).
- **Gaps & Defects**:
  - Does **not** scrub PII before calling either CROGE or SLM.
  - When neural mode is active, it calls generic `generateNeuralSoap(text)` instead of `generateDirectedClinicalAnalysis()`. It fails to extract or pass CROGE-verified facts (vitals, verified labs, active Sp.PD problems).

### 2.3. `src/services/clinical/slmEngine.ts`
- **Role**: Tier 2 Small Language Model Pipeline using `@huggingface/transformers` v3.
- **Observed Behavior**:
  - Singleton model state: `_modelStatus: SlmModelStatus` (`'unloaded' | 'loading' | 'ready' | 'error'`), defaults to `'unloaded'`.
  - Hardware fallback: WebGPU with `onnx-community/Qwen2.5-0.5B-Instruct` (q4) -> WASM with `onnx-community/SmolLM2-135M-Instruct` (q8).
  - Implements `generateDirectedClinicalAnalysis(input: DirectedClinicalPromptInput)` (lines 479–567) with:
    - Injected facts: `vitals`, `verifiedLabs`, `verifiedProblems`, `rawText`.
    - Strict Sp.PD safety prompts: CSF glucose vs. blood glucose disambiguation, no phantom DM without high blood glucose, prioritizing severe hypokalemia, sepsis, thrombocytopenia.
    - Deterministic fallback: `_fallbackDirectedAnalysis()` if offline or error occurs.
- **Gaps & Defects**:
  - Calling `generateDirectedClinicalAnalysis()` when unloaded immediately triggers `loadSlmEngine()`. In testing or server environments without browser cache, it throws an error (handled via fallback, but noisy in logs).

### 2.4. `src/services/clinical/snomedDictionary.ts`
- **Role**: 200+ curated SNOMED CT clinical concepts with Indonesian clinical synonyms, categorized into 5 hierarchies (`Disorder`, `Finding`, `Procedure`, `BodyStructure`, `Substance`).
- **Observed Behavior**:
  - Longest-match synonym priority (`items.sort((a, b) => b.synonym.length - a.synonym.length)`).
  - NegEx integration via `isNegatedSpan` callback.
  - Fully deterministic, sub-millisecond execution.
- **Gaps & Defects**:
  - No defects identified.

### 2.5. `src/services/clinical/rxnormDictionary.ts`
- **Role**: RxNorm clinical drug lexicon with brand names, generic ingredients, and SCD (Semantic Clinical Drug) strength mappings. Sig regexes for dosage, route, and frequency.
- **Observed Behavior**:
  - Supports primary care and Sp.PD medications (Lisinopril, Metformin, Amlodipine, Candesartan, etc.).
- **Gaps & Defects**:
  - **CRITICAL LATENT BUG**:
    - Lines 781–786: `DOSAGE_REGEX`, `FREQUENCY_REGEX`, and `ROUTE_REGEX` are declared with `/gi` flags:
      ```typescript
      export const FREQUENCY_REGEX = /\b(once daily|twice daily|...|daily|...)\b/gi;
      export const ROUTE_REGEX = /\b(oral|po|...)\b/gi;
      ```
    - In `lookupRxNormConcepts` (lines 854 and 861):
      ```typescript
      const freqMatch = FREQUENCY_REGEX.exec(fullContextWindow);
      // MISSING: FREQUENCY_REGEX.lastIndex = 0;
      const routeMatch = ROUTE_REGEX.exec(fullContextWindow);
      // MISSING: ROUTE_REGEX.lastIndex = 0;
      ```
    - Because `lastIndex` is preserved across calls, alternating executions on identical text fail to match frequency, returning `frequency: undefined` on the 2nd execution. This caused the empirical determinism test to fail in `tests/m2_challenger_empirical.ts`.

### 2.6. `src/services/clinical/internalMedicineEngine.ts`
- **Role**: Deterministic expert engine for Dokter Spesialis Penyakit Dalam (Sp.PD) covering all 11 PAPDI divisions.
- **Observed Behavior**:
  - Vital sign parser: Indonesian abbreviations (`T:`/`TD:` as Blood Pressure, `N:`/`HR:`, `R:`/`RR:`, `S:`/`Suhu:`).
  - Lab collision prevention: `Vitamin K` vs `Kalium`, `CR: 2 detik` vs `Kreatinin`.
  - Serial lab trends & multi-dot thousand number parsing (`1.050.000 /uL`).
  - Active problem identification (`identifySpPdProblems`), consultation answers (`generateConsultationAnswer`), POMR notes (`generatePomrNote`), and case summaries (`generateCaseSummary`).
- **Gaps & Defects**:
  - Does not receive or produce PII-scrubbed text; all methods run directly on raw user input.

### 2.7. `src/services/deid/deidentifier.ts` & `hipaaChecker.ts`
- **Role**: HIPAA Safe Harbor 18-category de-identification engine and compliance auditor.
- **Observed Behavior**:
  - Regex replacement for `[NAME]`, `[ADDRESS]`, `[ZIP]`, `[DATE]`, `[PHONE]`, `[FAX]`, `[EMAIL]`, `[SSN]`, `[MRN]`, `[HEALTH_PLAN_ID]`, `[ACCOUNT_NUMBER]`, `[LICENSE_NUMBER]`, `[VEHICLE_ID]`, `[DEVICE_ID]`, `[URL]`, `[IP_ADDRESS]`, `[BIOMETRIC]`, `[IMAGE_REF]`, `[AGE_OVER_89]`.
  - Only imported in `src/features/research/ResearchExtractionTab.tsx`.
- **Gaps & Defects**:
  - Completely detached from the clinical workflow tab and clinical engines.
  - Western-centric regexes:
    - Names: only matches Western Title Case (`First [Middle] Last`); misses Indonesian prefixes (`Tn.`, `Ny.`, `An.`, `Sdr.`) and common single-word or non-standard Indonesian names.
    - MRN: matches `MRN:` or `MR#`; misses Indonesian hospital shorthand: `No. RM:`, `No RM:`, `Nomor Rekam Medis:`.
    - Health Plan ID: misses Indonesian NIK (16 digits) and BPJS Kesehatan numbers (`No. BPJS: 000...`).
    - Dates: only matches English month names (`Jan`, `Feb`, `Mar`...); misses Indonesian month names (`Januari`, `Maret`, `Mei`, `Agustus`, `Desember`, etc.).

### 2.8. `src/features/clinical/ClinicalServiceTab.tsx`
- **Role**: Primary UI tab for clinical note analysis and Sp.PD workflow.
- **Observed Behavior**:
  - Lines 124–126:
    ```typescript
    const [enableNeural, setEnableNeural] = useState<boolean>(true); // <-- BUG: Defaults to ON!
    ```
  - Lines 159–169:
    ```typescript
    useEffect(() => {
      if (!enableNeural) return;
      if (getSlmStatus() === 'unloaded') {
        ClinicalEngineCoordinator.prewarmSlmEngine((evt) => { ... });
      }
    }, [enableNeural]);
    ```
    Triggers network weight downloads on initial mount.
  - Lines 617–651: Toggle switch labeled `Neural SLM (Small Language Model)` located deep inside "Pengaturan Inferensi Lanjutan" (Advanced Settings).
- **Gaps & Defects**:
  - Toggle is ON by default.
  - Tooltip is generic (`title={enableNeural ? 'Nonaktifkan Neural SLM' : 'Aktifkan Neural SLM'}`) rather than the exact required copy.
  - Label does not match `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"`.

---

## 3. Detailed Gap Analysis Against Requirement R1

| Requirement Item | Required Specification | Current State in Codebase | Compliance Gap |
|---|---|---|---|
| **Default Execution Path** | 100% deterministic CROGE in <15ms locally; zero neural pipeline invocation; zero model weight downloading. | `enableNeural` defaults to `true`. Eager `useEffect` starts downloading model weights on mount. | **FAIL (Critical)**: Must default to `false` (OFF/Unloaded). SLM pre-warm must only execute on explicit toggle click. |
| **CROGE Latency** | Execution in <15ms in automated benchmarks. | Empirical benchmark shows avg: 1.17ms, median: 1.16ms, max: 2.99ms across 100 runs. | **PASS**: Performance easily satisfies the <15ms requirement. |
| **PII Scrubbing** | OpenMed-aligned PII scrubbing/de-identification prior to downstream analysis layers. | `deidentifier.ts` exists but is only used in research tab. Clinical pipeline receives raw PHI. | **FAIL (Critical)**: De-identification must be integrated before CROGE and SLM layers. |
| **Ontology Mapping** | Deterministic extraction of clinical entities mapped to SNOMED CT and RxNorm. | `snomedDictionary.ts` and `rxnormDictionary.ts` provide local deterministic mapping. | **PARTIAL**: Mapping works, but `rxnormDictionary.ts` has a stateful regex bug causing intermittent frequency drops. |
| **User Toggle Label & State** | `"⚡ Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)"` (default: OFF / Unloaded). | Labeled `"Neural SLM (Small Language Model)"` and default is ON (`true`). | **FAIL (UI)**: Label and default boolean state must be updated. |
| **User Toggle Tooltip** | `"Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."` | Generic title: `"Nonaktifkan Neural SLM"` / `"Aktifkan Neural SLM"`. | **FAIL (UI)**: Tooltip must match required clinical wording. |
| **Targeted SLM Invocation** | Only when toggled ON: invoke `generateDirectedClinicalAnalysis` injected with CROGE-verified facts. | Coordinator invokes ungrounded `generateNeuralSoap()`. `generateDirectedClinicalAnalysis()` is not called by coordinator. | **FAIL (Architecture)**: Coordinator must assemble CROGE verified facts (`vitals`, `verifiedLabs`, `verifiedProblems`) and pass them to `generateDirectedClinicalAnalysis`. |

---

## 4. Latent Defects & Edge Cases Discovered

### Defect 1: Stateful Regexes in `rxnormDictionary.ts`
- **Location**: `src/services/clinical/rxnormDictionary.ts:781–786` & `854, 861`
- **Symptom**: `FREQUENCY_REGEX` and `ROUTE_REGEX` use `/gi`. In `lookupRxNormConcepts`, `FREQUENCY_REGEX.exec()` advances `lastIndex`. Without resetting `lastIndex = 0`, subsequent calls fail to extract the frequency if the match occurs earlier in the string than the previous `lastIndex`.
- **Impact**: Breaks determinism in automated regression tests (`tests/m2_challenger_empirical.ts`).
- **Required Fix**:
  ```typescript
  FREQUENCY_REGEX.lastIndex = 0;
  const freqMatch = FREQUENCY_REGEX.exec(fullContextWindow);
  ROUTE_REGEX.lastIndex = 0;
  const routeMatch = ROUTE_REGEX.exec(fullContextWindow);
  ```

### Defect 2: Missing Indonesian Clinical Identifiers in `deidentifier.ts`
- **Location**: `src/services/deid/deidentifier.ts:20–154`
- **Symptom**:
  - Indonesian MRN patterns like `No. RM: 12-34-56` or `No RM: 123456` are missed.
  - Indonesian NIK (16-digit national ID) and BPJS Kesehatan numbers are unredacted.
  - Indonesian honorifics (`Tn. [Nama]`, `Ny. [Nama]`, `An. [Nama]`) are not caught by Western `First Last` regex.
  - Indonesian date formats (`25 September 2026`, `25/09/26`) with Indonesian month names are missed.
- **Required Alignment**: Extend `SAFE_HARBOR_PATTERNS` to cover Indonesian clinical record formatting while preventing collision with clinical markers (e.g., `K: 1.87`, `TD: 120/80`).

### Defect 3: Static `inferenceDevice: 'webgpu'` in Pure Rule CROGE
- **Location**: `src/services/clinical/croge.ts:225`
- **Symptom**: `analyze()` returns `inferenceDevice: 'webgpu'`, misleading consumers into believing WebGPU was engaged when it ran on pure CPU rules.
- **Required Fix**: Return `'cpu'` or the actually detected hardware runtime.

---

## 5. Architectural Redesign Blueprint for R1

### 5.1. Execution Flow Diagram

```
[Raw Clinical Note Input (Indonesian / Western)]
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  Phase 1: OpenMed-Aligned On-Device PII De-Identification│
│  - Redacts: Name (Tn/Ny), No. RM, NIK/BPJS, Phone,     │
│    Address, Dates, Biometrics, Images (Safe Harbor 18)  │
│  - Output: scrubbedText + piiEntities                  │
└────────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────┐
│  Phase 2: Deterministic CROGE & Sp.PD Knowledge Engine  │
│  (Synchronous, Local CPU, <15ms Execution)             │
│  - NegEx Negation Detection                            │
│  - SNOMED CT Extraction (200+ concepts)                │
│  - RxNorm Medication & Sig Extraction                  │
│  - Vitals Extraction (TD, HR, RR, Suhu, SpO2)          │
│  - Lab Trends & Critical Values (K, PLT, LCS Glucose)  │
│  - 11 PAPDI Division Categorization & POMR Synthesis   │
└────────────────────────────────────────────────────────┘
                   │
                   ├────────────────────────┐
     [SLM Toggle == OFF (Default)]          │ [SLM Toggle == ON (Explicit User Opt-in)]
                   │                        │
                   ▼                        ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────────────┐
│  Phase 3A: Pure CROGE Fast Delivery  │  │  Phase 3B: Directed Neural Co-Pilot Pass    │
│  - Returns in 1–3 ms                 │  │  - Ensures WebGPU / WASM pipeline ready     │
│  - Zero network calls / 0 MB download│  │  - Injects CROGE-Verified Facts:            │
│  - Full POMR, Consult, & Drug Safety │  │    * vitals                                 │
│    derived deterministically         │  │    * verifiedLabs                           │
│                                      │  │    * verifiedProblems                       │
│                                      │  │  - Invokes generateDirectedClinicalAnalysis │
│                                      │  │  - Enforces CSF glucose & anti-phantom DM   │
│                                      │  │  - Merges second-opinion impression/plan    │
└──────────────────────────────────────┘  └──────────────────────────────────────────────┘
```

### 5.2. Recommended Coordinator Interface (`src/services/clinical/engine.ts`)

```typescript
export interface ClinicalEngineOptions {
  /** Explicit user toggle for Tier 2 SLM co-pilot (Default: FALSE) */
  enableNeural?: boolean;
  /** Skip PII de-identification pass (Default: false, PII scrubbing is ALWAYS active) */
  skipDeid?: boolean;
  /** Preferred inference backend */
  preferredDevice?: InferenceDevice;
  /** Progress callback during SLM load */
  onSlmProgress?: SlmProgressCallback;
}

export interface EnhancedClinicalAnalysisResult extends ClinicalAnalysisResult {
  deidentifiedText: string;
  piiEntities: DeidEntity[];
  directedAnalysis?: DirectedClinicalAnalysisOutput;
}
```

### 5.3. Recommended UI Toggle Component in `ClinicalServiceTab.tsx`

```tsx
{/* ⚡ Neural SLM Co-Pilot Toggle */}
<div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
  <div className="space-y-0.5">
    <div className="flex items-center gap-1.5">
      <span className="text-amber-500 font-bold text-xs">⚡</span>
      <span className="font-semibold text-slate-800 text-xs">
        Neural SLM Co-Pilot (Opsional - Perlu Akses WebGPU/WASM)
      </span>
      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
        enableNeural ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
      }`}>
        {enableNeural ? (slmProgress?.status === 'loading' ? 'Memuat Model...' : 'Aktif') : 'OFF / Unloaded'}
      </span>
    </div>
    <p className="text-[11px] text-slate-500 leading-snug">
      Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik.
    </p>
  </div>

  <button
    type="button"
    role="switch"
    aria-checked={enableNeural}
    onClick={handleToggleNeural}
    className="shrink-0 flex items-center focus:outline-none"
    title="Gunakan bila kasus sangat kompleks, multi-patologi tumpang tindih, atau membutuhkan second-opinion penalaran diagnostik."
  >
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
        enableNeural ? 'bg-maroon-800' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ml-[3px] ${
          enableNeural ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  </button>
</div>
```

---

## 6. Verification and Acceptance Checklist for R1

- [x] **CROGE Latency Verification**: Benchmarked via `tests/m2_challenger_empirical.ts` (1.16 ms average, max 2.99 ms). Confirmed < 15ms ceiling.
- [ ] **Default Neural State Verification**: In `ClinicalServiceTab.tsx`, verify `enableNeural` default is initialized to `false` and that zero network requests to Hugging Face Hub are dispatched when loading the extension sidepanel.
- [ ] **PII Scrubbing Verification**: Write a unit test ensuring that clinical notes containing `Tn. Budi Santoso, No RM: 45-88-21, NIK: 3201..., T: 130/80` have PHI redacted before entity extraction and problem list synthesis.
- [ ] **SLM Injection Verification**: When `enableNeural: true` is tested, verify that `generateDirectedClinicalAnalysis` receives `input.verifiedLabs` and `input.verifiedProblems` derived from CROGE, and that its output is returned to the caller.
- [ ] **Deterministic Sig Parsing Verification**: Fix `lastIndex = 0` in `rxnormDictionary.ts` and verify that `tests/m2_challenger_empirical.ts` passes the determinism check 100%.
- [ ] **Build & Test Cleanliness**: Ensure `npm test` and `npm run build` pass with exit code 0.
