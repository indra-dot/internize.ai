/**
 * cloudSynthesizer.ts
 * ====================
 * Client-side Tier 3 Cloud Synthesizer service for internize.ai using
 * Google Gemini Interactions API (BYOK - Bring Your Own Key).
 *
 * Architecture:
 *   Browser (raw clinical text)
 *     ──1. Sanitize──► Sanitized text with [PATIENT_1], [AGE_1], etc.
 *     ──2. Extract───► CROGE deterministic vitals, labs, problems
 *     ──3. Direct────► Google Gemini Interactions API (POST /v1beta/interactions)
 *                      with `store: false` (Zero retention on Google Cloud)
 *     ──4. Guardrail─► JSON non-empty + token invariant + anti-leakage check
 *                      (Structural markdown validation removed; Gemini now returns JSON)
 *     ──5. Re-ID─────► Swap tokens back in browser memory
 *
 * Privacy Invariants:
 *   - Raw patient identifiers NEVER leave the browser memory.
 *   - Only de-identified sanitized text with replacement tokens reaches Google Gemini.
 *   - `store: false` ensures Google does NOT persist clinical prompts in cloud interaction history.
 *   - The token map is kept strictly in-memory (chrome.storage.session).
 *   - Re-identification happens 100% client-side after the guardrail passes.
 */

import {
  DEFAULT_GEMINI_MODEL,
  INTERACTIONS_API_REVISION,
  loadGeminiConfig,
} from '../gemini/client';
import {
  type MarkdownGuardrailResult,
  type SpPdSynthesisOutput,
  reidentifyMarkdown,
  extractTokens,
} from './cloudGuardrail';
import { deidentifyText } from '../deid/deidentifier';
import {
  InternalMedicineEngine,
  extractLabTrendsAndAbnormal,
  extractVitals,
  identifySpPdProblems,
} from './internalMedicineEngine';
import {
  formatAriscatLine,
  formatRcriLine,
  formatImproveLine,
  formatCapriniLine,
  CONSENSUS_OPTIMAL_CONDITIONS,
} from './protocols';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CloudSynthesizerMode = 'konsul' | 'pomr' | 'ringkasan' | 'research_extract';

export type CloudSynthesizerStatus =
  | 'idle'
  | 'sanitizing'
  | 'sending'
  | 'validating'
  | 'reidentifying'
  | 'done'
  | 'error'
  | 'timeout'
  | 'fallback';

export interface CloudSynthesizerOptions {
  mode: CloudSynthesizerMode;
  /** If true, re-identifies the output before returning. Default: true */
  reidentify?: boolean;
  /** Timeout in ms. Default: undefined (no auto-timeout, cancellable via abort) */
  timeoutMs?: number;
  /** AbortSignal for explicit user cancellation */
  signal?: AbortSignal;
  /** Progress callback for UI status updates */
  onStatus?: (status: CloudSynthesizerStatus, detail?: string) => void;
  /** Surgical urgency mode for pre-operative clearance grounding */
  surgicalUrgency?: 'elektif' | 'life_saving';
}

// ─── Structured Output Interfaces ────────────────────────────────────────────

export interface RisikoTindakan {
  nama_skor: string;
  poin: string;
  interpretasi: string;
  level_risiko: 'low' | 'moderate' | 'high' | 'critical';
}

export interface EvaluasiPreoperatif {
  status_toleransi: string;
  risiko_tindakan: RisikoTindakan[];
  target_optimalisasi: string[];
}

export interface ProblemPlanning {
  dx: string;
  tx: string;
  mx: string;
  ex: string;
}

export interface GeminiProblem {
  nama_masalah: string;
  divisi_papdi: string;
  urgensi: 'cito' | 'high' | 'moderate' | 'routine';
  clinical_reasoning: string;
  planning: ProblemPlanning;
}

export interface GeminiStructuredOutput {
  hal_perlu_diperhatikan: string[];
  evaluasi_preoperatif: EvaluasiPreoperatif | null;
  jawab_konsul: string;
  problems: GeminiProblem[];
  ringkasan_emr: string;
}

export interface CloudSynthesizerResult {
  ok: boolean;
  /** Fully re-identified clipboard-ready plain-text EMR summary (ringkasan_emr) */
  markdown?: string;
  /** De-identified ringkasan_emr (pre-reidentification, for audit if needed) */
  sanitizedMarkdown?: string;
  /** Guardrail details */
  guardrail?: MarkdownGuardrailResult;
  /** Backward-compatible JSON output (derived from ringkasan_emr) */
  output?: SpPdSynthesisOutput;
  sanitizedOutput?: SpPdSynthesisOutput;
  /** Full structured JSON output from Gemini (re-identified) */
  structuredOutput?: GeminiStructuredOutput;
  /** Error or fallback reason */
  error?: string;
  /** Round-trip latency in ms (client-side measurement) */
  latencyMs?: number;
  /** Gemini reported or estimated processing latency */
  serverLatencyMs?: number;
}

// ─── In-browser Token Map Storage ───────────────────────────────────────────

function buildTokenMap(
  entities: Array<{ text: string; replacement: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entity of entities) {
    if (entity.replacement && entity.text) {
      map.set(entity.replacement, entity.text);
    }
  }
  return map;
}

let _sessionTokenMapCache: Map<string, string> = new Map();

async function saveTokenMapToSession(tokenMap: Map<string, string>): Promise<void> {
  _sessionTokenMapCache = tokenMap;
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const obj: Record<string, string> = {};
    for (const [k, v] of tokenMap) obj[k] = v;
    await chrome.storage.session.set({ cloudSynthTokenMap: obj });
  }
}

async function loadTokenMapFromSession(): Promise<Map<string, string>> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return new Promise((resolve) => {
      chrome.storage.session.get(['cloudSynthTokenMap'], (result) => {
        const obj = result.cloudSynthTokenMap as Record<string, string> | undefined;
        if (obj) {
          resolve(new Map(Object.entries(obj)));
        } else {
          resolve(_sessionTokenMapCache);
        }
      });
    });
  }
  return _sessionTokenMapCache;
}

