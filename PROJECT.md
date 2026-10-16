# Project: PPK-Grounded Clinical Intelligence (internize.ai)

## Architecture
- **Offline Ingestion & Extraction Layer** (`scripts/ingest_ppk/`):
  - Ingests all 122 documents across 9 PAPDI divisions (`docs/ppk/`).
  - Extracts text from 58 digital text PDFs/DOCX and runs local OCR (`tesseract.js`) on 64 scanned image PDFs (305 pages).
  - Sanitizes and de-identifies all content: strips hospital identities (`RSUP Sanglah`, `RSUP Prof Ngoerah`, `RS Ngoerah`), physician names, director signatures, and administrative metadata.
  - Compiles structured medical rules, criteria, dosages, contraindications, and citations into `src/services/clinical/knowledge/ppkStore.json` (~350 KB JSON, gzipped ~80 KB).
  - Generates comprehensive Ingestion Coverage Report (`docs/PPK_INGESTION_REPORT.md`).
- **On-Device Runtime Engine Layer** (`src/services/clinical/`):
  - `PpkKnowledgeEngine`: In-memory indexed lookup (<2ms) mapping active problems and clinical keywords to structured PPK guidance.
  - Multi-problem & Cross-division reasoning: Prioritizes concurrent pathologies (e.g. DKA + Sepsis + AKI).
  - Patient parameter adaptation: Adjusts drug choices and dosages for renal eGFR, transaminases, geriatric frailty, and pregnancy.
  - Urgency arbitration: Harmonizes with binary `elektif` vs `life_saving` surgical triage and emergency CITO actions.
  - Deterministic out-of-scope refusal: Explicitly outputs "tidak tercakup PPK" for non-internal medicine inquiries (≥90% refusal accuracy).
  - Citation engine: Appends canonical guideline citations (`PPK PAPDI 2024 — Divisi [X]: [Penyakit] § [Bagian]`).
- **Workflow & UI Integration Layer** (`src/features/clinical/` & `internalMedicineEngine.ts`):
  - Integrates PPK knowledge seamlessly into all 3 modes: Jawab Konsul TS, Periksa Pasien POMR, and Ringkas Kasus.
  - Displays matched PPK protocols and titration tables in `SpPdWorkflowPanel.tsx` / `ProtocolCard.tsx` with one-click copy and EMR injection.
- **Frozen Benchmark & Evaluation Harness** (`tests/benchmark/`):
  - 156 clinical test items across all 9 divisions, 8 question types, multi-problem scenarios, and out-of-scope inquiries.
  - Split into Open Set (124 items, ~80%) and Hidden Set (32 items, ~20%).
  - Multi-agent authoring and independent cross-verification protocol.
  - SHA-256 frozen manifest recorded in `BENCHMARK_FREEZE.md` BEFORE engine modification.
  - Single-command test runner (`npm run test:benchmark`) with 4-tier rubric (Benar, Sebagian, Salah, Red Flag).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Benchmark Schema & Runner Harness | TypeScript schema, evaluation runner script, 4-tier scoring rubric, red flag detector | M1 | Survey / R4 |
| 2 | Benchmark Item Authoring & Independent Verification | Curate 156 items across 9 divisions and 8 question types with dual-agent independent cross-check | M1 | Survey / R4 |
| 3 | Benchmark Freezing & Baseline Measurement | SHA-256 hash manifest in BENCHMARK_FREEZE.md, baseline evaluation of existing engine | M1 | Survey / R4 |
| 4 | PPK Document Ingestion & Local OCR | Ingestion of 122 files (119 PDF, 2 DOCX, 1 DOC) with local tesseract.js OCR for 64 scanned PDFs | M2 | Survey / R1 |
| 5 | Hospital Identity Redaction & Privacy Scrubbing | Strip all hospital names, signatures, NIP, logos, and raw text to guarantee R3 zero-leakage | M2 | Survey / R3 |
| 6 | Ingestion Coverage Report | Comprehensive audit of all 122 files with parse status and explanation of exclusions | M2 | Survey / R1 |
| 7 | Structured PPK Knowledge Store (`ppkStore.json`) | Compressed, typed JSON knowledge base of all PPK conditions (criteria, Pdx, Ptx, Pmx, Pex, titrations, scores) | M3 | Survey / R1 |
| 8 | `PpkKnowledgeEngine` Core & Indexing | Sub-2ms in-memory indexed knowledge search mapping active problems to PPK entries | M3 | Survey / R2 |
| 9 | Patient Parameter Adaptation & Dose Adjustment | Renal eGFR / hepatic / geriatric dose titration, contraindication alerts, and drug holds | M3 | Survey / R2 |
| 10 | Multi-Problem Lintas Divisi Reasoning | Prioritized sequential interventions for concurrent pathologies across divisions | M3 | Survey / R2 |
| 11 | Deterministic Out-of-Scope Refusal | Explicitly declare "tidak tercakup PPK" for non-internal medicine queries | M3 | Survey / R2 |
| 12 | Canonical PPK Citation Generation | Accurate citations to PPK division, document, and section for all recommendations | M3 | Survey / R2 |
| 13 | 3-Mode Engine Integration | Deep integration into Jawab Konsul TS, Periksa Pasien POMR, and Ringkas Kasus | M4 | Survey / R2 |
| 14 | UI Protocol Card & EMR Injection | Surface matched PPK protocols, titration tables, and advis in SpPdWorkflowPanel | M4 | Survey / R2 |
| 15 | Frozen Benchmark Verification & Acceptance Gating | Achieve total score ≥ 85%, ≥ 40 pp gain, 0 red flags, hidden set ≥ 80%, citation ≥ 90% | M5 | Survey / R4 |
| 16 | Adversarial Stress Hardening & Privacy Audit | White-box stress testing of edge cases, verify zero network requests, verify zero raw PPK in git | M5 | Survey / R3, R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Benchmark Curation, Freezing & Baseline | Test harness, 164-item dataset curation, cross-verification, SHA-256 freeze, baseline measurement | none | DONE |
| 2 | M2: PPK Ingestion, OCR & Sanitization | Ingest 122 files across 9 divisions, local OCR for scanned PDFs, hospital identity scrubbing, Ingestion Report | none | DONE |
| 3 | M3: Knowledge Store & Reasoning Engine | Compile `ppkStore.json`, build `PpkKnowledgeEngine` (multi-problem, dosing, contraindications, OOS refusal, citations) | M2 | DONE |
| 4 | M4: 3-Mode Integration & UI Wiring | Integrate into Jawab Konsul TS, Periksa Pasien POMR, Ringkas Kasus, and SpPdWorkflowPanel | M3 | DONE |
| 5 | M5: Acceptance Verification & Hardening | Execute frozen benchmark, verify all acceptance criteria (score ≥85%, gain ≥40 pp, 0 red flags), adversarial testing, zero-egress audit | M1, M4 | PLANNED |

