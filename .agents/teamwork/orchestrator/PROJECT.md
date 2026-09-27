# Project: internize.ai (Redesign)

## Architecture
internize.ai is a production-grade Chrome Extension (Manifest V3) for internal medicine (Sp.PD) clinical workflows and medical research. It operates on a strict zero-egress, 100% on-device architecture ensuring patient health information (PHI) never leaves the local browser environment.

### Core Processing Layers:
1. **OpenMed-Aligned PII Redaction Layer (`src/services/deid/`)**:
   - Executes deterministic scrubbing of 18 HIPAA Safe Harbor categories prior to entity extraction or clinical reasoning.
2. **Deterministic CROGE Primary Engine (`src/services/clinical/croge.ts`, `snomedDictionary.ts`, `rxnormDictionary.ts`)**:
   - Sub-15ms (<2ms observed) clinical rules and ontology grounding engine.
   - Grounded in 365+ curated SNOMED CT SCTIDs and RxNorm RxCUIs with negation detection and exact character span citations.
3. **On-Demand Neural SLM Co-Pilot (`src/services/clinical/slmEngine.ts`, `engine.ts`)**:
   - Explicit user toggle (default: OFF / Unloaded, 0MB downloaded on mount).
   - Injected with CROGE-verified facts (vitals, verified labs, active problems) via `generateDirectedClinicalAnalysis`.
4. **Binary Perioperative Urgency Engine (`src/services/clinical/internalMedicineEngine.ts`)**:
   - Binary urgency dichotomy: `SurgicalUrgencyType = 'elektif' | 'life_saving'`.
   - Strict contraindication screening for elective surgery (K, PLT, GDS, BP, sepsis, Hb) with CITO stabilization targets.
   - Unconditional parallel emergency support plan for life-saving CITO surgery (zero delay directives).
5. **Safety Guard & Pharmacovigilance Engine (`src/services/clinical/safetyGuardEngine.ts` / `internalMedicineEngine.ts`)**:
   - Automated Cockcroft-Gault & CKD-EPI eGFR / CrCl calculator from serum creatinine with nephrotoxic drug flags.
   - Hepatic impairment alert for AST/ALT > 3x ULN with hepatotoxic drug flags.
   - Critical arrhythmia alert for QTc-prolonging medications combined with hypokalemia (K < 3.5 mEq/L) or hypomagnesemia.
   - Hemostasis hazard alert for anticoagulants/antiplatelets with thrombocytopenia.
   - Serial lab trend snapshot.
6. **Three-Column Sp.PD Workflow UI (`src/features/clinical/SpPdWorkflowPanel.tsx`)**:
   - Column 1 (~38%): POMR CPPT Bangsal (DPJP header, S&O with lab trends, 4 pillars Pdx/Ptx/Pmx/Pex across 11 PAPDI divisions).
   - Column 2 (~34%): Lembar Jawaban Konsul TS (binary urgency switch, 4-tier tolerance status banner, pre/intra/post-op advis).
   - Column 3 (~28%): Drug-Drug Interaction, Renal/Hepatic Safety Guard, QTc Hazard, and Serial Lab Trend Snapshot.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Deterministic CROGE Primary Engine | Sub-15ms local clinical rule & ontology grounding engine (<3ms observed) | M1 | ORIGINAL_REQUEST R1 |