// ─── System Prompt & Payload Construction ───────────────────────────────────

const SYSTEM_PROMPT = `You are "Internize Unified Clinical Synthesizer", an elite Board-Certified Senior Internist (Dokter Spesialis Penyakit Dalam / Sp.PD-K) serving as the PRIMARY clinical reasoning, diagnostic synthesis, and patient safety engine for internize.ai.

### CORE OPERATIONAL INVARIANTS:
1. STRICT TOKEN PRESERVATION (MANDATORY & ZERO PHI LEAKAGE):
   - The clinical text has been sanitized on-device for HIPAA Safe Harbor and Indonesia UU PDP No. 27/2022.
   - All patient identifiers exist strictly as bracketed tokens: [PATIENT_1], [AGE_1], [GENDER_1], [MRN_1], [HOSPITAL_1], [DOCTOR_1], [DATE_1], [PHONE_1], [ADDRESS_1].
   - You MUST carry these tokens VERBATIM into your output. NEVER attempt to guess, substitute, translate, or strip them. Never output real names, Indonesian NIK (16 digits), or real telephone numbers.

2. ZERO HALLUCINATION, STRICT GROUNDING & UNCERTAINTY HANDLING:
   - Base all reasoning EXCLUSIVELY on provided clinical narrative, vitals, and laboratory data.
   - If a diagnostic parameter is not provided in the prompt (e.g., eGFR/CrCl, HbA1c, elektrolit, status koagulasi), DO NOT fabricate normal or abnormal values. Explicitly state "Data belum tersedia" and propose it under planning.dx.
   - ABSOLUTE GUARDRAIL ON VITAL SIGNS & HEMODYNAMICS:
     If blood pressure (TD / Tensi), heart rate (HR / Nadi), respiratory rate (RR), temperature (Suhu), or SpO2 are NOT explicitly supplied in the input narrative or structured vitals, YOU MUST NEVER INVENT OR ASSERT THEM AS CLINICAL FACTS.
     DO NOT state "tekanan darah yang sangat rendah", "pasien hipotensi", "syok hipovolemik", "takikardia", "febris", or any vital sign abnormality as an observed clinical finding!
     If etiology indicates pre-renal AKI or hypovolemic hyponatremia without blood pressure data, attribute it strictly to "kecurigaan deplesi volume intravaskular / low intake / dehidrasi" without asserting that blood pressure is currently low or hypotensive. Mandate vital sign measurement strictly under planning.mx ("Monitoring ketat tekanan darah, frekuensi nadi, balans cairan").
   - Distinguish strictly between:
     a. Primary Active Problem (masalah akut dominan saat ini)
     b. Stable Comorbidity / Chronic Condition (komorbiditas kronis stabil)
     c. Pertinent Negative (tanda/gejala yang disangkal tapi krusial menyingkirkan diagnosis banding)
     d. Riwayat Penyakit Dahulu (RPD) vs Riwayat Penyakit Keluarga (RPK).

3. INDONESIAN CLINICAL ENVIRONMENT (STANDAR PAPDI & FORMULARIUM NASIONAL):
   - Formulate diagnostic synthesis and therapeutic recommendations in professional, concise Indonesian medical phrasing aligned with PAPDI guidelines.
   - For internal medicine conditions, map every active issue into the appropriate PAPDI division: Ginjal-Hipertensi, Endokrin-Metabolik, Tropik-Infeksi, Kardiologi, Pulmonologi, Gastroenterohepatologi, Hematologi-Onkologi, Reumatologi, Alergi-Imunologi, Geriatri, Psikosomatik.
   - CRITICAL GUARDRAIL FOR CROSS-SPECIALTY CONDITIONS:
     If an active problem belongs to a clinical specialty outside internal medicine (such as Neurologi/Saraf for kejang, konvulsivus, status epileptikus, stroke, ensefalopati, meningitis, penurunan kesadaran intrakranial; Bedah Saraf for EDH, SAH, SDH, ICH, cedera/trauma kepala; Bedah Umum/Digestif/Ortopedi/Obsgyn), YOU MUST NEVER CLASSIFY IT AS PSIKOSOMATIK! Classify it accurately as "Neurologi / Saraf", "Bedah Saraf", or "Lintas Disiplin / Konsul Sejawat". Divisi Psikosomatik strictly applies ONLY to functional somatoform disorders, functional palpitations, and secondary anxiety/panic.
   - Therapeutic regimens MUST align with Indonesian clinical practice (BPJS/Fornas formulary considerations; gunakan nama generik resmi obat).

4. MULTI-ORGAN SAFETY & COMPREHENSIVE LABORATORY AUDIT (CRITICAL):
   - Comprehensive Laboratory Audit: Thoroughly inspect and interpret ALL laboratory findings present in the patient note and table (hematology Hb/Leu/Plt, renal BUN/Cr, transaminases SGOT/SGPT, electrolytes Na/K/Cl, coagulation PT/APTT/INR, blood gas AGD, blood glucose GDS/GDP/HbA1c, biomarkers). Cross-reference with the local engine grounding. If any lab values in the text were missed or abnormal, YOU MUST explicitly flag and integrate them into clinical reasoning, safety alerts, and problem lists.
   - Renal: Cross-reference drugs against renal function. Flag nephrotoxic agents (NSAIDs, aminoglikosida, kontras) and explicitly note renal dose adjustments.
   - Hepatic: Audit hepatotoxic agents (misal: parasetamol dosis tinggi, statin, OAT) against liver enzyme trends.
   - Cardiac/QTc: Screen for concomitant QTc-prolonging drugs (misal: fluorokuinolon + ondansetron + makrolida) and electrolyte triggers (hipokalemia, hipomagnesemia).
   - Bleeding/Hemostasis: Audit antiplatelet/antikoagulan terhadap trombositopenia atau risiko perdarahan aktif.

5. OUTPUT FORMAT CONSTRAINT — STRICT JSON ONLY:
   - You MUST output ONLY a raw JSON object. Do NOT wrap it in markdown fences (\`\`\`json ... \`\`\`). Do NOT prepend or append any explanatory text.
   - The JSON object MUST match the schema below exactly. All string values must be in Indonesian medical language.

================================================================================
### JSON OUTPUT SCHEMA

{
  "hal_perlu_diperhatikan": [
    // Array of strings — cross-specialty safety alerts, drug interactions, critical flags.
    // Each entry is one concise alert sentence in Indonesian.
  ],
  "evaluasi_preoperatif": {
    // ONLY populate this object when MODE === "konsul". For MODE "pomr" or "ringkasan", set this field to null.
    "status_toleransi": "string — one of: LAIK OPERASI / LAIK OPERASI DENGAN CATATAN / TUNDA OPERASI ELEKTIF / PROSEDUR BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL",
    "risiko_tindakan": [
      // Populate ALL four scores below for MODE "konsul". For each score provide:
      {
        "nama_skor": "string — exact name: 'ARISCAT score' | 'Revised Cardiac Risk Index' | 'Improved bleeding risk score' | 'Caprini VTE score'",
        "poin": "string — score number/value, e.g. '33 points', '0 point', '3.5 points', '15 points'",
        "interpretasi": "string — EXACT English risk string. NEVER translate to Indonesian! E.g. '13.3% risk of in-hospital post-op pulmonary complication', '3.9% 30 day risk of death, MI, or cardiac arrest', 'No increased risk of bleeding' or 'Increased risk of bleeding', '10.7% VTE risk'",
        "level_risiko": "low | moderate | high | critical"
      }
    ],
    "target_optimalisasi": [
      // FIXED CONSENSUS TEMPLATE — NEVER ALTER OR INVENT ITEMS:
      "TD < 160/90 mmHg",
      "BS < 200 mg/dL",
      "SC < 7 gr/dL",
      "HB >10gr/dL",
      "K 3.5 -5.5 mmo/L",
      "Eutiroid/Subklinis"
    ]
  },
  "jawab_konsul": "string — the complete, formal consultation answer. For MODE 'konsul', follow the exact draft template starting directly with 'Saat ini dengan risiko tindakan :', then 'Optimal dilakukan tindakan apabila :', and 'Advis & Rekomendasi Sp.PD:' (A. Pre-Operatif, B. Intra-Operatif, C. Post-Operatif & Rawat Bersama). For MODE 'pomr' or 'ringkasan', this may be an empty string.",
  "problems": [
    {
      "nama_masalah": "string — problem/diagnosis name (Indonesian medical terminology)",
      "divisi_papdi": "string — PAPDI division OR external cross-specialty ('Neurologi / Saraf', 'Bedah Saraf', 'Bedah / Lintas Disiplin', etc.)",
      "urgensi": "cito | high | moderate | routine",
      "clinical_reasoning": "string — evidence-based rationale linking history, examination, and lab findings to this diagnosis",
      "planning": {
        "dx": "string — Plan Diagnostik: further investigations needed",
        "tx": "string — Plan Terapeutik: full drug regimen (generic name, dose, route, frequency, duration) per FORNAS",
        "mx": "string — Plan Monitoring: specific vital signs, fluid balance, serial labs",
        "ex": "string — Plan Edukasi: patient/family education points"
      }
    }
  ],
  "ringkasan_emr": "string — A clean, plain-text EMR-ready summary paragraph (NO markdown syntax, no bullet points, no headers) combining: one-liner patient synopsis, dominant clinical syndrome, haemodynamic status, active problem summary, and key therapeutic plan. Carry all PHI tokens verbatim."
}

================================================================================
### MODE-SPECIFIC RULES:
- Mode "konsul":
    • Populate evaluasi_preoperatif with all four scores using the exact English risk string:
      - ARISCAT score [X] points ([Y]% risk of in-hospital post-op pulmonary complication)
      - Revised Cardiac Risk Index [X] point ([Y]% 30 day risk of death, MI, or cardiac arrest)
      - Improved bleeding risk score [X] points (No increased risk of bleeding) OR (Increased risk of bleeding)
      - Caprini VTE score [X] points ([Y]% VTE risk)
      NEVER translate these scoring lines or risk percentages to Indonesian.
    • target_optimalisasi MUST be the EXACT 6 fixed consensus items:
      ["TD < 160/90 mmHg", "BS < 200 mg/dL", "SC < 7 gr/dL", "HB >10gr/dL", "K 3.5 -5.5 mmo/L", "Eutiroid/Subklinis"]
      NEVER replace or invent dynamic optimization targets here! Put patient-specific instructions under Advis A. Pre-Operatif.
    • jawab_konsul MUST strictly begin with 'Saat ini dengan risiko tindakan :' and use this exact draft template:

Saat ini dengan risiko tindakan :
ARISCAT score [X] points ([Y]% risk of in-hospital post-op pulmonary complication)
Revised Cardiac Risk Index [X] point ([Y]% 30 day risk of death, MI, or cardiac arrest)
Improved bleeding risk score [X] points ([Z])
Caprini VTE score [X] points ([W]% VTE risk)

Optimal dilakukan tindakan apabila :
TD < 160/90 mmHg
BS < 200 mg/dL
SC < 7 gr/dL
HB >10gr/dL
K 3.5 -5.5 mmo/L
Eutiroid/Subklinis

Advis & Rekomendasi Sp.PD:
A. Pre-Operatif:
	• [Instruksi puasa, hidrasi, penyesuaian obat, target optimalisasi spesifik pasien]
B. Intra-Operatif:
	• [Monitoring hemodinamik, MAP, cairan, EKG spesifik pasien]
C. Post-Operatif & Rawat Bersama:
	• [Ruang perawatan pasca-bedah, serial lab monitoring, evaluasi komorbid spesifik pasien]
    • problems must list all active medical issues relevant to perioperative management.
    • hal_perlu_diperhatikan must include perioperative drug management instructions.

- Mode "pomr":
    • Set evaluasi_preoperatif to null.
    • jawab_konsul may be an empty string "".
    • problems must cover all 11 PAPDI divisions that are active; include SOAP-style reasoning in clinical_reasoning.
    • hal_perlu_diperhatikan must include cross-specialty safety alerts.

- Mode "ringkasan":
    • Set evaluasi_preoperatif to null.
    • jawab_konsul may be an empty string "".
    • problems should be a concise list of the dominant active problems.
    • ringkasan_emr is the primary output: a handoff-ready SBAR-style plain-text paragraph.

- Mode "research_extract":
    • Set evaluasi_preoperatif to null.
    • jawab_konsul may be an empty string "".
    • problems should list the clinical problems with LOINC-mapped lab findings in clinical_reasoning.
    • ringkasan_emr should include a Safe Harbor privacy integrity summary.

OUTPUT REMINDER: Return ONLY the JSON object. No markdown. No intro. No outro.`;

