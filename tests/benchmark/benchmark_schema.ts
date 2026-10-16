/**
 * benchmark_schema.ts
 *
 * Authoritative TypeScript Data Model & Types for internize.ai
 * Frozen Clinical Benchmark (R4 — Benchmark First)
 *
 * Strict Compliance:
 * - 100% on-device, zero-egress, zero PHI transmission
 * - Grounded in 122 hospital PPK/Clinical Pathway documents
 * - 9 PAPDI Divisions + Multi-Problem + Out-of-Scope
 * - 8 Question Types
 * - Split: ~80% Open Set / ~20% Hidden Set
 * - Dual-Agent Independent Verification & SHA-256 Integrity Sealing
 */

export type BenchmarkDivision =
  | 'endokrin'
  | 'gastro'
  | 'geriatri'
  | 'hom'
  | 'imun'
  | 'nefro'
  | 'paru'
  | 'remato'
  | 'tropik'
  | 'multi_division'
  | 'out_of_scope';

export type BenchmarkQuestionType =
  | 'diagnosis_criteria'
  | 'pdx_workup'
  | 'ptx_dosage'
  | 'dose_adjustment_contraindication'
  | 'pmx_monitoring'
  | 'referral_icu_discharge'
  | 'multiproblem_cross_division'
  | 'out_of_scope';

export type BenchmarkSplit = 'open' | 'hidden';

export type RedFlagSeverity = 'lethal' | 'severe_harm';

export interface RedFlagDefinition {
  definition: string;
  triggers: string[]; // Keywords or regex patterns that trip the red flag
  severity: RedFlagSeverity;
  clinicalRationale: string;
}

export interface ExpectedDoseRange {
  drug: string;
  minDose?: number;
  maxDose?: number;
  unit: string;
  route: string;
  frequency: string;
  titrationNotes?: string;
}

export interface ExpectedAnswer {
  coreConclusion: string;
  requiredKeywords: string[];
  forbiddenKeywords?: string[];
  doseRange?: ExpectedDoseRange;
  detailedGuidance: string;
}

export interface ExactPpkCitation {
  documentName: string; // Exact file name in docs/ppk/
  divisionFolder: string; // Folder name in docs/ppk/
  section: string; // Section heading inside PPK document
  pageNumber?: number; // Page in document if applicable
  tableOrAlgorithmName?: string;
  quotedGuidelineText: string; // Exact verbatim quote from PPK
}

export interface VerificationAudit {
  authorAgentId: string;
  verifierAgentId: string;
  verificationTimestamp: string; // ISO 8601 UTC
  status: 'verified' | 'disputed' | 'discarded';
  evidenceQuote: string;
  arbitrationNotes?: string;
}

export interface BenchmarkItem {
  id: string; // e.g., 'BM-ENDO-001', 'BM-MULTI-005', 'BM-OOS-002'
  division: BenchmarkDivision;
  questionType: BenchmarkQuestionType;
  split: BenchmarkSplit;
  caseVignette: string; // Detailed clinical vignette with Indonesian clinical shorthand
  question: string; // Specific clinical question asked to the engine
  expectedAnswer: ExpectedAnswer;
  exactPpkCitation: ExactPpkCitation;
  redFlag: RedFlagDefinition;
  verification: VerificationAudit;
  clinicalComplexity: 'basic' | 'moderate' | 'complex';
}

export interface BenchmarkManifest {
  manifestVersion: string; // e.g. "1.0.0-frozen"
  frozenTimestamp: string; // ISO 8601 UTC
  gitCommitAtFreeze: string;
  totalItemCount: number; // Must be >= 150 (target: 172)
  openSetCount: number; // ~80% (target: 137)
  hiddenSetCount: number; // ~20% (target: 35)
  openSetSha256: string;
  hiddenSetSha256: string;
  combinedDatasetSha256: string;
  divisionCounts: Record<BenchmarkDivision, number>;
  questionTypeCounts: Record<BenchmarkQuestionType, number>;
  verifiedByAuthor: string;
  verifiedByReviewer: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Evaluation & Scoring Models
// ──────────────────────────────────────────────────────────────────────────────

export type ItemScoringGrade = 'benar' | 'sebagian' | 'salah' | 'red_flag';

export interface ItemEvaluationResult {
  itemId: string;
  division: BenchmarkDivision;
  questionType: BenchmarkQuestionType;
  split: BenchmarkSplit;
  grade: ItemScoringGrade;
  score: number; // benar = 1.0, sebagian = 0.5, salah = 0.0, red_flag = 0.0 (fails safety gate)
  matchedKeywords: string[];
  missingKeywords: string[];
  isCitationAccurate: boolean;
  isOutOfScopeAccurate?: boolean;
  isRedFlagTriggered: boolean;
  redFlagDetails?: string;
  latencyMs: number;
  engineOutputSnippet: string;
  notes?: string;
}

export interface CategoryScoreSummary {
  category: string;
  totalItems: number;
  pointsEarned: number;
  maxPoints: number;
  percentageScore: number;
  benarCount: number;
  sebagianCount: number;
  salahCount: number;
  redFlagCount: number;
}

export interface BenchmarkExecutionReport {
  executionTimestamp: string;
  engineVersion: string;
  manifestSha256: string;
  integrityVerified: boolean;
  mode: 'baseline' | 'post_implementation' | 'evaluation';

  // Aggregate Metrics
  totalItems: number;
  overallScore: number; // Percentage (0 - 100%)
  openSetScore: number;
  hiddenSetScore: number;
  generalizationGap: number; // abs(openSetScore - hiddenSetScore)
  citationAccuracy: number; // Percentage (0 - 100%)
  outOfScopeAccuracy: number; // Percentage (0 - 100%)
  totalRedFlags: number;
  meanLatencyMs: number;
  p95LatencyMs: number;

  // Breakdown tables
  perDivisionScores: Record<BenchmarkDivision, CategoryScoreSummary>;
  perQuestionTypeScores: Record<BenchmarkQuestionType, CategoryScoreSummary>;

  // Acceptance Criteria Checklist (R4)
  acceptanceCriteria: {
    integrityPassed: boolean; // Dataset SHA-256 integrity verified against BENCHMARK_FREEZE.md
    overallScorePassed: boolean; // >= 85%
    baselineGainPassed: boolean; // >= 40 pp gain (if baseline provided)
    allDivisionsPassed: boolean; // each division >= 75%
    allQuestionTypesPassed: boolean; // each question type >= 75%
    hiddenSetPassed: boolean; // hidden >= 80% AND gap <= 10 pp
    citationAccuracyPassed: boolean; // >= 90%
    zeroRedFlagsPassed: boolean; // strictly 0 red flags
    outOfScopePassed: boolean; // >= 90% answered "tidak tercakup PPK"
    overallAcceptancePassed: boolean; // all criteria satisfied (including integrityPassed)
    passedAllCriteria: boolean; // Canonical alias for overallAcceptancePassed matching PROJECT.md
  };

  redFlagViolations: Array<{
    itemId: string;
    division: BenchmarkDivision;
    vignette: string;
    triggeredSnippet: string;
    rationale: string;
  }>;
  itemResults?: ItemEvaluationResult[];
}

/** Canonical type alias matching PROJECT.md interface contract */
export type BenchmarkSummaryReport = BenchmarkExecutionReport;

