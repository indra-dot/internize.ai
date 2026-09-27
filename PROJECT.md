# Project: internize.ai

## Architecture
internize.ai is a production-grade Chrome Extension (Manifest V3) side panel application for clinical and research workflows. It executes 100% on-device local AI inference (Transformers.js with WebGPU and WASM fallback) and deterministic OpenMed clinical rules to guarantee zero PHI egress and instant response times.

### High-Level Components & Data Flow:
1. **Background Service Worker (`src/background/index.ts`)**:
   - Manages extension lifecycle and side panel activation (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`).
   - Routes selection messages between content scripts and the active side panel.
2. **Content Script (`src/content/index.ts`)**:
   - Injected on user-active tabs (using `activeTab` / `scripting`, zero `<all_urls>` permission).
   - Monitors user text highlights (`selectionchange` / `mouseup` with 150ms debounce) and pushes to side panel via `chrome.runtime.sendMessage`.
   - Answers `GET_SELECTED_TEXT` pull queries on side panel mount.
3. **Side Panel Shell (`src/sidepanel/index.tsx`)**:
   - React 18 + Tailwind CSS responsive UI container designed for 380px–480px width.
   - Houses Tab Navigation (`Clinical Service` vs `Research & Extraction`), System Status strip (WebGPU/WASM badge, Privacy 100% Local indicator), and global Toast notifications.
4. **Clinical Service Engine (`src/services/clinical/`)**:
   - Dual-engine architecture:
     * Tier 1 (CROGE): Synchronous, deterministic Clinical Rules & Ontology Grounding Engine (<5ms response) with curated SNOMED CT and RxNorm index, negation detection, and span citations.
     * Tier 2 (Transformers.js): Asynchronous WebGPU neural token classifier (`@huggingface/transformers`) offloaded to Web Worker.
   - Generates structured SOAP notes (Subjective, Objective, Assessment, Plan) with source span citations.
5. **Research & Extraction Engine (`src/services/research/`)**:
   - `src/services/deid/`: 18-category HIPAA Safe Harbor de-identification engine and compliance audit reporting (`compliant: boolean`, `safeHarborMet: boolean`, `residualRisk`).
   - `src/services/loinc/`: Biomarker extraction engine mapping text patterns to LOINC codes (`2571-8` triglycerides, `2345-7` glucose, `2986-8` testosterone) with UCUM units and abnormal flag derivation (`high`, `normal`, `low`).
   - `src/services/fhir/`: HL7 FHIR R4 Transaction Bundle assembler (`resourceType: "Bundle"`, `type: "transaction"`, `urn:uuid` identifiers, in-bundle reference rewriting).
   - `src/services/supabase/`: Supabase client integration for cloud sync, persisted in `chrome.storage.sync`.
   - Client-side JSON file download without requiring `downloads` permission.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | MV3 Extension Manifest | Valid Manifest V3 configuration with minimum permissions (`sidePanel`, `storage`, `activeTab`, `scripting`), zero `<all_urls>`. | M1 | Survey 1 (R1) |
| 2 | Single-Click Side Panel Activation | Clicking extension action icon opens side panel without popup window. | M1 | Survey 1 (R1) |
| 3 | Highlight Text Capture & Auto-Populate | Content script captures highlighted text and auto-populates clinical text area in <2s via push/pull. | M1 | Survey 1 (R1) |
| 4 | Build & Lint Pipeline | Vite 5 + @crxjs/vite-plugin + TypeScript strict mode + Tailwind CSS + Biome/ESLint compiling cleanly to `dist/`. | M1 | Survey 1 (R1, R4) |
| 5 | Side Panel UI Shell & Navigation | Accessible tabbed side panel layout supporting Clinical Service and Research & Extraction tabs with status bar. | M1 | Survey 1 (R1) |
| 6 | On-Device AI Engine (WebGPU/WASM) | Transformers.js v3 pipeline running in side panel/worker with WASM fallback and CSP compliance (`wasm-unsafe-eval`). | M2 | Survey 2 (R2) |
| 7 | Structured SOAP Note Generation | Formats clinical narrative into Subjective, Objective, Assessment, and Plan sections with input span citations. | M2 | Survey 2 (R2) |
| 8 | SNOMED CT Diagnosis Mapping | Extracts conditions and maps to SNOMED CT SCTIDs (e.g., "hypertension" -> `38341003`). | M2 | Survey 2 (R2) |
| 9 | RxNorm Medication Reconciliation | Extracts medications and maps to RxNorm RxCUIs (e.g., "lisinopril" -> `29046` / `314076`). | M2 | Survey 2 (R2) |
| 10 | Clinical Service Tab UI | Input text area, sample loader, interactive SOAP note viewer, SNOMED & RxNorm concept tables, copy actions. | M2 | Survey 2 (R2) |
| 11 | HIPAA PHI De-identification Engine | Redacts 18 HIPAA Safe Harbor categories (names, DOBs, MRNs, etc.) replacing with semantic tokens. | M3 | Survey 3 (R3) |
| 12 | HIPAA Compliance Status & Audit | Evaluates residual risk and returns structured compliance status (`compliant: true/false`, safeHarborMet). | M3 | Survey 3 (R3) |
| 13 | LOINC Lab Biomarker Extraction | Extracts Triglycerides (`2571-8`), Glucose (`2345-7`), Testosterone (`2986-8`) with values, units, and abnormal flags. | M3 | Survey 3 (R3) |
| 14 | FHIR R4 Transaction Bundle Assembly | Assembles valid transaction Bundle (`resourceType: "Bundle"`, `type: "transaction"`) with Patient & Observations. | M3 | Survey 3 (R3) |
| 15 | Bundle JSON Local Download | Triggers browser download of the assembled FHIR Bundle JSON file without external permissions. | M3 | Survey 3 (R3) |
| 16 | Supabase Integration & Settings | Settings panel backed by `chrome.storage.sync` for Supabase URL/key, connection test, and push upsert with feedback. | M3 | Survey 3 (R3) |
| 17 | Research & Extraction Tab UI | Raw text area, de-identified preview with token badges, HIPAA badge, LOINC table, JSON viewer, export buttons. | M3 | Survey 3 (R3) |
| 18 | Production Build & Documentation | Clean `npm run build` with zero TS errors, comprehensive README with setup, dev, and feature overview. | M4 | Survey 1, 2, 3 (R4) |
| 19 | E2E Acceptance Test Pass | 100% pass on all acceptance test tiers (Tiers 1–4) verified by independent test runner. | M4 | Dual Track E2E |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Chrome Extension Shell MV3 & Tooling | Features 1, 2, 3, 4, 5: Manifest V3, Vite build, Content Script, Background Worker, Side Panel Shell, Tailwind CSS, Biome. | None | DONE |
| M2 | Clinical Service Tab & Local AI | Features 6, 7, 8, 9, 10: Local inference engine (CROGE + WebGPU), SOAP note generation, SNOMED & RxNorm mapping, Clinical UI. | M1 | IN_PROGRESS |
| M3 | Research & Extraction Tab & Cloud Sync | Features 11, 12, 13, 14, 15, 16, 17: HIPAA de-identification, LOINC extraction, FHIR R4 Bundle assembler, Supabase sync, Research UI. | M1 | PLANNED |
| M4 | Final Integration, Build & E2E Acceptance | Features 18, 19: Full build verification (`npm run build`), 100% E2E test suite pass (Tiers 1–4), Tier 5 adversarial hardening, README.md. | M1, M2, M3, E2E | PLANNED |

---

## Interface Contracts

### 1. Content Script ↔ Side Panel / Background (`src/types/messages.ts`)
```typescript
export type ExtensionMessage =
  | { type: 'TEXT_SELECTED'; text: string; sourceUrl?: string; timestamp: number }
  | { type: 'GET_SELECTED_TEXT' }
  | { type: 'SELECTED_TEXT_RESPONSE'; text: string }
  | { type: 'OPEN_SIDE_PANEL' };
```

### 2. Clinical Service Engine (`src/types/clinical.ts`)
```typescript
export interface ClinicalEntity {
  id: string;
  text: string;
  label: 'DISEASE' | 'DRUG' | 'SYMPTOM' | 'ANATOMY' | 'PROCEDURE';
  start: number;
  end: number;
  confidence: number;
}

export interface SnomedConcept {
  code: string;       // e.g. "38341003"
  display: string;    // e.g. "Hypertensive disorder, systemic arterial (disorder)"
  preferredTerm: string; // e.g. "Hypertension"
  matchedText: string;
  confidence: number;
}

export interface RxNormConcept {
  rxcui: string;      // e.g. "29046"
  name: string;       // e.g. "lisinopril"
  termType: 'IN' | 'SCD' | 'SBD';
  ttyDisplay: string;
  dosage?: string;    // e.g. "10mg"
  matchedText: string;
  confidence: number;
}

export interface SoapSection {
  title: 'Subjective' | 'Objective' | 'Assessment' | 'Plan';
  content: string[];
  citations?: Array<{ start: number; end: number; sourceText: string }>;
}

export interface SoapNote {
  subjective: SoapSection;
  objective: SoapSection;
  assessment: SoapSection;
  plan: SoapSection;
  generatedAt: string;
}

export interface ClinicalAnalysisResult {
  rawText: string;
  soapNote: SoapNote;
  diagnoses: SnomedConcept[];
  medications: RxNormConcept[];
  executionTimeMs: number;
  inferenceDevice: 'webgpu' | 'wasm' | 'cpu';
}
```

### 3. Research & Extraction Engine (`src/types/research.ts`)
```typescript
export interface DeidEntity {
  text: string;
  category: string; // 'NAME' | 'DATE' | 'MRN' | 'PHONE' | etc.
  replacement: string;
  start: number;
  end: number;
}

export interface HipaaComplianceResult {
  compliant: boolean;
  safeHarborMet: boolean;
  residualRisk: 'low' | 'moderate' | 'high';
  redactedCount: number;
  unredactedSuspects: number;
  timestamp: string;
}

export interface LoincLabRecord {
  testName: string;   // e.g. "Triglycerides"
  loincCode: string;  // e.g. "2571-8"
  value: number;      // e.g. 210
  unit: string;       // e.g. "mg/dL"
  referenceRange?: string; // e.g. "< 150 mg/dL"
  flag?: 'low' | 'normal' | 'high' | 'critical';
}

export interface FhirBundleExportResult {
  bundle: any;        // HL7 FHIR R4 Transaction Bundle JSON
  resourceCount: number;
  generatedAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName?: string; // defaults to 'fhir_bundles'
}
```

---

## Code Layout
```
internize.ai/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── biome.json (or .eslintrc.cjs)
├── manifest.json
├── sidepanel.html
├── src/
│   ├── background/
│   │   └── index.ts
│   ├── content/
│   │   └── index.ts
│   ├── sidepanel/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── index.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── TabNavigation.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Modal.tsx
│   ├── features/
│   │   ├── clinical/
│   │   │   ├── ClinicalServiceTab.tsx
│   │   │   ├── SoapNoteViewer.tsx
│   │   │   ├── SnomedTable.tsx
│   │   │   └── RxNormTable.tsx
│   │   ├── research/
│   │   │   ├── ResearchExtractionTab.tsx
│   │   │   ├── DeidentifiedPreview.tsx
│   │   │   ├── LoincTable.tsx
│   │   │   ├── FhirBundleViewer.tsx
│   │   │   └── SettingsDrawer.tsx
│   ├── services/
│   │   ├── clinical/
│   │   │   ├── engine.ts
│   │   │   ├── croge.ts
│   │   │   ├── snomedDictionary.ts
│   │   │   ├── rxnormDictionary.ts
│   │   │   └── soapSynthesizer.ts
│   │   ├── deid/
│   │   │   ├── deidentifier.ts
│   │   │   └── hipaaChecker.ts
│   │   ├── loinc/
│   │   │   ├── extractor.ts
│   │   │   └── loincDictionary.ts
│   │   ├── fhir/
│   │   │   └── assembler.ts
│   │   ├── supabase/
│   │   │   └── client.ts
│   │   └── storage/
│   │   │   └── chromeStorage.ts
│   ├── types/
│   │   ├── messages.ts
│   │   ├── clinical.ts
│   │   ├── research.ts
│   │   └── fhir.ts
├── tests/
│   ├── e2e/
│   │   ├── runner.ts
│   │   ├── tier1_features.test.ts
│   │   ├── tier2_boundaries.test.ts
│   │   ├── tier3_pairwise.test.ts
│   │   └── tier4_application.test.ts
│   └── unit/
└── README.md
```