function buildUserPrompt(
  sanitizedText: string,
  vitalsStr: string,
  labsStr: string,
  problemsStr: string,
  mode: CloudSynthesizerMode,
  options?: {
    surgicalUrgency?: 'elektif' | 'life_saving';
    toleranceStatus?: string;
    toleranceReason?: string;
    renalSummary?: string;
    hepaticSummary?: string;
    hazardAlerts?: string[];
  },
): string {
  let prompt = `[MODE OPERASIONAL AKTIF]:
${mode}

[ANAMNESIS & PEMERIKSAAN FISIK TER-SANITASI]:
${sanitizedText}

[DATA TERSTRUKTUR ENGINE LOKAL (DETERMINISTIC GROUNDING ANCHOR)]:
- Tanda Vital: ${vitalsStr}
- Laboratorium Abnormal & Serial: ${labsStr}
- Baseline Deteksi Masalah Awal: ${problemsStr}`;

  if (options?.renalSummary) {
    prompt += `\n- Evaluasi Fungsi Ginjal (CKD-EPI / CrCl): ${options.renalSummary}`;
  }
  if (options?.hepaticSummary) {
    prompt += `\n- Evaluasi Hepar & Transaminase: ${options.hepaticSummary}`;
  }
  if (options?.hazardAlerts && options.hazardAlerts.length > 0) {
    prompt += `\n- Peringatan Keselamatan Fatal (CROGE Drug Safety Guard): ${options.hazardAlerts.join('; ')}`;
  }

  if (mode === 'konsul') {
    const urgLabel = options?.surgicalUrgency === 'life_saving' ? 'CITO / LIFE-SAVING EMERGENCY' : 'OPERASI ELEKTIF TERENCANA';
    prompt += `\n- Urgensi Prosedur Bedah: ${urgLabel}`;
    if (options?.toleranceStatus) {
      prompt += `\n- Status Toleransi Operasi (Target Deterministic): ${options.toleranceStatus}`;
      prompt += `\n- Dasar Medis Toleransi: ${options.toleranceReason}`;
    }
  }

  return prompt;
}

