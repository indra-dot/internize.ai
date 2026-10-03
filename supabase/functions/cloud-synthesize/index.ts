/**
 * Supabase Edge Function: cloud-synthesize
 * ==========================================
 * Tier 3 Cloud Clinical Synthesizer for internize.ai.
 *
 * Security Model:
 *   - Receives ONLY de-identified payload (tokens like [PATIENT_1], [MRN_1])
 *   - SUPABASE_GEMINI_API_KEY held in Supabase Vault — never exposed to browser
 *   - Returns structured JSON with tokens intact (re-id happens client-side only)
 *   - Anti-leakage: scans outgoing response for raw NIK / phone patterns before relay
 *
 * Invocation: POST /functions/v1/cloud-synthesize
 *   Body: CloudSynthesizeRequest (JSON)
 *   Returns: CloudSynthesizeResponse (JSON)
 *
 * Deploy: supabase functions deploy cloud-synthesize --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CloudSynthesizeRequest {
  /** Scrubbed clinical narrative with tokens (e.g. [PATIENT_1]) */
  sanitizedText: string;
  /** Structured labs/vitals already extracted by local CROGE engine */
  structuredData: {
    vitals?: {
      bp?: string;
      hr?: number | null;
      rr?: number | null;
      temp?: number | null;
      spo2?: number | null;
    };
    abnormalLabs?: Array<{
      name: string;
      value: number;
      unit: string;
      flag: string;
      interpretation: string;
    }>;
    activeProblems?: Array<{
      title: string;
      division: string;
      criticality: string;
    }>;
  };
  /** Workflow mode — influences the system prompt nuance */
  mode: 'konsul' | 'pomr' | 'ringkasan';
  /** Caller version for audit trail (no PHI) */
  clientVersion?: string;
}

interface CloudSynthesizeResponse {
  ok: boolean;
  /** Structured Sp.PD JSON output with tokens intact */
  result?: SpPdSynthesisOutput;
  /** Human-readable error message on failure */
  error?: string;
  /** Total Gemini API latency in ms */
  latencyMs?: number;
}

interface SpPdSynthesisOutput {
  summary_one_liner: string;
  problem_list: Array<{
    priority: number;
    division: string;
    diagnosis: string;
    evidence_rationale: string;
    differential_diagnoses: string[];
    urgency: 'cito' | 'high' | 'moderate' | 'routine';
  }>;
  pertinent_negatives: string[];
  cross_specialty_safety_alerts: {
    renal_risk: string;
    hepatic_risk: string;
    cardiac_qtc_risk: string;
    bleeding_hemostasis_risk: string;
  };
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: {
      diagnostik: string[];
      terapeutik: string[];
      monitoring: string[];
      edukasi: string[];
    };
  };
}

// ─── CORS headers ───────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
} as const;

// ─── Anti-leakage guard ──────────────────────────────────────────────────────

/**
 * Scans a JSON string for patterns that should NEVER appear in a de-identified
 * response: 16-digit NIK, Indonesian phone numbers (+62 / 08xx), raw IP addresses.
 * Throws if any leakage pattern is detected.
 */
function assertNoLeakage(jsonStr: string): void {
  const LEAKAGE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: 'NIK (16-digit)', pattern: /\b\d{16}\b/ },
    { name: 'Indonesian phone (+62)', pattern: /\+62\s?8\d{7,11}\b/ },
    { name: 'Indonesian phone (08xx)', pattern: /\b08\d{7,11}\b/ },
    { name: 'IPv4 address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  ];
  for (const { name, pattern } of LEAKAGE_PATTERNS) {
    if (pattern.test(jsonStr)) {
      throw new Error(`Anti-leakage violation: detected raw ${name} in cloud response`);
    }
  }
}

// ─── Gemini response_schema definition ──────────────────────────────────────

