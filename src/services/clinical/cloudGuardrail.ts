/**
 * cloudGuardrail.ts
 * ==================
 * Client-side validation and safety guardrail for Cloud Synthesizer responses.
 *
 * Runs BEFORE re-identification swap occurs, blocking any malformed or
 * potentially leaking cloud output from reaching the UI.
 *
 * Three-layer defence:
 *   Layer 1 — Structural Schema Validation: verifies required fields & types.
 *   Layer 2 — Token Invariant Assertion: all original tokens must survive intact.
 *   Layer 3 — Anti-Leakage Scan: blocks NIK, raw phone, IP patterns.
 *
 * No external dependencies — pure TypeScript runtime only.
 */

// ─── Public types (mirror edge function) ────────────────────────────────────

export interface CloudSynthesisProblem {
  priority: number;
  division: string;
  diagnosis: string;
  evidence_rationale: string;
  differential_diagnoses: string[];
  urgency: 'cito' | 'high' | 'moderate' | 'routine';
}

export interface CloudSynthesisSafetyAlerts {
  renal_risk: string;
  hepatic_risk: string;
  cardiac_qtc_risk: string;
  bleeding_hemostasis_risk: string;
}

export interface CloudSynthesisPlan {
  diagnostik: string[];
  terapeutik: string[];
  monitoring: string[];
  edukasi: string[];
}

export interface CloudSynthesisSoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: CloudSynthesisPlan;
}

export interface SpPdSynthesisOutput {
  summary_one_liner: string;
  problem_list: CloudSynthesisProblem[];
  pertinent_negatives: string[];
  cross_specialty_safety_alerts: CloudSynthesisSafetyAlerts;
  soap_note: CloudSynthesisSoapNote;
}

export type MarkdownSynthesizerMode = 'konsul' | 'pomr' | 'ringkasan' | 'research_extract';

export interface MarkdownGuardrailResult {
  status: GuardrailStatus;
  reason?: string;
  output?: string;
}

// ─── Validation result ───────────────────────────────────────────────────────

export type GuardrailStatus = 'pass' | 'schema_error' | 'token_leak' | 'phi_leak';

export interface GuardrailResult {
  status: GuardrailStatus;
  /** Human-readable reason if status !== 'pass' */
  reason?: string;
  /** Validated, type-safe output when status === 'pass' */
  output?: SpPdSynthesisOutput;
}

// ─── Layer 1: Structural Schema Validation ───────────────────────────────────

/** Returns an error message or null if valid */
function validateSchema(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) {
    return 'Root value is not an object';
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.summary_one_liner !== 'string' || obj.summary_one_liner.trim() === '') {
    return 'summary_one_liner missing or empty';
  }

  if (!Array.isArray(obj.problem_list)) {
    return 'problem_list is not an array';
  }
  for (let i = 0; i < (obj.problem_list as unknown[]).length; i++) {
    const p = (obj.problem_list as unknown[])[i];
    if (typeof p !== 'object' || p === null) return `problem_list[${i}] is not an object`;
    const pr = p as Record<string, unknown>;
    if (typeof pr.priority !== 'number') return `problem_list[${i}].priority not a number`;
    if (typeof pr.division !== 'string') return `problem_list[${i}].division not a string`;
    if (typeof pr.diagnosis !== 'string') return `problem_list[${i}].diagnosis not a string`;
    if (typeof pr.evidence_rationale !== 'string') return `problem_list[${i}].evidence_rationale not a string`;
    if (!Array.isArray(pr.differential_diagnoses)) return `problem_list[${i}].differential_diagnoses not an array`;
    const validUrgencies = ['cito', 'high', 'moderate', 'routine'];
    if (!validUrgencies.includes(pr.urgency as string)) {
      return `problem_list[${i}].urgency must be one of: ${validUrgencies.join(', ')}`;
    }
  }

  if (!Array.isArray(obj.pertinent_negatives)) {
    return 'pertinent_negatives is not an array';
  }

  if (typeof obj.cross_specialty_safety_alerts !== 'object' || obj.cross_specialty_safety_alerts === null) {
    return 'cross_specialty_safety_alerts missing';
  }
  const alerts = obj.cross_specialty_safety_alerts as Record<string, unknown>;
  for (const key of ['renal_risk', 'hepatic_risk', 'cardiac_qtc_risk', 'bleeding_hemostasis_risk'] as const) {
    if (typeof alerts[key] !== 'string') return `cross_specialty_safety_alerts.${key} not a string`;
  }

  if (typeof obj.soap_note !== 'object' || obj.soap_note === null) {
    return 'soap_note missing';
  }
  const soap = obj.soap_note as Record<string, unknown>;
  for (const key of ['subjective', 'objective', 'assessment'] as const) {
    if (typeof soap[key] !== 'string') return `soap_note.${key} not a string`;
  }
  if (typeof soap.plan !== 'object' || soap.plan === null) return 'soap_note.plan missing';
  const plan = soap.plan as Record<string, unknown>;
  for (const key of ['diagnostik', 'terapeutik', 'monitoring', 'edukasi'] as const) {
    if (!Array.isArray(plan[key])) return `soap_note.plan.${key} not an array`;
  }

  return null; // valid
}