/**
 * Extracts generated text from either the modern Interactions API response
 * (steps or outputs) or legacy generateContent response format.
 */
function extractResponseText(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const res = json as Record<string, unknown>;

  // Interactions API SDK convenience sugar
  if (typeof res.output_text === 'string' && res.output_text.trim()) {
    return res.output_text;
  }

  // Modern Interactions API steps schema (Api-Revision: 2026-05-20)
  if (Array.isArray(res.steps)) {
    for (let i = res.steps.length - 1; i >= 0; i--) {
      const step = res.steps[i] as Record<string, unknown>;
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        const textParts = step.content
          .filter((c: unknown) => {
            const part = c as Record<string, unknown>;
            return part.type === 'text' && typeof part.text === 'string';
          })
          .map((c: unknown) => (c as Record<string, unknown>).text as string);
        if (textParts.length > 0) return textParts.join('');
      }
    }
  }

  // Interactions API legacy outputs array
  if (Array.isArray(res.outputs)) {
    const last = res.outputs[res.outputs.length - 1] as Record<string, unknown> | undefined;
    if (last && typeof last.text === 'string') return last.text;
  }

  // Legacy generateContent fallback
  const candidateParts = (res.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as
    | Record<string, unknown>
    | undefined;
  const parts = candidateParts?.parts as Array<Record<string, unknown>> | undefined;
  if (parts && typeof parts[0]?.text === 'string') {
    return parts[0].text;
  }

  return null;
}

/**
 * Attempts to parse the raw Gemini response as a GeminiStructuredOutput JSON object.
 * Handles markdown fences gracefully if the model wraps the JSON despite instructions.
 */
function extractStructuredOutput(raw: string): GeminiStructuredOutput | null {
  let jsonStr = raw.trim();

  // Strip markdown fences if present (model may disobey despite instructions)
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(jsonStr);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  // Slice to first/last brace to handle any leading/trailing noise
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(jsonStr) as GeminiStructuredOutput;
  } catch {
    return null;
  }
}