/** JSON Schema passed to Gemini via response_schema for guaranteed structure */
const SYNTHESIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary_one_liner: { type: 'string' },
    problem_list: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'integer' },
          division: { type: 'string' },
          diagnosis: { type: 'string' },
          evidence_rationale: { type: 'string' },
          differential_diagnoses: { type: 'array', items: { type: 'string' } },
          urgency: { type: 'string', enum: ['cito', 'high', 'moderate', 'routine'] },
        },
        required: ['priority', 'division', 'diagnosis', 'evidence_rationale', 'differential_diagnoses', 'urgency'],
      },
    },
    pertinent_negatives: { type: 'array', items: { type: 'string' } },
    cross_specialty_safety_alerts: {
      type: 'object',
      properties: {
        renal_risk: { type: 'string' },
        hepatic_risk: { type: 'string' },
        cardiac_qtc_risk: { type: 'string' },
        bleeding_hemostasis_risk: { type: 'string' },
      },
      required: ['renal_risk', 'hepatic_risk', 'cardiac_qtc_risk', 'bleeding_hemostasis_risk'],
    },
    soap_note: {
      type: 'object',
      properties: {
        subjective: { type: 'string' },
        objective: { type: 'string' },
        assessment: { type: 'string' },
        plan: {
          type: 'object',
          properties: {
            diagnostik: { type: 'array', items: { type: 'string' } },
            terapeutik: { type: 'array', items: { type: 'string' } },
            monitoring: { type: 'array', items: { type: 'string' } },
            edukasi: { type: 'array', items: { type: 'string' } },
          },
          required: ['diagnostik', 'terapeutik', 'monitoring', 'edukasi'],
        },
      },
      required: ['subjective', 'objective', 'assessment', 'plan'],
    },
  },
  required: [
    'summary_one_liner',
    'problem_list',
    'pertinent_negatives',
    'cross_specialty_safety_alerts',
    'soap_note',
  ],
};

// ─── System & User prompt builders ──────────────────────────────────────────

function buildSystemPrompt(mode: string): string {
  const modeNotes: Record<string, string> = {
    konsul:
      'Focus on Pre-Operative Clearance (RCRI Lee Risk Score, perioperative glucose/BP/anticoagulant advice), or Rawat Bersama / Evaluasi Akut CITO as indicated.',
    pomr:
      'Structure output as PAPDI POMR with 4 pillars per active problem: Pdx (Diagnostik), Ptx (Terapi), Pmx (Monitoring), Pex (Edukasi). Use PAPDI organ-system priority ordering.',
    ringkasan:
      'Produce a concise chronological case summary: active problems, RPD, RPO, abnormal lab highlights, and disposition recommendation.',
  };

  return `You are "Internize Cloud Clinical Synthesizer", an elite Board-Certified Internist (Sp.PD) and clinical reasoning engine operating in a HIPAA/UU-PDP-compliant hybrid architecture.

### CORE OPERATIONAL INVARIANTS

1. STRICT TOKEN PRESERVATION:
   - The clinical text has been sanitized on-device. All direct identifiers are replaced with tokens such as [PATIENT_1], [MRN_1], [HOSPITAL_1], [DOCTOR_1], [DATE_1], [PHONE_1], [AGE_1], [GENDER_1].
   - NEVER alter, remove, invent, guess, or hallucinate real names behind these tokens.
   - Carry these tokens VERBATIM into every field of your JSON output.

2. ZERO HALLUCINATION & STRICT GROUNDING:
   - Base all reasoning strictly on the provided clinical narrative, physical findings, and laboratory values.
   - Do NOT invent lab values, imaging results, or comorbidities not mentioned in the record.
   - If pertinent data is missing (e.g., eGFR, HbA1c), flag it explicitly in diagnostik plan as "Usulan: ..." rather than assuming any value.

3. INDONESIAN CLINICAL ENVIRONMENT (PAPDI & BPJS STANDARDS):
   - Formulate diagnostic synthesis, SOAP/POMR, and therapeutic plans in professional Indonesian clinical language aligned with PAPDI guidelines and formularium nasional.
   - Distinguish strictly between: Primary Active Problem vs Secondary Comorbidity vs Pertinent Negative.
   - Use Indonesian clinical abbreviations where standard: DM, HT, CKD, AKI, CHF, AF, etc.

4. CURRENT WORKFLOW MODE: ${modeNotes[mode] ?? modeNotes.pomr}

5. OUTPUT: Return ONLY valid JSON matching the exact schema provided. No preamble, no markdown fences, no trailing text.`;
}