// ─── Layer 2: Token Invariant Assertion ──────────────────────────────────────

/**
 * Verifies that every token present in the original sanitized text
 * still exists verbatim in the cloud JSON output.
 *
 * Tokens have the form [WORD_N] where WORD is uppercase and N is a digit.
 * Example: [PATIENT_1], [MRN_1], [HOSPITAL_1], [DOCTOR_1], [DATE_1]
 */
function assertTokensIntact(
  originalTokens: string[],
  cloudJsonStr: string,
): string | null {
  if (originalTokens.length === 0) return null;
  const missing = originalTokens.filter((tok) => !cloudJsonStr.includes(tok));
  if (missing.length > 0) {
    return `Token invariant violated — missing tokens: ${missing.join(', ')}`;
  }
  return null;
}

/** Extract all tokens of form [WORD_N] from a sanitized text string */
export function extractTokens(sanitizedText: string): string[] {
  const TOKEN_RE = /\[([A-Z_]+_\d+)\]/g;
  const tokens = new Set<string>();
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = TOKEN_RE.exec(sanitizedText)) !== null) {
    tokens.add(m[0]);
  }
  return Array.from(tokens);
}

// ─── Layer 3: Anti-Leakage Scan ──────────────────────────────────────────────

interface LeakagePattern {
  name: string;
  pattern: RegExp;
}

/**
 * Patterns that should NEVER appear in a properly de-identified cloud response.
 * These represent direct identifiers that escaped sanitization.
 */