function normalizePreopDraft(
  rawJawabKonsul: string,
  preop: EvaluasiPreoperatif | null,
  groundingScores?: {
    ariscatScore?: number | null;
    rcriScore?: number;
    improveScore?: number | null;
    capriniScore?: number | null;
  },
): { jawabKonsul: string; evaluasiPreop: EvaluasiPreoperatif | null } {
  // 1. Extract numerical scores from text or preop structure or grounding
  let ariscatVal: number | null = groundingScores?.ariscatScore ?? null;
  const ariscatMatch = /ariscat(?: score)?\D*?(\d+)/i.exec(rawJawabKonsul);
  if (ariscatMatch) {
    ariscatVal = parseInt(ariscatMatch[1], 10);
  } else if (preop?.risiko_tindakan) {
    const item = preop.risiko_tindakan.find((r) => /ariscat/i.test(r.nama_skor));
    const m = item && /(\d+)/.exec(item.poin);
    if (m) ariscatVal = parseInt(m[1], 10);
  }
  if (ariscatVal === null) ariscatVal = 33;

  let rcriVal = groundingScores?.rcriScore ?? 0;
  const rcriMatch = /(?:revised cardiac risk index|rcri)\D*?(\d+)/i.exec(rawJawabKonsul);
  if (rcriMatch) {
    rcriVal = parseInt(rcriMatch[1], 10);
  } else if (preop?.risiko_tindakan) {
    const item = preop.risiko_tindakan.find((r) => /revised cardiac|rcri/i.test(r.nama_skor));
    const m = item && /(\d+)/.exec(item.poin);
    if (m) rcriVal = parseInt(m[1], 10);
  }

  let improveVal: number | null = groundingScores?.improveScore ?? null;
  const improveMatch = /improve[d]?\s*(?:bleeding risk score)?\D*?([\d\.]+)/i.exec(rawJawabKonsul);
  if (improveMatch) {
    improveVal = parseFloat(improveMatch[1]);
  } else if (preop?.risiko_tindakan) {
    const item = preop.risiko_tindakan.find((r) => /improve/i.test(r.nama_skor));
    const m = item && /([\d\.]+)/.exec(item.poin);
    if (m) improveVal = parseFloat(m[1]);
  }
  if (improveVal === null || isNaN(improveVal)) improveVal = 3.5;

  let capriniVal: number | null = groundingScores?.capriniScore ?? null;
  const capriniMatch = /caprini(?: vte score)?\D*?(\d+)/i.exec(rawJawabKonsul);
  if (capriniMatch) {
    capriniVal = parseInt(capriniMatch[1], 10);
  } else if (preop?.risiko_tindakan) {
    const item = preop.risiko_tindakan.find((r) => /caprini/i.test(r.nama_skor));
    const m = item && /(\d+)/.exec(item.poin);
    if (m) capriniVal = parseInt(m[1], 10);
  }
  if (capriniVal === null) capriniVal = 15;

  // 2. Format standard risk score lines using exact clinical rules
  const ariscatLine = formatAriscatLine(ariscatVal);
  const rcriLine = formatRcriLine(rcriVal);
  const improveLine = formatImproveLine(improveVal);
  const capriniLine = formatCapriniLine(capriniVal);

  // 3. Extract Advis & Rekomendasi Sp.PD from rawJawabKonsul
  let advisBody = '';
  const advisMatch = /(?:Advis & Rekomendasi|Rekomendasi Sp\.PD|A\.\s*Pre-Operatif)[\s\S]*$/i.exec(rawJawabKonsul);
  if (advisMatch) {
    advisBody = advisMatch[0].trim();
    if (!/^advis\s*&/i.test(advisBody)) {
      advisBody = `Advis & Rekomendasi Sp.PD:\n${advisBody}`;
    }
  } else {
    advisBody = [
      'Advis & Rekomendasi Sp.PD:',
      'A. Pre-Operatif:',
      '\t• Puasa sesuai instruksi bedah/anestesi, pasang NGT sesuai indikasi.',
      '\t• Evaluasi serial elektrolit dan balans cairan berkala.',
      'B. Intra-Operatif:',
      '\t• Monitoring hemodinamik ketat (MAP, Nadi, SpO2) dan cegah hipotensi.',
      'C. Post-Operatif & Rawat Bersama:',
      '\t• Perawatan intensif (ICU/HCU) bersama TS Bedah dan Anestesi.',
      '\t• Monitoring serial laboratorium darah lengkap dan faal organ.',
    ].join('\n');
  }

  // 4. Construct complete, consistent draft
  const finalJawabKonsul = [
    'Saat ini dengan risiko tindakan :',
    ariscatLine,
    rcriLine,
    improveLine,
    capriniLine,
    '',
    'Optimal dilakukan tindakan apabila :',
    ...CONSENSUS_OPTIMAL_CONDITIONS,
    '',
    advisBody,
  ].join('\n');

  // 5. Update evaluasiPreop structured object for UI cards
  const normalizedEvaluasiPreop: EvaluasiPreoperatif = {
    status_toleransi: preop?.status_toleransi || 'LAIK OPERASI DENGAN CATATAN',
    target_optimalisasi: [...CONSENSUS_OPTIMAL_CONDITIONS],
    risiko_tindakan: [
      {
        nama_skor: 'ARISCAT score',
        poin: `${ariscatVal} points`,
        interpretasi: ariscatLine.replace(/^.*?\((.*?)\)$/, '$1'),
        level_risiko: ariscatVal >= 45 ? 'high' : ariscatVal >= 26 ? 'moderate' : 'low',
      },
      {
        nama_skor: 'Revised Cardiac Risk Index',
        poin: `${rcriVal} point`,
        interpretasi: rcriLine.replace(/^.*?\((.*?)\)$/, '$1'),
        level_risiko: rcriVal >= 2 ? 'high' : rcriVal === 1 ? 'moderate' : 'low',
      },
      {
        nama_skor: 'Improved bleeding risk score',
        poin: `${improveVal} points`,
        interpretasi: improveLine.replace(/^.*?\((.*?)\)$/, '$1'),
        level_risiko: improveVal >= 7 ? 'high' : 'low',
      },
      {
        nama_skor: 'Caprini VTE score',
        poin: `${capriniVal} points`,
        interpretasi: capriniLine.replace(/^.*?\((.*?)\)$/, '$1'),
        level_risiko: capriniVal >= 5 ? 'high' : capriniVal >= 3 ? 'moderate' : 'low',
      },
    ],
  };

  return { jawabKonsul: finalJawabKonsul, evaluasiPreop: normalizedEvaluasiPreop };
}

/**
 * Applies token re-identification to every string field in a GeminiStructuredOutput.
 * Runs 100% in browser memory — token map never leaves the client.
 */
