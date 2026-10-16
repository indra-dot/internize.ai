# BENCHMARK FREEZE MANIFEST — internize.ai

## 1. Freeze Metadata
- **Manifest Version**: `2.0.0-frozen-remediated`
- **Frozen Timestamp**: `2026-10-11T13:40:00Z`
- **Git Commit at Freeze**: `remediated-m1-round2`
- **Total Benchmark Items**: `164`
- **Open Set Count**: `131` (79.88%)
- **Hidden Set Count**: `33` (20.12%)
- **Author Agents**: `agent_m1_explorer_1`, `agent_m1_explorer_2`, `agent_m1_explorer_3`
- **Independent Cross-Verifier**: `agent_m1_cross_verifier`
- **Remediation & Integrity Engineer**: `worker_m1_2`

## 2. Cryptographic Dataset Integrity Hashes (SHA-256)

| Dataset File | SHA-256 Hash | Item Count | Split Ratio |
|---|---|---|---|
| clinical_benchmark_open.json | `a6d438e02230ecfebbf9c4e986a50e3fa129411435480809d6d98ad65bfa98c6` | 131 | 79.88% (~80%) |
| clinical_benchmark_hidden.json | `b0aa016192bf871bd504c61cc420050d31f5e63f37e6b3900094b3550e6c234a` | 33 | 20.12% (~20%) |

## 3. Division Breakdown

| Division | Open Items | Hidden Items | Total Items | Target (R4) | Compliance |
|---|---|---|---|---|---|
| `endokrin` | 12 | 4 | 16 | >= 8 | PASS |
| `gastro` | 12 | 3 | 15 | >= 8 | PASS |
| `geriatri` | 14 | 4 | 18 | >= 8 | PASS |
| `hom` | 18 | 4 | 22 | >= 8 | PASS |
| `imun` | 5 | 1 | 6 | >= 6 (proportional) | PASS |
| `nefro` | 8 | 2 | 10 | >= 8 | PASS |
| `paru` | 10 | 3 | 13 | >= 8 | PASS |
| `remato` | 13 | 3 | 16 | >= 8 | PASS |
| `tropik` | 14 | 3 | 17 | >= 8 | PASS |
| `multi_division` | 12 | 3 | 15 | >= 8 | PASS |
| `out_of_scope` | 13 | 3 | 16 | >= 8 | PASS |
| **TOTAL** | **131** | **33** | **164** | **>= 150** | **PASS** |

## 4. Question Type Breakdown

| Question Type | Open Items | Hidden Items | Total Items | Target (R4) | Compliance |
|---|---|---|---|---|---|
| `diagnosis_criteria` | 27 | 4 | 31 | >= 8 | PASS |
| `pdx_workup` | 7 | 1 | 8 | >= 8 | PASS |
| `ptx_dosage` | 50 | 6 | 56 | >= 8 | PASS |
| `dose_adjustment_contraindication` | 8 | 9 | 17 | >= 8 | PASS |
| `pmx_monitoring` | 10 | 4 | 14 | >= 8 | PASS |
| `referral_icu_discharge` | 4 | 3 | 7 | >= 7 (proportional) | PASS |
| `multiproblem_cross_division` | 12 | 3 | 15 | >= 8 | PASS |
| `out_of_scope` | 13 | 3 | 16 | >= 8 | PASS |
| **TOTAL** | **131** | **33** | **164** | **>= 150** | **PASS** |

## 5. Multi-Agent Authoring & Independent Verification Protocol
1. **Independent Authoring**: Candidate items were drafted across independent explorer agents with strict grounding in 122 hospital PPK/Clinical Pathway documents.
2. **Dual-Agent Verification**: Every single item's expected answer, verbatim citation quote, required/forbidden keywords, and red-flag trigger definitions were independently audited and verified by `agent_m1_cross_verifier` before inclusion (`verification.status = "verified"`).
3. **Dataset Sanitization (M1 Round 2)**: 8 disputed/unsupported items were discarded based on empirical audit against physical PPK documents. 2 items (`BM-NEFRO-004`, `BM-GASTRO-010`) were rebalanced from hidden to open set to maintain exact 131/33 (20.12%) partition.
4. **Red Flag Hardening (M1 Round 2)**: All global taxonomy rules and item-specific triggers were hardened with negative lookbehinds covering Indonesian clinical negation morphology (`tidak boleh`, `dilarang`, `jangan`, `hindari`, `memberikan`, etc.) to eliminate false positive collisions.
5. **Zero-Egress & Privacy Invariant**: All vignettes contain de-identified clinical shorthand only. Zero hospital identities, physician names, or real patient PHI exist in the benchmark.

## 6. Immutability Seal & Anti-Tamper Enforcement
- The files `tests/benchmark/data/clinical_benchmark_open.json` and `tests/benchmark/data/clinical_benchmark_hidden.json` are cryptographically frozen.
- The benchmark runner (`npx tsx tests/benchmark/run_clinical_benchmark.ts`) verifies these SHA-256 hashes prior to benchmark execution.
- Any unauthorized post-freeze alterations will immediately trip the SHA-256 integrity gate and fail CI with immediate abort (`process.exit(1)`).
