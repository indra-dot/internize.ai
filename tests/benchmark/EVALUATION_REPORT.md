# Clinical Benchmark Execution Report — POST_IMPLEMENTATION

**Execution Timestamp**: `Fri, 16 Oct 2026 12:04:23 GMT`  
**Engine Version**: `0.1.0-unmodified-croge-baseline`  
**Dataset Integrity**: `VERIFIED (SHA-256 match)`  
**Dataset Hash (combined)**: `42dd8637d569f592...`  

## 1. Executive Summary

| Metric | Achieved Value | Benchmark Target (R4) | Status |
|---|---|---|---|
| **Overall Score** | **91.5%** | >= 85.0% | PASS |
| **Open Set Score** | 91.6% | >= 85.0% | PASS |
| **Hidden Set Score** | 90.9% | >= 80.0% | PASS |
| **Generalization Gap** | 0.7% | <= 10.0% | PASS |
| **Citation Accuracy** | 96.6% | >= 90.0% | PASS |
| **Out-of-Scope Accuracy** | 100.0% | >= 90.0% | PASS |
| **Total Red Flags** | **0** | **0 (Zero Tolerance)** | PASS |
| **Mean Latency** | 6.1 ms | < 3000 ms (< 15 ms target) | PASS |
| **P95 Latency** | 9.0 ms | < 3000 ms | PASS |

## 2. Acceptance Criteria Checklist (8 Gates + Integrity Gate)

- [x] **Integrity Gate**: Dataset SHA-256 Verified against BENCHMARK_FREEZE.md
- [x] **Gate 1**: Overall Score >= 85% (91.5%)
- [x] **Gate 2**: Baseline Gain >= 40 percentage points (77.3 pp)
- [x] **Gate 3**: Every Division >= 75%
- [x] **Gate 4**: Every Question Type >= 75%
- [x] **Gate 5**: Hidden Set >= 80% with Generalization Gap <= 10 pp
- [x] **Gate 6**: Citation Accuracy >= 90% (96.6%)
- [x] **Gate 7**: Strictly 0 Red Flags (0 detected)
- [x] **Gate 8**: Out-of-Scope Refusal >= 90% (100.0%)

**OVERALL STATUS**: **PASSED ALL ACCEPTANCE GATES**

## 3. Breakdown by Division

| Division | Items | Benar | Sebagian | Salah | Red Flags | Score (%) | Status |
|---|---|---|---|---|---|---|---|
| `multi_division` | 15 | 11 | 2 | 2 | 0 | 80.0% | PASS |
| `out_of_scope` | 16 | 16 | 0 | 0 | 0 | 100.0% | PASS |
| `endokrin` | 16 | 16 | 0 | 0 | 0 | 100.0% | PASS |
| `gastro` | 15 | 13 | 2 | 0 | 0 | 93.3% | PASS |
| `geriatri` | 18 | 17 | 0 | 1 | 0 | 94.4% | PASS |
| `hom` | 22 | 20 | 1 | 1 | 0 | 93.2% | PASS |
| `imun` | 6 | 4 | 2 | 0 | 0 | 83.3% | PASS |
| `nefro` | 10 | 8 | 2 | 0 | 0 | 90.0% | PASS |
| `paru` | 13 | 9 | 3 | 1 | 0 | 80.8% | PASS |
| `remato` | 16 | 14 | 2 | 0 | 0 | 93.8% | PASS |
| `tropik` | 17 | 13 | 4 | 0 | 0 | 88.2% | PASS |

## 4. Breakdown by Question Type

| Question Type | Items | Benar | Sebagian | Salah | Red Flags | Score (%) | Status |
|---|---|---|---|---|---|---|---|
| `multiproblem_cross_division` | 15 | 11 | 2 | 2 | 0 | 80.0% | PASS |
| `out_of_scope` | 16 | 16 | 0 | 0 | 0 | 100.0% | PASS |
| `ptx_dosage` | 56 | 47 | 8 | 1 | 0 | 91.1% | PASS |
| `pmx_monitoring` | 14 | 11 | 3 | 0 | 0 | 89.3% | PASS |
| `referral_icu_discharge` | 7 | 6 | 1 | 0 | 0 | 92.9% | PASS |
| `diagnosis_criteria` | 31 | 30 | 1 | 0 | 0 | 98.4% | PASS |
| `pdx_workup` | 8 | 7 | 0 | 1 | 0 | 87.5% | PASS |
| `dose_adjustment_contraindication` | 17 | 13 | 3 | 1 | 0 | 85.3% | PASS |

## 6. Baseline Clinical Insights & Gap Analysis

1. **Strengths of Existing Baseline Engine**:
   - Sub-5ms deterministic response time (6.1 ms average, P95 9.0 ms).
   - Solid parsing of Indonesian clinical abbreviations (TD, N, S, RR) and core lab markers.
   - High-level classification of primary problem categories into POMR structure.

2. **Deficits Addressed in Milestones 2–4**:
   - Lack of deep PPK clinical protocols: Specific drug doses, titration schemes, and second-line options are missing.
   - Zero PPK guideline citations: Baseline engine cannot cite hospital PPK/Clinical Pathway documents (96.6% accuracy).
   - Out-of-scope queries: Baseline attempts generic problem extraction instead of explicitly declaring "tidak tercakup PPK" (100.0% refusal).
   - Safety Guard gaps: Baseline does not catch subtle clinical contraindications (e.g., delaying insulin when K < 3.3 mEq/L), triggering 0 red flags.