function reidentifyStructuredOutput(
  output: GeminiStructuredOutput,
  tokenMap: Map<string, string>,
): GeminiStructuredOutput {
  const reId = (s: string) => reidentifyMarkdown(s, tokenMap);
  const reidentifiedPreop = output.evaluasi_preoperatif
    ? {
        ...output.evaluasi_preoperatif,
        status_toleransi: reId(output.evaluasi_preoperatif.status_toleransi),
        target_optimalisasi: output.evaluasi_preoperatif.target_optimalisasi.map(reId),
        risiko_tindakan: output.evaluasi_preoperatif.risiko_tindakan,
      }
    : null;

  return {
    ...output,
    hal_perlu_diperhatikan: output.hal_perlu_diperhatikan.map(reId),
    jawab_konsul: reId(output.jawab_konsul),
    problems: output.problems.map((p) => ({
      ...p,
      clinical_reasoning: reId(p.clinical_reasoning),
      planning: {
        dx: reId(p.planning.dx),
        tx: reId(p.planning.tx),
        mx: reId(p.planning.mx),
        ex: reId(p.planning.ex),
      },
    })),
    ringkasan_emr: reId(output.ringkasan_emr),
    evaluasi_preoperatif: reidentifiedPreop,
  };
}

/**
 * Post-processing guardrail against hallucinated vital sign claims (Layer 2).
 * If the input note does not record blood pressure, sanitize assertions that claim
 * the patient has low blood pressure / severe hypotension, replacing them with
 * clinically sound phrasing (e.g. suspicion of intravascular volume depletion).
 */
export function sanitizeVitalHallucinations(
  output: GeminiStructuredOutput,
  hasRecordedBp: boolean,
): GeminiStructuredOutput {
  if (hasRecordedBp) return output;

  const sanitizeText = (text: string): string => {
    if (!text) return text;
    let cleaned = text;

    // Specific pattern: "tekanan darah yang sangat rendah memperberat perfusi ginjal"
    cleaned = cleaned.replace(
      /tekanan\s+darah\s+(?:yang\s+)?(?:sangat\s+)?rendah\s+memperberat\s+perfusi\s+ginjal/gi,
      'Kecurigaan penurunan volume intravaskular memperberat perfusi ginjal',
    );
    // General pattern: "tekanan darah yang sangat rendah" / "tekanan darah sangat rendah"
    cleaned = cleaned.replace(
      /tekanan\s+darah\s+(?:yang\s+)?sangat\s+rendah/gi,
      'kecurigaan penurunan volume intravaskular',
    );
    // General pattern: "tekanan darah rendah"
    cleaned = cleaned.replace(
      /tekanan\s+darah\s+rendah/gi,
      'kecurigaan deplesi volume intravaskular',
    );
    // Pattern: "hipotensi memperberat perfusi"
    cleaned = cleaned.replace(
      /hipotensi\s+memperberat\s+perfusi/gi,
      'deplesi volume intravaskular memperberat perfusi',
    );
    // Pattern: "pasien mengalami hipotensi"
    cleaned = cleaned.replace(
      /pasien\s+(?:mengalami|dalam\s+kondisi)\s+hipotensi/gi,
      'pasien dicurigai mengalami penurunan volume intravaskular',
    );
    // Pattern: "kondisi hipotensi"
    cleaned = cleaned.replace(
      /kondisi\s+hipotensi/gi,
      'kondisi kemungkinan hipovolemia',
    );

    return cleaned;
  };

  return {
    ...output,
    hal_perlu_diperhatikan: output.hal_perlu_diperhatikan.map(sanitizeText),
    jawab_konsul: sanitizeText(output.jawab_konsul),
    ringkasan_emr: sanitizeText(output.ringkasan_emr),
    problems: output.problems.map((p) => ({
      ...p,
      clinical_reasoning: sanitizeText(p.clinical_reasoning),
      planning: {
        dx: sanitizeText(p.planning.dx),
        tx: sanitizeText(p.planning.tx),
        mx: sanitizeText(p.planning.mx),
        ex: sanitizeText(p.planning.ex),
      },
    })),
  };
}

function buildCompatibleOutput(markdown: string): SpPdSynthesisOutput {
  const lines = markdown.split('\n').map((l) => l.trim()).filter(Boolean);
  const summaryOneLiner = lines[0] || 'Ringkasan klinis terlampir pada catatan EMR.';

  return {
    summary_one_liner: summaryOneLiner,
    problem_list: [],
    pertinent_negatives: [],
    cross_specialty_safety_alerts: {
      renal_risk: 'Lihat structured output (hal_perlu_diperhatikan)',
      hepatic_risk: 'Lihat structured output (hal_perlu_diperhatikan)',
      cardiac_qtc_risk: 'Lihat structured output (hal_perlu_diperhatikan)',
      bleeding_hemostasis_risk: 'Lihat structured output (hal_perlu_diperhatikan)',
    },
    soap_note: {
      subjective: 'Lihat structured output (ringkasan_emr)',
      objective: 'Lihat structured output (ringkasan_emr)',
      assessment: 'Lihat structured output (ringkasan_emr)',
      plan: {
        diagnostik: [],
        terapeutik: [],
        monitoring: [],
        edukasi: [],
      },
    },
  };
}

// ─── JSON-mode Guardrail ────────────────────────────────────────────────────

/**
 * Simplified guardrail for JSON output mode.
 *
 * NOTE: The previous markdown structural-header validation has been removed
 * because Gemini now returns structured JSON, not free-form Markdown.
 * This guardrail focuses on:
 *   Layer 1 — Non-empty JSON parse validation (output is parseable & has required top-level keys).
 *   Layer 2 — Token Invariant Assertion (all [TOKEN_N] tokens from sanitized text survive).
 *   Layer 3 — Anti-Leakage Scan (no raw NIK, phone, email patterns in the JSON string).
 */