function buildUserPrompt(req: CloudSynthesizeRequest): string {
  const { sanitizedText, structuredData } = req;

  const vitalsBlock = structuredData.vitals
    ? `TD: ${structuredData.vitals.bp ?? '-'} | HR: ${structuredData.vitals.hr ?? '-'} x/m | RR: ${structuredData.vitals.rr ?? '-'} x/m | Suhu: ${structuredData.vitals.temp ?? '-'} °C | SpO2: ${structuredData.vitals.spo2 ?? '-'}%`
    : 'Tanda vital tidak tersedia.';

  const labsBlock =
    structuredData.abnormalLabs && structuredData.abnormalLabs.length > 0
      ? structuredData.abnormalLabs
          .map((l) => `- ${l.name}: ${l.value} ${l.unit} [${l.flag.toUpperCase()}] — ${l.interpretation}`)
          .join('\n')
      : 'Tidak ada laboratorium abnormal terdeteksi oleh engine lokal.';

  const problemsBlock =
    structuredData.activeProblems && structuredData.activeProblems.length > 0
      ? structuredData.activeProblems
          .map((p, i) => `${i + 1}. [${p.division.toUpperCase()}] ${p.title} (Kritis: ${p.criticality})`)
          .join('\n')
      : 'Daftar masalah awal belum tersedia dari CROGE lokal.';

  return `### CLINICAL CASE PAYLOAD (SANITIZED / DE-IDENTIFIED)
--------------------------------------------------
[ANAMNESIS & PEMERIKSAAN FISIK TER-SANITASI]:
${sanitizedText.trim()}

[DATA TERSTRUKTUR DARI ENGINE LOKAL CROGE]:
Tanda Vital: ${vitalsBlock}

Laboratorium Abnormal:
${labsBlock}

Daftar Masalah Awal (CROGE):
${problemsBlock}
--------------------------------------------------

### TUGAS ANALISIS KLINIS (Sp.PD TIER 3 CLOUD REASONING):
Lakukan penalaran klinis komprehensif tingkat Spesialis Penyakit Dalam dan hasilkan output terstruktur sesuai schema JSON yang telah diberikan.

ATURAN PENULISAN WAJIB:
- Pertahankan semua token [PATIENT_1], [MRN_1], [HOSPITAL_1], [DOCTOR_1], dll. secara verbatim.
- Output hanya JSON valid — tanpa teks pengantar, markdown fence, atau penutup.
- Jika data tidak ada, tulis "Data tidak tersedia" bukan mengarang nilai.`;
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();

  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    let body: CloudSynthesizeRequest;
    try {
      body = await req.json() as CloudSynthesizeRequest;
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!body.sanitizedText || typeof body.sanitizedText !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, error: 'sanitizedText is required and must be a string' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (body.sanitizedText.length > 32_000) {
      return new Response(
        JSON.stringify({ ok: false, error: 'sanitizedText exceeds 32,000 character limit' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const mode = body.mode ?? 'pomr';

    // ── 2. Retrieve Gemini API key from Vault ────────────────────────────────
    const geminiApiKey = Deno.env.get('SUPABASE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('[cloud-synthesize] SUPABASE_GEMINI_API_KEY not set in Vault');
      return new Response(
        JSON.stringify({ ok: false, error: 'Cloud synthesizer not configured (API key missing)' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Build prompts ─────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(mode);
    const userPrompt = buildUserPrompt(body);

    // ── 4. Call Gemini API with response_schema ──────────────────────────────
    // Use gemini-2.0-flash as primary; 2.5-pro can be configured via env var
    const modelId = Deno.env.get('GEMINI_MODEL_ID') ?? 'gemini-2.0-flash-001';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey}`;

    const geminiPayload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SYNTHESIS_RESPONSE_SCHEMA,
        temperature: 0.2,        // Low temperature for clinical accuracy
        topP: 0.85,
        maxOutputTokens: 8192,
        candidateCount: 1,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      ],
    };

    let geminiResp: Response;
    try {
      geminiResp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
    } catch (fetchErr) {
      console.error('[cloud-synthesize] Gemini fetch error:', fetchErr);
      return new Response(
        JSON.stringify({ ok: false, error: 'Network error contacting Gemini API' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!geminiResp.ok) {
      const errBody = await geminiResp.text().catch(() => '');
      console.error(`[cloud-synthesize] Gemini API error ${geminiResp.status}:`, errBody);
      return new Response(
        JSON.stringify({ ok: false, error: `Gemini API error: ${geminiResp.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── 5. Parse Gemini response ─────────────────────────────────────────────
    const geminiJson = await geminiResp.json();
    const rawText: string =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Gemini returned empty response' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── 6. Parse structured JSON from Gemini text ────────────────────────────
    let structuredResult: SpPdSynthesisOutput;
    try {
      structuredResult = JSON.parse(rawText) as SpPdSynthesisOutput;
    } catch {
      console.error('[cloud-synthesize] Failed to parse Gemini JSON output:', rawText.slice(0, 500));
      return new Response(
        JSON.stringify({ ok: false, error: 'Gemini response was not valid JSON' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── 7. Server-side anti-leakage scan ────────────────────────────────────
    const responseJsonStr = JSON.stringify(structuredResult);
    try {
      assertNoLeakage(responseJsonStr);
    } catch (leakErr) {
      console.error('[cloud-synthesize] LEAKAGE DETECTED — suppressing response:', leakErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Anti-leakage check failed. Response suppressed for safety.',
        }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // ── 8. Return success ────────────────────────────────────────────────────
    const latencyMs = Date.now() - t0;
    const responsePayload: CloudSynthesizeResponse = {
      ok: true,
      result: structuredResult,
      latencyMs,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cloud-synthesize] Unhandled error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