## Interface Contracts

### Benchmark Runner ↔ Evaluation Engine
- `runClinicalBenchmark(options: BenchmarkRunOptions): Promise<BenchmarkSummaryReport>`
- Types defined in `tests/benchmark/benchmark_schema.ts`:
  * `ClinicalBenchmarkItem`: `{ id, division, questionType, isHidden, vignette, clinicalQuestion, expectedAnswer, redFlags, citationTarget }`
  * `EvaluationResult`: `{ itemId, score (0 | 0.5 | 1.0), status ('benar' | 'sebagian' | 'salah'), redFlagTriggered: boolean, redFlagViolations: string[], citationValid: boolean, latencyMs }`
  * `BenchmarkSummaryReport`: `{ overallScore, openSetScore, hiddenSetScore, divisionScores, questionTypeScores, citationAccuracy, outOfScopeAccuracy, totalRedFlags, passedAllCriteria }`

### `PpkKnowledgeEngine` ↔ `InternalMedicineEngine`
- `PpkKnowledgeEngine.matchKnowledge(problem: SpPdProblem, vitals: VitalSigns, labs: AbnormalLabResult[]): PpkMatchedGuideline | null`
- `PpkKnowledgeEngine.evaluateOutofScope(queryText: string): { isOutOfScope: boolean; refusalMessage?: string }`
- `PpkKnowledgeEngine.formatCitation(guideline: PpkMatchedGuideline, section: string): string`
- `PpkKnowledgeEngine.getAdjustedDosing(drugName: string, standardDose: string, eGfr?: number, astAltRatio?: number): DoseAdjustmentResult`

### `SpPdWorkflowPanel` ↔ `PpkKnowledgeEngine`
- `SpPdWorkflowPanel` consumes `consultationAnswer.ppkGuidance` and `pomrNote.ppkCitations`.
- `ProtocolCard` renders `PpkMatchedGuideline` with interactive titration tables and EMR copy actions.

## Code Layout
- `scripts/ingest_ppk/` — PPK document ingestion, OCR extraction, hospital de-identification, and store compilation.
- `docs/PPK_INGESTION_REPORT.md` — Authoritative report on ingestion status of all 122 documents.
- `src/services/clinical/knowledge/ppkStore.json` — Compiled, compressed, sanitized knowledge base.
- `src/services/clinical/knowledge/ppkKnowledgeEngine.ts` — In-memory query, dosing adjustment, out-of-scope refusal, and citation formatting.
- `src/services/clinical/internalMedicineEngine.ts` — Extended to consume `ppkKnowledgeEngine`.
- `src/features/clinical/SpPdWorkflowPanel.tsx` — UI display of PPK recommendations and citations.
- `tests/benchmark/` — Frozen benchmark items, runner, validator, and evaluation reports:
  * `benchmark_schema.ts` — Authoritative TypeScript schema.
  * `data/clinical_benchmark_open.json` — 124 open set items.
  * `data/clinical_benchmark_hidden.json` — 32 hidden set items.
  * `BENCHMARK_FREEZE.md` — SHA-256 hashes and freeze timestamp.
  * `run_clinical_benchmark.ts` — Evaluation runner script.
  * `BASELINE_REPORT.md` — Pre-implementation baseline scores and metrics.