const LEAKAGE_PATTERNS: LeakagePattern[] = [
  { name: 'NIK (16-digit)', pattern: /\b\d{16}\b/ },
  { name: 'Indonesian phone (+62)', pattern: /\+62\s?8\d{7,11}\b/ },
  { name: 'Indonesian phone (08xx)', pattern: /\b08\d{7,11}\b/ },
  { name: 'IPv4 address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { name: 'Email address', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: 'SSN pattern', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
];

function scanForLeakage(jsonStr: string): string | null {
  for (const { name, pattern } of LEAKAGE_PATTERNS) {
    if (pattern.test(jsonStr)) {
      return `PHI leakage detected: ${name} pattern found in cloud response`;
    }
  }
  return null;
}

// ─── Main guardrail entry point ───────────────────────────────────────────────

/**
 * Validates a raw cloud response object through all three layers:
 *   1. Schema validation
 *   2. Token invariant check (requires original sanitized text)
 *   3. Anti-leakage scan
 *
 * Returns a GuardrailResult with status 'pass' and the typed output on success,
 * or a specific failure status with reason on any violation.
 *
 * @param rawResponse  The parsed JSON from the cloud (unknown type for safety)
 * @param sanitizedText  The original de-identified text sent to the cloud
 */
export function runGuardrail(
  rawResponse: unknown,
  sanitizedText: string,
): GuardrailResult {
  // ── Layer 1: Schema ──────────────────────────────────────────────────────
  const schemaError = validateSchema(rawResponse);
  if (schemaError) {
    return {
      status: 'schema_error',
      reason: `Schema validation failed: ${schemaError}`,
    };
  }

  const validated = rawResponse as SpPdSynthesisOutput;
  const cloudJsonStr = JSON.stringify(validated);

  // ── Layer 2: Token invariant ─────────────────────────────────────────────
  const originalTokens = extractTokens(sanitizedText);
  const tokenError = assertTokensIntact(originalTokens, cloudJsonStr);
  if (tokenError) {
    return {
      status: 'token_leak',
      reason: tokenError,
    };
  }

  // ── Layer 3: Anti-leakage ────────────────────────────────────────────────
  const leakageError = scanForLeakage(cloudJsonStr);
  if (leakageError) {
    return {
      status: 'phi_leak',
      reason: leakageError,
    };
  }

  return { status: 'pass', output: validated };
}

// ─── Re-identification helper ────────────────────────────────────────────────

/**
 * Replaces all tokens in a JSON string with their real values from the token map.
 * Token map format: { '[PATIENT_1]': 'Budi Santoso', '[MRN_1]': '1234567', ... }
 *
 * Runs client-side ONLY — the token map never leaves the browser.
 * Call this AFTER runGuardrail passes.
 */
export function reidentifyOutput(
  output: SpPdSynthesisOutput,
  tokenMap: Map<string, string>,
): SpPdSynthesisOutput {
  if (tokenMap.size === 0) return output;

  let jsonStr = JSON.stringify(output);
  for (const [token, realValue] of tokenMap) {
    // Escape the token for use in regex (brackets are special chars)
    const escaped = token.replace(/[[\]]/g, '\\$&');
    jsonStr = jsonStr.replace(new RegExp(escaped, 'g'), realValue);
  }
  return JSON.parse(jsonStr) as SpPdSynthesisOutput;
}

// ─── Markdown Guardrail & Re-identification ──────────────────────────────────

/**
 * Validates that the generated markdown contains the required headers for the specified mode
 * and does not contain JSON or empty content.
 */
function validateMarkdownStructure(
  markdown: string,
  mode?: MarkdownSynthesizerMode,
): string | null {
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return 'Markdown output is empty or not a string';
  }

  const trimmed = markdown.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return 'Output is JSON instead of pure clipboard-ready Markdown';
  }

  const normalized = markdown.toUpperCase();

  const requiredSections: Record<MarkdownSynthesizerMode, string[]> = {
    konsul: [
      'RINGKASAN KLINIS',
      'JAWABAN KONSUL',
      'DAFTAR MASALAH AKTIF',
      'CROSS-SPECIALTY SAFETY ALERTS',
    ],
    pomr: [
      'RINGKASAN KLINIS',
      'DAFTAR MASALAH AKTIF',
      'CROSS-SPECIALTY SAFETY ALERTS',
      'CATATAN SOAP',
    ],
    ringkasan: [
      'RINGKASAN KLINIS',
      'CATATAN SOAP',
      'CROSS-SPECIALTY SAFETY ALERTS',
    ],
    research_extract: [
      'RINGKASAN KLINIS',
      'EKSTRAKSI DATA LABORATORIUM',
      'RINGKASAN INTEGRITAS PRIVASI',
    ],
  };

  if (mode && requiredSections[mode]) {
    for (const sec of requiredSections[mode]) {
      if (!normalized.includes(sec)) {
        return `Missing required section header for mode "${mode}": ${sec}`;
      }
    }
  } else if (!normalized.includes('RINGKASAN KLINIS')) {
    return 'Missing required section header: RINGKASAN KLINIS';
  }

  return null;
}

/**
 * Validates a generated Markdown clinical note through three safety layers:
 *   1. Structural Header Validation (mode-aware required sections, no raw JSON)
 *   2. Token Invariant Assertion (all sanitized tokens like [PATIENT_1] survive verbatim)
 *   3. Anti-Leakage Scan (blocks 16-digit NIK, unmasked phone, email, SSN)
 */
export function runMarkdownGuardrail(
  markdown: string,
  sanitizedText: string,
  mode?: MarkdownSynthesizerMode,
): MarkdownGuardrailResult {
  // Layer 1: Structural header validation
  const structError = validateMarkdownStructure(markdown, mode);
  if (structError) {
    return {
      status: 'schema_error',
      reason: structError,
    };
  }

  // Layer 2: Token invariant assertion
  const originalTokens = extractTokens(sanitizedText);
  const tokenError = assertTokensIntact(originalTokens, markdown);
  if (tokenError) {
    return {
      status: 'token_leak',
      reason: tokenError,
    };
  }

  // Layer 3: Anti-leakage scan
  const leakageError = scanForLeakage(markdown);
  if (leakageError) {
    return {
      status: 'phi_leak',
      reason: leakageError,
    };
  }

  return { status: 'pass', output: markdown };
}

/**
 * Replaces all tokens in a Markdown string with real patient identifiers.
 * Runs 100% locally in browser memory.
 */
export function reidentifyMarkdown(
  markdown: string,
  tokenMap: Map<string, string>,
): string {
  if (tokenMap.size === 0) return markdown;

  let result = markdown;
  for (const [token, realValue] of tokenMap) {
    const escaped = token.replace(/[[\]]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), realValue);
  }
  return result;
}

