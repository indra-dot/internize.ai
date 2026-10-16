# Clinical Benchmark Execution Report — POST_IMPLEMENTATION

**Execution Timestamp**: `Fri, 16 Oct 2026 10:39:13 GMT`  
**Engine Version**: `0.1.0-unmodified-croge-baseline`  
**Dataset Integrity**: `VERIFIED (SHA-256 match)`  
**Dataset Hash (combined)**: `42dd8637d569f592...`  

## 1. Executive Summary

| Metric | Achieved Value | Benchmark Target (R4) | Status |
|---|---|---|---|
| **Overall Score** | **27.1%** | >= 85.0% | FAIL |
| **Open Set Score** | 27.1% | >= 85.0% | FAIL |
| **Hidden Set Score** | 27.3% | >= 80.0% | FAIL |
| **Generalization Gap** | 0.2% | <= 10.0% | PASS |
| **Citation Accuracy** | 97.3% | >= 90.0% | PASS |
| **Out-of-Scope Accuracy** | 100.0% | >= 90.0% | PASS |
| **Total Red Flags** | **0** | **0 (Zero Tolerance)** | PASS |
| **Mean Latency** | 5.6 ms | < 3000 ms (< 15 ms target) | PASS |
| **P95 Latency** | 8.0 ms | < 3000 ms | PASS |

## 2. Acceptance Criteria Checklist (8 Gates + Integrity Gate)

- [x] **Integrity Gate**: Dataset SHA-256 Verified against BENCHMARK_FREEZE.md
- [ ] **Gate 1**: Overall Score >= 85% (27.1%)
- [ ] **Gate 2**: Baseline Gain >= 40 percentage points (12.9 pp)
- [ ] **Gate 3**: Every Division >= 75%
- [ ] **Gate 4**: Every Question Type >= 75%
- [ ] **Gate 5**: Hidden Set >= 80% with Generalization Gap <= 10 pp
- [x] **Gate 6**: Citation Accuracy >= 90% (97.3%)
- [x] **Gate 7**: Strictly 0 Red Flags (0 detected)
- [x] **Gate 8**: Out-of-Scope Refusal >= 90% (100.0%)

**OVERALL STATUS**: **FAILED ACCEPTANCE GATES (Baseline Phase)**

## 3. Breakdown by Division

| Division | Items | Benar | Sebagian | Salah | Red Flags | Score (%) | Status |
|---|---|---|---|---|---|---|---|
| `multi_division` | 15 | 0 | 4 | 11 | 0 | 13.3% | FAIL |
| `out_of_scope` | 16 | 16 | 0 | 0 | 0 | 100.0% | PASS |
| `endokrin` | 16 | 0 | 6 | 10 | 0 | 18.8% | FAIL |
| `gastro` | 15 | 1 | 6 | 8 | 0 | 26.7% | FAIL |
| `geriatri` | 18 | 0 | 4 | 14 | 0 | 11.1% | FAIL |
| `hom` | 22 | 1 | 6 | 15 | 0 | 18.2% | FAIL |
| `imun` | 6 | 0 | 3 | 3 | 0 | 25.0% | FAIL |
| `nefro` | 10 | 2 | 5 | 3 | 0 | 45.0% | FAIL |
| `paru` | 13 | 0 | 5 | 8 | 0 | 19.2% | FAIL |
| `remato` | 16 | 1 | 1 | 14 | 0 | 9.4% | FAIL |
| `tropik` | 17 | 0 | 7 | 10 | 0 | 20.6% | FAIL |

## 4. Breakdown by Question Type

| Question Type | Items | Benar | Sebagian | Salah | Red Flags | Score (%) | Status |
|---|---|---|---|---|---|---|---|
| `multiproblem_cross_division` | 15 | 0 | 4 | 11 | 0 | 13.3% | FAIL |
| `out_of_scope` | 16 | 16 | 0 | 0 | 0 | 100.0% | PASS |
| `ptx_dosage` | 56 | 1 | 20 | 35 | 0 | 19.6% | FAIL |
| `pmx_monitoring` | 14 | 0 | 3 | 11 | 0 | 10.7% | FAIL |
| `referral_icu_discharge` | 7 | 0 | 0 | 7 | 0 | 0.0% | FAIL |
| `diagnosis_criteria` | 31 | 2 | 12 | 17 | 0 | 25.8% | FAIL |
| `pdx_workup` | 8 | 0 | 1 | 7 | 0 | 6.3% | FAIL |
| `dose_adjustment_contraindication` | 17 | 2 | 7 | 8 | 0 | 32.4% | FAIL |

## 6. Baseline Clinical Insights & Gap Analysis

1. **Strengths of Existing Baseline Engine**:
   - Sub-5ms deterministic response time (5.6 ms average, P95 8.0 ms).
   - Solid parsing of Indonesian clinical abbreviations (TD, N, S, RR) and core lab markers.
   - High-level classification of primary problem categories into POMR structure.

2. **Deficits Addressed in Milestones 2–4**:
   - Lack of deep PPK clinical protocols: Specific drug doses, titration schemes, and second-line options are missing.
   - Zero PPK guideline citations: Baseline engine cannot cite hospital PPK/Clinical Pathway documents (97.3% accuracy).
   - Out-of-scope queries: Baseline attempts generic problem extraction instead of explicitly declaring "tidak tercakup PPK" (100.0% refusal).
   - Safety Guard gaps: Baseline does not catch subtle clinical contraindications (e.g., delaying insulin when K < 3.3 mEq/L), triggering 0 red flags.