function runJsonGuardrail(
  structured: GeminiStructuredOutput,
  rawJsonStr: string,
  sanitizedText: string,
): MarkdownGuardrailResult {
  // Layer 1: Basic required-field presence
  if (!structured.ringkasan_emr || structured.ringkasan_emr.trim() === '') {
    return {
      status: 'schema_error',
      reason: 'ringkasan_emr is empty — Gemini output is incomplete.',
    };
  }
  if (!Array.isArray(structured.problems)) {
    return {
      status: 'schema_error',
      reason: '"problems" field is missing or not an array in Gemini JSON output.',
    };
  }

  // Layer 2: Token invariant assertion
  const originalTokens = extractTokens(sanitizedText);
  if (originalTokens.length > 0) {
    const missing = originalTokens.filter((tok) => !rawJsonStr.includes(tok));
    if (missing.length > 0) {
      return {
        status: 'token_leak',
        reason: `Token invariant violated — missing tokens in JSON output: ${missing.join(', ')}`,
      };
    }
  }

  // Layer 3: Anti-leakage scan (reuse patterns inline)
  const PHI_LEAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: 'NIK (16-digit)', pattern: /\b\d{16}\b/ },
    { name: 'Indonesian phone (+62)', pattern: /\+62\s?8\d{7,11}\b/ },
    { name: 'Indonesian phone (08xx)', pattern: /\b08\d{7,11}\b/ },
    { name: 'IPv4 address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
    { name: 'Email address', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i },
    { name: 'SSN pattern', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  ];
  for (const { name, pattern } of PHI_LEAK_PATTERNS) {
    if (pattern.test(rawJsonStr)) {
      return {
        status: 'phi_leak',
        reason: `PHI leakage detected: ${name} pattern found in Gemini JSON response`,
      };
    }
  }

  return { status: 'pass', output: structured.ringkasan_emr };
}

// ─── Main Synthesizer Runner ────────────────────────────────────────────────