| 2 | OpenMed-Aligned PII Scrubbing | Pre-extraction de-identification of PHI prior to CROGE / SLM layers | M1 | ORIGINAL_REQUEST R1 |
| 3 | Curated SNOMED CT & RxNorm Grounding | Deterministic diagnosis & medication mapping with stateful regex bug fix | M1 | ORIGINAL_REQUEST R1 |
| 4 | On-Demand Neural SLM Co-Pilot Toggle | Default OFF/unloaded toggle with exact label, tooltip, and zero eager downloads | M1 | ORIGINAL_REQUEST R1 |
| 5 | CROGE-Directed Neural Analysis | Wires `ClinicalEngineCoordinator` to inject CROGE facts into `generateDirectedClinicalAnalysis` when toggled ON | M1 | ORIGINAL_REQUEST R1 |
| 6 | Binary Urgency Type Dichotomy | `export type SurgicalUrgencyType = 'elektif' \| 'life_saving'` deprecating legacy presets | M2 | ORIGINAL_REQUEST R2 |
| 7 | Elective Contraindication Screening | Strict screening of K (<2.5 or >=6.0), PLT (<100k/<50k), GDS (>=350/DKA), BP (>=180/110), sepsis, Hb (<7.5) -> "TUNDA OPERASI ELEKTIF" | M2 | ORIGINAL_REQUEST R2 |
| 8 | Pre-Op CITO Stabilization Goals | Actionable hemodynamic & electrolyte targets for elective patients | M2 | ORIGINAL_REQUEST R2 |
| 9 | Life-Saving Parallel Support Plan | Status "PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL" with Pre/Intra/Post-Op parallel resuscitation | M2 | ORIGINAL_REQUEST R2 |
| 10 | 3-Column Sp.PD Responsive Layout | `grid grid-cols-1 lg:grid-cols-[38fr_34fr_28fr]` rendering Col 1, Col 2, and Col 3 simultaneously on desktop | M3 | ORIGINAL_REQUEST R3 |
| 11 | Column 1: POMR CPPT Bangsal | Official Sp.PD CPPT header (timestamp & DPJP), S&O with lab trends, 4 pillars (Pdx/Ptx/Pmx/Pex) across 11 PAPDI divisions | M3 | ORIGINAL_REQUEST R3 |
| 12 | Column 2: Lembar Jawaban Konsul TS | Segmented binary switch, 4-tier status banner (green, yellow, red, orange-red), structured advis | M3 | ORIGINAL_REQUEST R3 |
| 13 | Column 3: Renal Safety Monitor | Automated eGFR / CrCl estimation from creatinine with nephrotoxic drug flags | M3 | ORIGINAL_REQUEST R3 |
| 14 | Column 3: Hepatic Impairment Alert | AST/ALT > 3x ULN warning with hepatotoxic drug flags | M3 | ORIGINAL_REQUEST R3 |
| 15 | Column 3: QTc & Hemostasis Hazard Alerts | Lethal arrhythmia alert (QTc drug + K < 3.5 / Mg) and hemostasis hazard alert (anticoagulant + thrombocytopenia) | M3 | ORIGINAL_REQUEST R3 |
| 16 | Column 3: Serial Lab Trend Snapshot | Multi-date trend summary table for K, PLT, LCS Glucose, etc. | M3 | ORIGINAL_REQUEST R3 |
| 17 | Zero-Egress & Branding Invariants | 100% local in-browser execution with Deep Maroon (`#4A151B`) and Warm Gold (`#CDA258`) visual theme | M3 | ORIGINAL_REQUEST R4 |
| 18 | Dual Track E2E & Unit Test Verification | 100% pass across all E2E test tiers and Sp.PD unit test suites | M4 | ORIGINAL_REQUEST AC |
| 19 | Production Build Cleanliness | `npm run build` succeeds cleanly with zero TypeScript errors | M4 | ORIGINAL_REQUEST AC |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | CROGE Engine, OpenMed PII & SLM Toggle | Features 1, 2, 3, 4, 5 (R1) | None | PLANNED |
| M2 | Binary Perioperative Urgency Redesign | Features 6, 7, 8, 9 (R2) | None (can run in parallel with M1 or sequentially) | PLANNED |
| M3 | Three-Column Sp.PD Workflow UI & Safety Guard | Features 10, 11, 12, 13, 14, 15, 16, 17 (R3, R4) | M1, M2 | PLANNED |
| M4 | Final Integration, Test Verification & Hardening | Features 18, 19: All unit & E2E tests pass, build clean, Tier 5 hardening | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### 1. Surgical Urgency Types (`src/types/clinical.ts`)
```typescript
export type SurgicalUrgencyType = 'elektif' | 'life_saving';

export type OperativeToleranceStatus =
  | 'LAIK OPERASI'
  | 'LAIK OPERASI DENGAN CATATAN'
  | 'TUNDA OPERASI ELEKTIF'
  | 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL'
  | 'TUNDA OPERASI'; // Backward-compatible alias
```

### 2. Clinical Analysis Result & Options (`src/types/clinical.ts`)
```typescript
export interface AnalyzeOptions {
  enableNeural?: boolean;
  onSlmProgress?: (evt: any) => void;
  urgency?: SurgicalUrgencyType;
}

export interface ClinicalAnalysisResult {
  rawText: string;
  deidentifiedText: string;
  soapNote: SoapNote;
  diagnoses: SnomedConcept[];
  medications: RxNormConcept[];
  executionTimeMs: number;
  inferenceDevice: InferenceDevice;
  neuralMode?: boolean;
  slmDevice?: 'webgpu' | 'wasm';
}
```

### 3. Safety Guardrails Result (`src/types/safety.ts` or `clinical.ts`)
```typescript
export interface RenalSafetyResult {
  eGfrCkdEpi?: number;
  crClCockcroftGault?: number;
  stage: string;
  contraindicatedDrugs: Array<{ drug: string; reason: string }>;
  doseAdjustmentNeeded: Array<{ drug: string; recommendation: string }>;
}

export interface HepaticSafetyResult {
  isImpaired: boolean;
  astAltMaxUlnRatio: number;
  flaggedDrugs: Array<{ drug: string; reason: string }>;
}

export interface QtcHazardResult {
  hasHazard: boolean;
  qtcDrugs: string[];
  kaliumValue?: number;
  magnesiumValue?: number;
  message: string;
}

export interface HemostasisHazardResult {
  hasHazard: boolean;
  antithromboticDrugs: string[];
  pltValue?: number;
  isNeurosurgery: boolean;
  message: string;
}

export interface SafetyGuardrailSnapshot {
  renal: RenalSafetyResult;
  hepatic: HepaticSafetyResult;
  qtc: QtcHazardResult;
  hemostasis: HemostasisHazardResult;
  serialTrends: Array<{ date: string; marker: string; value: string; flag?: string }>;
}
```

---

## Code Layout Ownership
- **Milestone 1**:
  * `src/services/clinical/engine.ts`
  * `src/services/clinical/croge.ts`
  * `src/services/clinical/rxnormDictionary.ts`
  * `src/features/clinical/ClinicalServiceTab.tsx`
  * `tests/unit/clinical.test.ts`
- **Milestone 2**:
  * `src/types/clinical.ts`
  * `src/services/clinical/internalMedicineEngine.ts`
  * `tests/unit/internal_medicine.test.ts`
- **Milestone 3**:
  * `src/features/clinical/SpPdWorkflowPanel.tsx`
  * `src/services/clinical/safetyGuardEngine.ts` (new safety calculations module)
  * `src/types/clinical.ts`
  * UI styling and layout in `SpPdWorkflowPanel.tsx`
- **Milestone 4 (Final E2E & Hardening)**:
  * `tests/e2e/*`
  * `tests/unit/*`
  * `package.json`
  * `TEST_READY.md`
