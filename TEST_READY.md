# TEST_READY: internize.ai Test Suites (E2E & Clinical Benchmark)

## Executive Summary
Both testing tracks for **internize.ai** are fully implemented, verified, and ready for continuous evaluation and acceptance gating:
1. **Opaque-Box E2E Test Suite**: 240 automated tests verifying MV3 architecture, on-device parsing, clinical workflows, and zero egress.
2. **PPK Clinical Benchmark Suite**: 164-item frozen benchmark dataset across all 9 PAPDI internal medicine divisions, 8 question types, and out-of-scope inquiries with cryptographic SHA-256 tamper verification.

---

## 1. PPK Clinical Benchmark Suite (Frozen Evaluation Harness)

- **Test Runner Command**: `npm run test:benchmark` (or `npx tsx tests/benchmark/run_clinical_benchmark.ts --baseline`)
- **Dataset Partition**:
  - Open Set: **131 items** (79.88%)
  - Hidden Set: **33 items** (20.12%)
  - Total: **164 items**
- **Cryptographic Freeze Hashes** (enforced with hard `process.exit(1)` tamper abort):
  - `clinical_benchmark_open.json`: `a6d438e02230ecfebbf9c4e986a50e3fa129411435480809d6d98ad65bfa98c6`
  - `clinical_benchmark_hidden.json`: `b0aa016192bf871bd504c61cc420050d31f5e63f37e6b3900094b3550e6c234a`
- **Pre-Implementation Baseline**: 14.0% overall score with 8 red flags (recorded in `tests/benchmark/BASELINE_REPORT.md`).
- **Target Acceptance Thresholds (Milestone 5)**:
  - Overall Benchmark Score: ≥ 85.0%
  - Performance Gain: ≥ +40.0 percentage points
  - Red Flag Violations: **0** (Zero lethal contraindications)
  - Hidden Set Generalization: ≥ 80.0%
  - Citation Accuracy: ≥ 90.0%
  - Out-of-Scope Refusal Accuracy: ≥ 90.0%

### Clinical Benchmark Coverage by PAPDI Division:
| Division | Open Items | Hidden Items | Total Items |
|----------|:----------:|:------------:|:-----------:|
| Endokrin-Metabolik | 12 | 4 | 16 |
| Gastroenterohepatologi | 12 | 3 | 15 |
| Geriatri | 14 | 4 | 18 |
| Hematologi-Onkologi Medik | 18 | 4 | 22 |
| Alergi-Imunologi Klinik | 5 | 1 | 6 |
| Ginjal-Hipertensi (Nefrologi) | 8 | 2 | 10 |
| Pulmonologi (Respirologi) | 10 | 3 | 13 |
| Reumatologi | 13 | 3 | 16 |
| Tropik-Infeksi | 14 | 3 | 17 |
| Multi-Divisi (Lintas Divisi) | 12 | 3 | 15 |
| Out-of-Scope (Non-Sp.PD Refusal) | 13 | 3 | 16 |
| **Total** | **131** | **33** | **164** |

---

## 2. Opaque-Box E2E Suite Breakdown

- **Test Runner Command**: `npm test`
- **Total Test Count**: 240 automated tests
- **Pass Rate**: 100.0% (240/240 passed)

| Tier | Suite Name | Description | Count | Status |
|:---:|:---|:---|:---:|:---:|
| **Tier 1** | `tests/e2e/tier1_features.test.ts` | Equivalence class happy-path tests across all features | **95** | **PASS** |
| **Tier 2** | `tests/e2e/tier2_boundaries.test.ts` | Boundary value analysis, stress inputs, extreme labs, security | **95** | **PASS** |
| **Tier 3** | `tests/e2e/tier3_pairwise.test.ts` | Pairwise cross-feature interactions and end-to-end data pipelines | **20** | **PASS** |
| **Tier 4** | `tests/e2e/tier4_application.test.ts` | Real-world acceptance benchmark scenarios | **13** | **PASS** |
| **Unit** | `tests/unit/*.test.ts` | Clinical parsers, de-identification, and utility unit tests | **17** | **PASS** |
| **TOTAL** | **Full Suite** | **Comprehensive system verification** | **240** | **PASS (100%)** |

---

## 3. How to Run the Tests

```bash
# 1. Run full unit & E2E suite
npm test

# 2. Run clinical benchmark evaluation against frozen manifest
npm run test:benchmark

# 3. Verify TypeScript build
npm run build
```