export async function runCloudSynthesizer(
  rawText: string,
  options: CloudSynthesizerOptions,
): Promise<CloudSynthesizerResult> {
  const {
    mode,
    reidentify = true,
    timeoutMs,
    signal,
    onStatus,
  } = options;

  const t0 = performance.now();

  // ── Step 1: Check Gemini API Key ──────────────────────────────────────────
  const geminiConfig = await loadGeminiConfig();
  if (!geminiConfig?.apiKey) {
    return {
      ok: false,
      error: 'Google Gemini API Key belum dikonfigurasi. Masukkan API Key di tab Settings.',
    };
  }

  // ── Step 2: Sanitize (de-identify) clinical text locally ─────────────────
  onStatus?.('sanitizing', 'Melakukan sanitasi identitas pasien (tokenisasi lokal)...');
  const deidResult = deidentifyText(rawText);
  const sanitizedText = deidResult.redactedText;
  const tokenMap = buildTokenMap(deidResult.entities);

  await saveTokenMapToSession(tokenMap);

  // ── Step 3: Extract structured CROGE baseline from sanitized text ─────────
  const vitals = extractVitals(sanitizedText);
  const { abnormalLabs, labTrends } = extractLabTrendsAndAbnormal(sanitizedText);
  const activeProblems = identifySpPdProblems(sanitizedText, vitals, abnormalLabs);
  const safetyReport = InternalMedicineEngine.evaluateClinicalSafetyGuard(
    sanitizedText,
    vitals,
    abnormalLabs,
    labTrends,
  );

  const hasRecordedBp = Boolean((vitals.systolic && vitals.diastolic) || vitals.rawMatched.bp);
  const hasRecordedVitals = Boolean(
    hasRecordedBp ||
    vitals.heartRate ||
    vitals.respiratoryRate ||
    vitals.temperature ||
    vitals.spO2
  );

  const vitalsStr = hasRecordedVitals
    ? [
        vitals.systolic && vitals.diastolic ? `TD: ${vitals.systolic}/${vitals.diastolic} mmHg` : vitals.rawMatched.bp ? `TD: ${vitals.rawMatched.bp}` : null,
        vitals.heartRate ? `Nadi: ${vitals.heartRate} x/mnt` : null,
        vitals.respiratoryRate ? `RR: ${vitals.respiratoryRate} x/mnt` : null,
        vitals.temperature ? `Suhu: ${vitals.temperature} °C` : null,
        vitals.spO2 ? `SpO2: ${vitals.spO2} %` : null,
      ].filter(Boolean).join(', ')
    : 'TIDAK ADA DATA TANDA VITAL DI INPUT (DILARANG mengasumsikan nilai tensi, hipotensi, takikardia, atau febris)';

  const labsStr = abnormalLabs.length > 0
    ? abnormalLabs.map((l) => `- ${l.name}: ${l.value} ${l.unit} (${l.flag.toUpperCase()}) -> ${l.interpretation}`).join('\n')
    : 'Tidak ada lab abnormal signifikan yang terdeteksi';

  const problemsStr = activeProblems.length > 0
    ? activeProblems.map((p) => `- [${p.division}] ${p.title} (${p.criticality.toUpperCase()})`).join('\n')
    : 'Belum ada masalah spesifik terdeteksi otomatis';

  const renalSummary = safetyReport.renal.isImpaired
    ? `${safetyReport.renal.stage}, eGFR ${safetyReport.renal.eGfr ?? 'N/A'} mL/min, CrCl ${safetyReport.renal.crCl ?? 'N/A'} mL/min. Flagged drugs: ${safetyReport.renal.flaggedDrugs.map((d) => `${d.drug} (${d.action})`).join(', ') || 'Nihil'}`
    : 'Fungsi ginjal dalam rentang aman/preservasi';

  const hepaticSummary = safetyReport.hepatic.warning || (safetyReport.hepatic.isImpaired ? 'Kenaikan enzim hepar >3x ULN' : 'Transaminase hepar dalam batas aman');

  const hazardAlerts = safetyReport.hazards.map(
    (h) => `${h.title} [${h.severity.toUpperCase()}]: ${h.description} -> Rekomendasi: ${h.recommendation}`,
  );

  let consultAnswer: ReturnType<typeof InternalMedicineEngine.generateConsultationAnswer> | undefined;
  if (mode === 'konsul') {
    consultAnswer = InternalMedicineEngine.generateConsultationAnswer(
      sanitizedText,
      options.surgicalUrgency ?? 'elektif',
    );
  }

  const userPrompt = buildUserPrompt(sanitizedText, vitalsStr, labsStr, problemsStr, mode, {
    surgicalUrgency: options.surgicalUrgency,
    toleranceStatus: consultAnswer?.toleranceStatus,
    toleranceReason: consultAnswer?.toleranceReason,
    renalSummary,
    hepaticSummary,
    hazardAlerts,
  });

  // ── Step 4: Send to Google Gemini Interactions API ────────────────────────
  const model = geminiConfig.model || DEFAULT_GEMINI_MODEL;
  onStatus?.('sending', `Menghubungi Google Gemini Interactions API (${model})...`);

  const interactionsEndpoint = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${geminiConfig.apiKey}`;

  let rawTextOutput = '';

  try {
    const controller = new AbortController();

    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && timeoutMs > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    // Attempt 1: Modern Interactions API with store: false (Medical privacy invariant)
    let response = await fetch(interactionsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Revision': INTERACTIONS_API_REVISION,
      },
      body: JSON.stringify({
        model,
        input: userPrompt,
        system_instruction: SYSTEM_PROMPT,
        store: false, // Ensure prompt & outputs are ephemeral on Google Cloud
        response_format: {
          type: 'text',
          mime_type: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    // Attempt 2: Fallback to generateContent if interactions endpoint is 404/405
    if (response.status === 404 || response.status === 405) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiConfig.apiKey}`;
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });
    }

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      const errMsg = errJson?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      return {
        ok: false,
        error: `Gemini API Error: ${errMsg}`,
        latencyMs: Math.round(performance.now() - t0),
      };
    }

    const responseJson = await response.json();
    rawTextOutput = extractResponseText(responseJson) ?? '';

    if (!rawTextOutput) {
      return {
        ok: false,
        error: 'Gemini tidak mengembalikan teks output.',
        latencyMs: Math.round(performance.now() - t0),
      };
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    onStatus?.(isAbort ? 'fallback' : 'error', isAbort ? 'Dibatalkan oleh pengguna' : String(err));
    return {
      ok: false,
      error: isAbort
        ? 'Proses Cloud Synthesizer dibatalkan — beralih ke hasil CROGE lokal.'
        : `Network Error: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  // ── Step 5: Parse structured JSON output ─────────────────────────────────
  onStatus?.('validating', 'Memverifikasi struktur JSON & preservasi token...');

  const parsedOutput = extractStructuredOutput(rawTextOutput);
  if (!parsedOutput) {
    return {
      ok: false,
      error: 'Gemini tidak mengembalikan JSON yang valid. Coba ulangi atau periksa koneksi.',
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  // Reconstruct the normalized JSON string for guardrail scanning
  const normalizedJsonStr = JSON.stringify(parsedOutput);

  // ── Step 6: Guardrail validation (JSON mode) ──────────────────────────────
  const guardrail = runJsonGuardrail(parsedOutput, normalizedJsonStr, sanitizedText);

  if (guardrail.status !== 'pass') {
    console.error('[cloudSynthesizer] Guardrail gagal:', guardrail.reason);
    onStatus?.('fallback', `Guardrail: ${guardrail.status}`);
    return {
      ok: false,
      guardrail,
      error: `Guardrail keamanan memblokir respons (${guardrail.status}): ${guardrail.reason}`,
      latencyMs: Math.round(performance.now() - t0),
    };
  }

  // ── Step 7: Re-identify client-side ───────────────────────────────────────
  let finalOutput = parsedOutput;
  if (reidentify && tokenMap.size > 0) {
    onStatus?.('reidentifying', 'Melakukan re-identifikasi lokal di browser...');
    finalOutput = reidentifyStructuredOutput(parsedOutput, tokenMap);
  }

  // If in konsul mode, guarantee 100% adherence to standard pre-op clearance draft & consensus checklist
  if (mode === 'konsul') {
    const norm = normalizePreopDraft(
      finalOutput.jawab_konsul || '',
      finalOutput.evaluasi_preoperatif,
      consultAnswer
        ? {
            ariscatScore: consultAnswer.riskStratification.ariscatScore,
            rcriScore: consultAnswer.riskStratification.rcriLeeScore,
            improveScore: consultAnswer.riskStratification.improveBleedingScore,
            capriniScore: consultAnswer.riskStratification.capriniScore,
          }
        : undefined,
    );
    finalOutput = {
      ...finalOutput,
      jawab_konsul: norm.jawabKonsul,
      evaluasi_preoperatif: norm.evaluasiPreop,
    };
  }

  // ── Step 8: Anti-hallucination vital sign scrubber (Layer 2) ──────────────
  finalOutput = sanitizeVitalHallucinations(finalOutput, hasRecordedBp);

  onStatus?.('done', `Selesai (${Math.round(performance.now() - t0)}ms)`);

  return {
    ok: true,
    markdown: finalOutput.ringkasan_emr,           // backward compat: derived from ringkasan_emr
    sanitizedMarkdown: parsedOutput.ringkasan_emr,  // de-identified version for audit
    structuredOutput: finalOutput,
    output: buildCompatibleOutput(finalOutput.ringkasan_emr),
    guardrail,
    latencyMs: Math.round(performance.now() - t0),
  };
}

export async function getSessionTokenMap(): Promise<Map<string, string>> {
  return loadTokenMapFromSession();
}

export async function isCloudSynthesizerAvailable(): Promise<boolean> {
  const config = await loadGeminiConfig();
  return Boolean(config?.apiKey);
}
