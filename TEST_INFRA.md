# E2E Test Infra: internize.ai

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user-facing acceptance criteria, independent of implementation design.
- Methodology: 4-Tier Test Pyramid (Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, Real-World Workloads).
- Execution: Runnable test suite via Vitest (`npm test`, `npm run test:unit`, `npm run test:e2e`) verifying builds, manifests, outputs, and schemas.

## Feature Inventory Coverage Matrix
| # | Feature | Requirement | Tier 1 (Count) | Tier 2 (Count) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|-------------|:--------------:|:--------------:|:-----------------:|:-----------------:|
| 1 | MV3 Extension Manifest | R1, AC: Extension Installs | 5 | 5 | ✓ | ✓ |
| 2 | Single-Click Side Panel Activation | R1, AC: Extension Installs | 5 | 5 | ✓ | ✓ |
| 3 | Highlight Text Capture & Auto-Populate | R1, AC: Clinical Service | 5 | 5 | ✓ | ✓ |
| 4 | Build & Lint Pipeline | R1, R4, AC: Build Quality | 5 | 5 | ✓ | ✓ |
| 5 | Side Panel UI Shell & Navigation | R1, AC: Extension Installs | 5 | 5 | ✓ | ✓ |
| 6 | On-Device AI Engine (WebGPU/WASM) | R2, AC: Security & Privacy | 5 | 5 | ✓ | ✓ |
| 7 | Structured SOAP Note Generation | R2, AC: Clinical Service | 5 | 5 | ✓ | ✓ |
| 8 | SNOMED CT Diagnosis Mapping | R2, AC: Clinical Service | 5 | 5 | ✓ | ✓ |
| 9 | RxNorm Medication Reconciliation | R2, AC: Clinical Service | 5 | 5 | ✓ | ✓ |
| 10 | Clinical Service Tab UI | R2, AC: Clinical Service | 5 | 5 | ✓ | ✓ |
| 11 | HIPAA PHI De-identification Engine | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 12 | HIPAA Compliance Status & Audit | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 13 | LOINC Lab Biomarker Extraction | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 14 | FHIR R4 Transaction Bundle Assembly | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 15 | Bundle JSON Local Download | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 16 | Supabase Integration & Settings | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 17 | Research & Extraction Tab UI | R3, AC: Research & Extraction | 5 | 5 | ✓ | ✓ |
| 18 | Production Build & Documentation | R4, AC: Build Quality | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Vitest, configured in `vitest.config.ts`. Run via `npm test`; all `tests/**/*.test.ts` files are picked up automatically.
- Format: Structured test suites reporting pass/fail counts, assertion details, and JSON exit codes.
- Test files:
  - `tests/e2e/tier1_features.test.ts`: Equivalence class happy-path tests for each inventoried feature.
  - `tests/e2e/tier2_boundaries.test.ts`: Edge cases, empty inputs, max string inputs, invalid JSON, missing permissions, extreme lab values.
  - `tests/e2e/tier3_pairwise.test.ts`: Cross-feature combinations (e.g. highlighted selection -> SOAP note -> SNOMED mapping -> de-identification -> FHIR bundle).
  - `tests/e2e/tier4_application.test.ts`: End-to-end acceptance scenarios specified in `ORIGINAL_REQUEST.md`.

## Real-World Application Scenarios (Tier 4 Acceptance Benchmarks)
| # | Scenario | Features Exercised | Expected Outcome |
|---|----------|--------------------|------------------|
| S1 | Clinical Discharge Benchmark | F3, F6, F7, F8, F9, F10 | Input `"Patient presents with hypertension and is on lisinopril 10mg daily."` produces 4 SOAP headers, SNOMED concept for hypertension (SCTID `38341003`), RxNorm concept for lisinopril (RxCUI `29046`). |
| S2 | Research & Extraction Benchmark | F11, F12, F13, F14, F15 | Input `"Patient John Smith, DOB 01/15/1980, MRN 123456. Triglycerides 210 mg/dL, Glucose 95 mg/dL, Testosterone 320 ng/dL."` redacts all 3 identifiers, returns `compliant: true`, extracts LOINC `2571-8`, `2345-7`, `2986-8`, generates valid FHIR transaction Bundle. |
| S3 | Cloud Sync & Storage Benchmark | F16, F17 | Persisting Supabase URL and anon key in `chrome.storage.sync` allows push attempt with success/error feedback. |
| S4 | Privacy & Permissions Benchmark | F1, F6 | Verifies `manifest.json` contains no `<all_urls>` and code triggers 0 external AI API calls. |
| S5 | Build & Packaging Benchmark | F1, F4, F18 | Running `npm run build` succeeds with 0 TS errors and outputs valid unpacked MV3 extension in `dist/`. |

## Coverage Target
- Tier 1: >= 90 tests
- Tier 2: >= 90 tests
- Tier 3: >= 18 tests
- Tier 4: >= 5 realistic application scenario tests
- Total target: >= 203 automated test cases
