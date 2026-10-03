/**
 * oncologyStagingEngine.ts
 * ========================
 * 100% on-device, zero-egress Oncology Staging & Conversion Engine for internize.ai.
 *
 * Converts surgical/specialist oncology text (Bedah, THT, Obsgyn, dsb.) into the
 * standard Internal Medicine (Sp.PD) assessment format following:
 *   - AJCC Cancer Staging Manual, 8th Edition
 *   - ECOG Performance Status Scale (0–4)
 *   - Indonesian PAPDI oncology clinical standards
 *
 * Supported organs (AJCC 8th):
 *   Kolorektal, Payudara (Carcinoma Mammae), Paru (NSCLC), Nasofaring (NPC),
 *   Hepatoseluler (HCC), Tiroid, Gaster, Prostat
 *
 * PRIVACY INVARIANT: All processing is purely deterministic regex/lookup.
 *   No patient data ever leaves the browser.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OncologyOrgan =
  | 'kolorektal'
  | 'payudara'
  | 'paru_nsclc'
  | 'nasofaring'
  | 'hepatoseluler'
  | 'tiroid'
  | 'gaster'
  | 'prostat'
  | 'unknown';

export interface TnmDescriptor {
  rawT: string;    // e.g. "T4b", "T3"
  rawN: string;    // e.g. "N3b", "N2"
  rawM: string;    // e.g. "M0", "M1a"
  prefix: string;  // e.g. "c" (clinical), "p" (pathological), "yp" (post-NAC), ""
  fullTnm: string; // e.g. "cT4bN3bM0"
}

export interface AjccStageGroup {
  stage: string;        // e.g. "III C", "IV A", "II"
  stageRoman: string;   // e.g. "Stadium III C"
  confidence: 'confirmed' | 'estimated' | 'fallback';
  notes?: string;
}

export interface SurgicalIntervention {
  type: string;   // e.g. "Trephine sigmoidostomy", "Modified Radical Mastectomy (MRM)"
  date?: string;  // e.g. "11/8/26"
  raw: string;
}

export interface SystemicTherapy {
  type: 'kemoterapi' | 'radioterapi' | 'target_therapy' | 'imunoterapi';
  setting: 'NAC' | 'adjuvant' | 'paliatif' | 'definitif' | 'konkomitan' | 'unknown';
  regimen: string;  // e.g. "FOLFIRI", "FOLFOX", "AC-T", "Gemcitabine-Cisplatin"
  cycle?: string;   // e.g. "seri II", "siklus 3"
  date?: string;    // e.g. "10/9/26"
  raw: string;
}

export interface EcogEstimate {
  score: number | null;     // 0–4, or null if cannot estimate
  label: string;            // "ECOG PS 2" or "[ECOG PS: periksa status fungsional saat visite]"
  description: string;      // Clinical description of the scale level
  confidence: 'inferred' | 'placeholder';
}

export interface OncologyComorbidity {
  name: string;     // e.g. "DM Tipe 2", "Hipertensi Grade II"
  category: string; // "Metabolik", "Kardiovaskular", dsb.
}

export interface OncologyConversionResult {
  // Detection confidence
  isOncologyCase: boolean;
  organ: OncologyOrgan;
  organDisplay: string;           // e.g. "Rektum", "Mammae / Payudara"
  histology: string;              // e.g. "Adenocarcinoma", "Squamous Cell Carcinoma"

  // TNM
  tnm: TnmDescriptor | null;

  // Staging
  ajccStage: AjccStageGroup | null;

  // Functional status
  ecog: EcogEstimate;

  // Therapy history
  surgicalInterventions: SurgicalIntervention[];
  systemicTherapies: SystemicTherapy[];

  // Invasion & metastasis details
  localInvasionDetails: string[];   // e.g. ["Infiltrasi uterus", "Susp. fistula retrouterine"]
  metastasisSites: string[];        // e.g. ["Paru bilateral", "Hati (multiple)"]

  // Comorbidities
  comorbidities: OncologyComorbidity[];

  // Generated output
  diagnosisOneLiner: string;       // Single-line for EMR Assessment field
  diagnosisWithNotes: string;      // Full formatted output with bullet notes
  clinicalNotes: string[];         // Array of clinical note bullet points
  therapyConsiderations: string[]; // HOM / Pertimbangan Terapi Sistemik
}

// ─── AJCC 8th Edition Stage Group Tables ────────────────────────────────────

/**
 * Normalizes T/N/M strings for lookup by stripping prefix letters.
 * e.g. "cT4b" → "T4b", "pN2" → "N2", "yp" prefix stripped
 */
function normalizeTnm(raw: string): string {
  return raw.replace(/^(?:c|p|yp|yc|r|a|u)/i, '').toUpperCase();
}

// ── Kolorektal (AJCC 8th, Chapter 17) ──────────────────────────────────────
// Stage grouping for Colon AND Rectum combined
type TnmKey = string;
const COLORECTAL_STAGE_TABLE: Record<TnmKey, string> = {
  // Stage 0
  'TisN0M0': 'Stadium 0',
  // Stage I
  'T1N0M0': 'Stadium I', 'T2N0M0': 'Stadium I',
  // Stage IIA
  'T3N0M0': 'Stadium II A',
  // Stage IIB
  'T4aN0M0': 'Stadium II B',
  // Stage IIC
  'T4bN0M0': 'Stadium II C',
  // Stage IIIA
  'T1N1M0': 'Stadium III A', 'T2N1M0': 'Stadium III A',
  'T1N1AM0': 'Stadium III A', 'T2N1AM0': 'Stadium III A',
  'T1N1BM0': 'Stadium III A', 'T2N1BM0': 'Stadium III A',
  'T1N1CM0': 'Stadium III A', 'T2N1CM0': 'Stadium III A',
  'T1N2AM0': 'Stadium III A', 'T2N2AM0': 'Stadium III A',
  // Stage IIIB
  'T3N1M0': 'Stadium III B', 'T4aN1M0': 'Stadium III B',
  'T3N1AM0': 'Stadium III B', 'T4aN1AM0': 'Stadium III B',
  'T3N1BM0': 'Stadium III B', 'T4aN1BM0': 'Stadium III B',
  'T3N1CM0': 'Stadium III B', 'T4aN1CM0': 'Stadium III B',
  'T3N2AM0': 'Stadium III B', 'T4aN2AM0': 'Stadium III B',
  'T2N2BM0': 'Stadium III B', 'T3N2BM0': 'Stadium III B',
  // Stage IIIC
  'T4aN2BM0': 'Stadium III C',
  'T4BN1M0': 'Stadium III C', 'T4BN2M0': 'Stadium III C',
  'T4bN1M0': 'Stadium III C', 'T4bN1AM0': 'Stadium III C',
  'T4bN1BM0': 'Stadium III C', 'T4bN1CM0': 'Stadium III C',
  'T4bN2AM0': 'Stadium III C', 'T4bN2BM0': 'Stadium III C',
  'T4bN3M0': 'Stadium III C', 'T4bN3AM0': 'Stadium III C',
  'T4bN3BM0': 'Stadium III C',
  // N3 = any N3 (≥7 nodes) → IIIC
  'T1N3M0': 'Stadium III C', 'T2N3M0': 'Stadium III C',
  'T3N3M0': 'Stadium III C', 'T4aN3M0': 'Stadium III C',
  'T1N3AM0': 'Stadium III C', 'T2N3AM0': 'Stadium III C',
  'T3N3AM0': 'Stadium III C', 'T4aN3AM0': 'Stadium III C',
  'T1N3BM0': 'Stadium III C', 'T2N3BM0': 'Stadium III C',
  'T3N3BM0': 'Stadium III C', 'T4aN3BM0': 'Stadium III C',
  'T4bN3BM0_': 'Stadium III C',
};

// ── Payudara / Carcinoma Mammae (AJCC 8th, Chapter 48) ──────────────────────
// Anatomic stage grouping (without biomarker modifiers for deterministic mode)
const BREAST_STAGE_TABLE: Record<TnmKey, string> = {
  'TisN0M0': 'Stadium 0',
  'T1N0M0': 'Stadium I A', 'T0N1MIM0': 'Stadium I B', 'T1N1MIM0': 'Stadium I B',
  'T0N1M0': 'Stadium II A', 'T1N1M0': 'Stadium II A', 'T2N0M0': 'Stadium II A',
  'T2N1M0': 'Stadium II B', 'T3N0M0': 'Stadium II B',
  'T0N2M0': 'Stadium III A', 'T1N2M0': 'Stadium III A', 'T2N2M0': 'Stadium III A',
  'T3N1M0': 'Stadium III A', 'T3N2M0': 'Stadium III A',
  'T4N0M0': 'Stadium III B', 'T4N1M0': 'Stadium III B', 'T4N2M0': 'Stadium III B',
  'T0N3M0': 'Stadium III C', 'T1N3M0': 'Stadium III C', 'T2N3M0': 'Stadium III C',
  'T3N3M0': 'Stadium III C', 'T4N3M0': 'Stadium III C',
};

// ── Paru NSCLC (AJCC 8th, Chapter 36) ───────────────────────────────────────
const LUNG_NSCLC_STAGE_TABLE: Record<TnmKey, string> = {
  'T1AN0M0': 'Stadium I A', 'T1BN0M0': 'Stadium I A', 'T1CN0M0': 'Stadium I A',
  'T2AN0M0': 'Stadium I B',
  'T2BN0M0': 'Stadium II A', 'T2AN1M0': 'Stadium II A',
  'T1AN1M0': 'Stadium II B', 'T1BN1M0': 'Stadium II B', 'T1CN1M0': 'Stadium II B',
  'T2BN1M0': 'Stadium II B', 'T3N0M0': 'Stadium II B',
  'T1AN2M0': 'Stadium III A', 'T1BN2M0': 'Stadium III A', 'T1CN2M0': 'Stadium III A',
  'T2AN2M0': 'Stadium III A', 'T2BN2M0': 'Stadium III A',
  'T3N1M0': 'Stadium III A', 'T4N0M0': 'Stadium III A', 'T4N1M0': 'Stadium III A',
  'T1AN3M0': 'Stadium III B', 'T1BN3M0': 'Stadium III B', 'T1CN3M0': 'Stadium III B',
  'T2AN3M0': 'Stadium III B', 'T2BN3M0': 'Stadium III B',
  'T3N2M0': 'Stadium III B', 'T4N2M0': 'Stadium III B',
  'T3N3M0': 'Stadium III C', 'T4N3M0': 'Stadium III C',
};

// ── Nasofaring (AJCC 8th, Chapter 12) ───────────────────────────────────────
const NPC_STAGE_TABLE: Record<TnmKey, string> = {
  'T1N0M0': 'Stadium I',
  'T2N0M0': 'Stadium II', 'T1N1M0': 'Stadium II', 'T2N1M0': 'Stadium II',
  'T3N0M0': 'Stadium III', 'T3N1M0': 'Stadium III',
  'T1N2M0': 'Stadium III', 'T2N2M0': 'Stadium III', 'T3N2M0': 'Stadium III',
  'T4N0M0': 'Stadium IV A', 'T4N1M0': 'Stadium IV A', 'T4N2M0': 'Stadium IV A',
  'T0N3M0': 'Stadium IV B', 'T1N3M0': 'Stadium IV B', 'T2N3M0': 'Stadium IV B',
  'T3N3M0': 'Stadium IV B', 'T4N3M0': 'Stadium IV B',
};

// ── Hepatoseluler / HCC (AJCC 8th, Chapter 22) ──────────────────────────────
const HCC_STAGE_TABLE: Record<TnmKey, string> = {
  'T1AN0M0': 'Stadium I A', 'T1BN0M0': 'Stadium I B',
  'T2N0M0': 'Stadium II',
  'T3N0M0': 'Stadium III A',
  'T4N0M0': 'Stadium III B',
  'T1AN1M0': 'Stadium III B', 'T1BN1M0': 'Stadium III B',
  'T2N1M0': 'Stadium III B', 'T3N1M0': 'Stadium III B', 'T4N1M0': 'Stadium III B',
};

// Tiroid diferensiasi < 55 tahun: Any T, Any N, M0 → Stadium I (handled inline)
// Tiroid diferensiasi ≥ 55 tahun:
const THYROID_DIFF_GE55_TABLE: Record<TnmKey, string> = {
  'T1AN0M0': 'Stadium I', 'T1BN0M0': 'Stadium I', 'T2N0M0': 'Stadium I',
  'T1AN1M0': 'Stadium II', 'T1BN1M0': 'Stadium II',
  'T2N1M0': 'Stadium II', 'T3AN0M0': 'Stadium II', 'T3BN0M0': 'Stadium II',
  'T3AN1M0': 'Stadium II', 'T3BN1M0': 'Stadium II',
  'T4AN0M0': 'Stadium III A', 'T4AN1M0': 'Stadium III A',
  'T4BN0M0': 'Stadium III B', 'T4BN1M0': 'Stadium III B',
};

// ── Gaster (AJCC 8th, Chapter 16) ───────────────────────────────────────────
const GASTRIC_STAGE_TABLE: Record<TnmKey, string> = {
  'TisN0M0': 'Stadium 0',
  'T1N0M0': 'Stadium I A',
  'T1N1M0': 'Stadium I B', 'T2N0M0': 'Stadium I B',
  'T1N2M0': 'Stadium II A', 'T2N1M0': 'Stadium II A', 'T3N0M0': 'Stadium II A',
  'T1N3AM0': 'Stadium II B', 'T2N2M0': 'Stadium II B',
  'T3N1M0': 'Stadium II B', 'T4AN0M0': 'Stadium II B',
  'T2N3AM0': 'Stadium III A', 'T3N2M0': 'Stadium III A',
  'T4AN1M0': 'Stadium III A', 'T4AN2M0': 'Stadium III A', 'T4BN0M0': 'Stadium III A',
  'T1N3BM0': 'Stadium III B', 'T2N3BM0': 'Stadium III B',
  'T3N3AM0': 'Stadium III B', 'T4AN3AM0': 'Stadium III B',
  'T4BN1M0': 'Stadium III B', 'T4BN2M0': 'Stadium III B',
  'T3N3BM0': 'Stadium III C', 'T4AN3BM0': 'Stadium III C',
  'T4BN3AM0': 'Stadium III C', 'T4BN3BM0': 'Stadium III C',
};

// ── Prostat (AJCC 8th, Chapter 58) ──────────────────────────────────────────
const PROSTATE_STAGE_TABLE: Record<TnmKey, string> = {
  'T1N0M0': 'Stadium I', 'T2AN0M0': 'Stadium I', 'T2BN0M0': 'Stadium I', 'T2CN0M0': 'Stadium I',
  'T3AN0M0': 'Stadium II A', 'T3BN0M0': 'Stadium II B',
  'T4N0M0': 'Stadium III A', 'T1N1M0': 'Stadium III B',
  'T2N1M0': 'Stadium III B', 'T3AN1M0': 'Stadium III B',
  'T3BN1M0': 'Stadium III B', 'T4N1M0': 'Stadium III B',
};

// ─── Organ Detection ─────────────────────────────────────────────────────────

interface OrganPattern {
  organ: OncologyOrgan;
  display: string;
  patterns: RegExp[];
  histologyPatterns?: RegExp[];
}

const ORGAN_PATTERNS: OrganPattern[] = [
  {
    organ: 'kolorektal',
    display: 'Kolorektal',
    patterns: [
      /\b(adenocarcinoma|karsinoma|ca\.?|cancer)\s+(rektum|rektal|kolon|colon|usus\s*besar|rectum|sigmoid|ascending\s*colon|descending\s*colon)/i,
      /\b(rektum|recto?|kolon|colon|sigmoid)\s+(adenocarcinoma|karsinoma|maligna|ca\.?)/i,
      /\bkolorektal\b/i,
      /\bca\s+rekti\b/i,
      /\bca\s+kolon\b/i,
    ],
  },
  {
    organ: 'payudara',
    display: 'Mammae / Payudara',
    patterns: [
      /\b(adenocarcinoma|invasive\s*ductal|idc|ilc|carcinoma|ca\.?|cancer)\s+(mammae|payudara|breast|mamma)/i,
      /\b(mammae|payudara|breast|mamma)\s+(adenocarcinoma|invasive|karsinoma|ca\.?|maligna)/i,
      /\bca\s+mammae\b/i,
      /\bbreast\s+cancer\b/i,
      /\bmrm\b|\bmodified\s+radical\s+mastectomy\b|\blumpektomi\b/i,
    ],
  },
  {
    organ: 'paru_nsclc',
    display: 'Paru (NSCLC)',
    patterns: [
      /\b(adenocarcinoma|squamous\s*cell\s*carcinoma|nsclc|non[\-\s]small\s*cell|large\s*cell)\s+(paru|pulmo|lung|pulmonal)/i,
      /\b(paru|pulmo|lung)\s+(adenocarcinoma|squamous|nsclc|karsinoma|maligna)/i,
      /\bca\s+paru\b/i,
      /\bnsclc\b/i,
    ],
  },
  {
    organ: 'nasofaring',
    display: 'Nasofaring',
    patterns: [
      /\b(karsinoma|carcinoma|ca\.?)\s+(nasofaring|nasopharynx|nasopharyngeal)/i,
      /\b(nasofaring|nasopharynx|nasopharyngeal)\s+(karsinoma|ca\.?|maligna)/i,
      /\bNPC\b/,
      /\bca\s+nasofaring\b/i,
    ],
  },
  {
    organ: 'hepatoseluler',
    display: 'Hepar (Hepatoseluler / HCC)',
    patterns: [
      /\b(hepatocellular\s*carcinoma|hepatoseluler|hcc|karsinoma\s*hepatoseluler|ca\s+hepar)/i,
      /\b(hepar|hati|liver)\s+(karsinoma|hepatoseluler|hcc|maligna|ca\.?)/i,
    ],
  },
  {
    organ: 'tiroid',
    display: 'Tiroid',
    patterns: [
      /\b(papilary|papillary|follicular|folikuler|medullary|meduler|anaplastic|anaplastik)\s+(thyroid|tiroid)/i,
      /\b(thyroid|tiroid)\s+(karsinoma|carcinoma|ca\.?|maligna)/i,
      /\bca\s+tiroid\b/i,
    ],
  },
  {
    organ: 'gaster',
    display: 'Gaster / Lambung',
    patterns: [
      /\b(adenocarcinoma|karsinoma|ca\.?)\s+(gaster|gaster|lambung|gastric|stomach)/i,
      /\b(gaster|lambung|gastric|stomach)\s+(adenocarcinoma|karsinoma|maligna|ca\.?)/i,
      /\bca\s+gaster\b/i,
    ],
  },
  {
    organ: 'prostat',
    display: 'Prostat',
    patterns: [
      /\b(adenocarcinoma|karsinoma|ca\.?)\s+(prostat|prostate|prostatic)/i,
      /\b(prostat|prostate|prostatic)\s+(adenocarcinoma|karsinoma|maligna|ca\.?)/i,
      /\bca\s+prostat\b/i,
    ],
  },
];

// ─── Histology Detection ─────────────────────────────────────────────────────

function detectHistology(text: string): string {
  if (/\badeno[\-\s]?carcinoma\b/i.test(text)) return 'Adenocarcinoma';
  if (/\binvasive\s+ductal\s+carcinoma\b|idc\b/i.test(text)) return 'Invasive Ductal Carcinoma';
  if (/\binvasive\s+lobular\s+carcinoma\b|ilc\b/i.test(text)) return 'Invasive Lobular Carcinoma';
  if (/\bsquamous\s+cell\s+carcinoma\b|scc\b/i.test(text)) return 'Squamous Cell Carcinoma';
  if (/\bsmall\s+cell\s+carcinoma\b/i.test(text)) return 'Small Cell Carcinoma';
  if (/\blarge\s+cell\s+carcinoma\b/i.test(text)) return 'Large Cell Carcinoma';
  if (/\bhepatocellular\s+carcinoma\b|hcc\b/i.test(text)) return 'Hepatocellular Carcinoma';
  if (/\bpapillary\s+thyroid\b|papilary\s+thyroid\b/i.test(text)) return 'Papillary Thyroid Carcinoma';
  if (/\bfollicular\s+thyroid\b|folikuler\s+tiroid\b/i.test(text)) return 'Follicular Thyroid Carcinoma';
  if (/\bmedullary\s+thyroid\b|meduler\s+tiroid\b/i.test(text)) return 'Medullary Thyroid Carcinoma';
  if (/\banaplastic\s+thyroid\b|anaplastik\s+tiroid\b/i.test(text)) return 'Anaplastic Thyroid Carcinoma';
  if (/\bkarsinoma\b/i.test(text)) return 'Karsinoma';
  if (/\bcarcinoma\b/i.test(text)) return 'Carcinoma';
  return 'Keganasan';
}

// ─── Organ Detection ─────────────────────────────────────────────────────────

function detectOrgan(text: string): { organ: OncologyOrgan; display: string } {
  for (const op of ORGAN_PATTERNS) {
    for (const pattern of op.patterns) {
      if (pattern.test(text)) {
        if (op.organ === 'kolorektal') {
          if (/\b(rectum|rektum|rekti|rektal)\b/i.test(text)) {
            return { organ: 'kolorektal', display: 'Rektum' };
          }
          if (/\b(kolon|colon)\b/i.test(text)) {
            return { organ: 'kolorektal', display: 'Kolon' };
          }
          return { organ: 'kolorektal', display: 'Kolorektal' };
        }
        return { organ: op.organ, display: op.display };
      }
    }
  }
  return { organ: 'unknown', display: 'Organ Primer' };
}

// ─── TNM Parsing ─────────────────────────────────────────────────────────────

function parseTnm(text: string): TnmDescriptor | null {
  // Match patterns like: cT4bN3bM0, pT2N1M0, ypT0N0M0, T3N2M1a, etc.
  const tnmMatch = text.match(
    /\b(c|p|yp|yc|r|a|u)?(T(?:is|x|0|1[a-c]?|2[a-b]?|3|4[a-b]?))\s*(N(?:x|0|1[a-c]?|2[a-b]?|3[a-b]?))\s*(M(?:x|0|1[a-b]?))\b/i
  );
  if (!tnmMatch) return null;

  const prefix = tnmMatch[1] || '';
  const rawT = tnmMatch[2];
  const rawN = tnmMatch[3];
  const rawM = tnmMatch[4];

  return {
    rawT,
    rawN,
    rawM,
    prefix,
    fullTnm: `${prefix}${rawT}${rawN}${rawM}`,
  };
}

// ─── AJCC Stage Lookup ───────────────────────────────────────────────────────

function lookupAjccStage(
  organ: OncologyOrgan,
  tnm: TnmDescriptor,
  text: string,
): AjccStageGroup | null {
  const T = normalizeTnm(tnm.rawT);
  const N = normalizeTnm(tnm.rawN);
  const M = normalizeTnm(tnm.rawM);

  // M1 always Stage IV for solid tumors (universal rule)
  if (M === 'M1' || M === 'M1A' || M === 'M1B') {
    const substage = M === 'M1A' ? ' A' : M === 'M1B' ? ' B' : '';
    return {
      stage: `IV${substage}`,
      stageRoman: `Stadium IV${substage}`,
      confidence: 'confirmed',
      notes: 'Metastasis jauh (M1) mengonfirmasi Stadium IV pada semua organ primer (AJCC 8th Ed).',
    };
  }

  const key = `${T}${N}${M}`;
  let stageString: string | undefined;

  if (organ === 'kolorektal') {
    stageString = COLORECTAL_STAGE_TABLE[key];
    // Special rule: any N3 in colorectal → IIIC
    if (!stageString && /N3/.test(N) && M === 'M0') {
      stageString = 'Stadium III C';
    }
  } else if (organ === 'payudara') {
    stageString = BREAST_STAGE_TABLE[key];
    // Any N3 in breast → IIIC
    if (!stageString && /N3/.test(N) && M === 'M0') {
      stageString = 'Stadium III C';
    }
  } else if (organ === 'paru_nsclc') {
    stageString = LUNG_NSCLC_STAGE_TABLE[key];
  } else if (organ === 'nasofaring') {
    stageString = NPC_STAGE_TABLE[key];
    // N3 NPC → IVB
    if (!stageString && /N3/.test(N) && M === 'M0') {
      stageString = 'Stadium IV B';
    }
  } else if (organ === 'hepatoseluler') {
    stageString = HCC_STAGE_TABLE[key];
  } else if (organ === 'tiroid') {
    // Simplified: check age hint from text for papillary/follicular
    const ageLt55 = /\b[1-4]\d\s*(?:tahun|th|y\.?o\.?)\b/i.test(text);
    if (ageLt55) {
      // Under 55: M0 = Stage I, M1 = Stage II
      if (M === 'M0') {
        stageString = 'Stadium I';
      } else {
        stageString = 'Stadium II';
      }
    } else {
      stageString = THYROID_DIFF_GE55_TABLE[key];
    }
  } else if (organ === 'gaster') {
    stageString = GASTRIC_STAGE_TABLE[key];
  } else if (organ === 'prostat') {
    stageString = PROSTATE_STAGE_TABLE[key];
  }

  if (stageString) {
    return {
      stage: stageString.replace('Stadium ', ''),
      stageRoman: stageString,
      confidence: 'confirmed',
    };
  }

  // Fallback: heuristic by T/N/M category
  return fallbackStageEstimate(T, N, M, organ);
}

function fallbackStageEstimate(T: string, N: string, M: string, _organ: OncologyOrgan): AjccStageGroup {
  // M1 = IV
  if (M !== 'M0') {
    return { stage: 'IV', stageRoman: 'Stadium IV', confidence: 'estimated',
      notes: 'Metastasis jauh → Stadium IV (estimasi).' };
  }
  // N3 = IIIC or IIIB
  if (/N3/.test(N)) {
    return { stage: 'III C', stageRoman: 'Stadium III C', confidence: 'estimated',
      notes: 'N3 (≥7 KGB regional atau distant lymph node) → estimasi Stadium III C.' };
  }
  // N2 = IIIA or IIIB
  if (/N2/.test(N)) {
    return { stage: 'III A', stageRoman: 'Stadium III A', confidence: 'estimated',
      notes: 'N2 dengan T2–T3 → estimasi Stadium III A (konfirmasi dengan tabel AJCC 8th Ed).' };
  }
  // N1 + T4 = IIIB
  if (/N1/.test(N) && /T4/.test(T)) {
    return { stage: 'III B', stageRoman: 'Stadium III B', confidence: 'estimated',
      notes: 'T4N1 → estimasi Stadium III B.' };
  }
  // N1 = IIB/IIIA
  if (/N1/.test(N)) {
    return { stage: 'II B', stageRoman: 'Stadium II B', confidence: 'estimated',
      notes: 'N1 dengan M0 → estimasi Stadium II B–III A (konfirmasi dengan AJCC 8th Ed).' };
  }
  // T4b N0
  if (/T4B/i.test(T) && N === 'N0') {
    return { stage: 'II C', stageRoman: 'Stadium II C', confidence: 'estimated',
      notes: 'T4b N0 M0 → estimasi Stadium II C.' };
  }
  // T4a N0
  if (/T4A/i.test(T) && N === 'N0') {
    return { stage: 'II B', stageRoman: 'Stadium II B', confidence: 'estimated' };
  }
  // T3–T4 N0
  if (/T[34]/.test(T) && N === 'N0') {
    return { stage: 'II A', stageRoman: 'Stadium II A', confidence: 'estimated' };
  }
  // T1–T2 N0
  return { stage: 'I', stageRoman: 'Stadium I', confidence: 'estimated',
    notes: 'T1–T2 N0 M0 → estimasi Stadium I (konfirmasi dengan AJCC 8th Ed).' };
}

// ─── ECOG Estimation ─────────────────────────────────────────────────────────

function estimateEcog(text: string): EcogEstimate {
  const lc = text.toLowerCase();

  // 1. Explicit ECOG mention: e.g. "ECOG PS 1", "ECOG 2", "ECOG PS: 0", "ECOG: 3"
  const explicitMatch = text.match(/\becog(?:\s*(?:ps|score|skor|status))?\s*[:=]?\s*([0-4])\b/i);
  if (explicitMatch) {
    const score = Number.parseInt(explicitMatch[1], 10);
    const descriptions: Record<number, string> = {
      0: 'Fully active; able to carry on all pre-disease activities without restriction.',
      1: 'Restricted in physically strenuous activity; ambulatory and able to carry out light work.',
      2: 'Ambulatory, capable of self-care; unable to carry out work activities. Up and about >50% of waking hours.',
      3: 'Limited self-care; confined to bed/chair >50% of waking hours.',
      4: 'Totally confined to bed/chair; unable to self-care.',
    };
    return {
      score,
      label: `ECOG PS ${score}`,
      confidence: 'inferred',
      description: descriptions[score] || `ECOG Performance Status ${score}`,
    };
  }

  // 2. ECOG 4: totally bedbound, tidak dapat bangkit sama sekali
  if (/\b(totally\s+bed\s*bound|bed\s*ridden\s+total|tidak\s+bisa\s+(?:bergerak|bangun|duduk)|bedbound\s+total|terbaring\s+penuh)\b/.test(lc)) {
    return { score: 4, label: 'ECOG PS 4', confidence: 'inferred',
      description: 'Totally confined to bed/chair; unable to self-care.' };
  }

  // ECOG 3: >50% waktu di bed, terbatas rawat diri
  if (/\b(terbaring\s+lebih\s+dari|bed\s*rest\s+total|tirah\s+baring\s+penuh|tidak\s+bisa\s+berjalan|unable\s+to\s+walk|hanya\s+terbaring|terbatas\s+di\s+(?:tempat\s+tidur|bed))\b/.test(lc)
    && !/bisa\s+duduk/.test(lc)) {
    return { score: 3, label: 'ECOG PS 3', confidence: 'inferred',
      description: 'Limited self-care; confined to bed/chair >50% of waking hours.' };
  }

  // ECOG 2: bisa rawat diri tapi tidak bisa kerja, >50% waktu di luar bed
  // Key signals: "lemas di bed tapi bisa duduk", "masih bisa duduk sendiri dan makan"
  if (/\b(lemas\s+(?:di\s+)?bed(?:\s+tapi)?\s+(?:masih\s+)?bisa\s+duduk|masih\s+bisa\s+duduk\s+sendiri|duduk\s+(?:mandiri|sendiri)\s+dan\s+makan|ambulasi\s+terbatas|aktifitas\s+ringan\s+di\s+kamar|bedrest\s+ringan)\b/.test(lc)) {
    return { score: 2, label: 'ECOG PS 2', confidence: 'inferred',
      description: 'Ambulatory, capable of self-care; unable to carry out work activities. Up and about >50% of waking hours.' };
  }

  // ECOG 2 broader pattern
  if (/\b(bisa\s+duduk\s+(?:dan\s+makan|sendiri|mandiri)|mampu\s+rawat\s+diri|aktif\s+di\s+kamar|mobilisasi\s+ringan|masih\s+bisa\s+makan\s+sendiri)\b/.test(lc)
    && /\b(lemas|lemah|fatigue|lesu|tirah|bedrest)\b/.test(lc)) {
    return { score: 2, label: 'ECOG PS 2', confidence: 'inferred',
      description: 'Ambulatory, capable of self-care; unable to carry out work activities. Up and about >50% of waking hours.' };
  }

  // ECOG 1: kerja ringan/rawat jalan tapi tidak bisa kerja berat
  if (/\b(masih\s+bisa\s+(?:bekerja\s+ringan|aktivitas\s+ringan|jalan[\-\s]jalan|rawat\s+jalan)|outpatient|ambulasi\s+baik|berjalan\s+mandiri\s+dengan\s+ringan)\b/.test(lc)) {
    return { score: 1, label: 'ECOG PS 1', confidence: 'inferred',
      description: 'Restricted in physically strenuous activity; ambulatory and able to carry out light work.' };
  }

  // ECOG 0: aktif penuh seperti biasa
  if (/\b(aktif\s+penuh|fully\s+active|beraktivitas\s+normal|normal\s+activity)\b/.test(lc)) {
    return { score: 0, label: 'ECOG PS 0', confidence: 'inferred',
      description: 'Fully active; able to carry on all pre-disease activities without restriction.' };
  }

  // Cannot determine
  return {
    score: null,
    label: '[ECOG PS: periksa status fungsional saat visite]',
    confidence: 'placeholder',
    description: 'Status fungsional tidak dapat diestimasi dari teks. Penilaian langsung diperlukan saat visite.',
  };
}

// ─── Surgical Intervention Detection ─────────────────────────────────────────

function detectSurgicalInterventions(text: string): SurgicalIntervention[] {
  const results: SurgicalIntervention[] = [];
  // Match patterns: "post colostomy (11/8/26)", "post trephine sigmoidostomy", "MRM (12/7/26)", etc.
  const surgicalPatterns: Array<{ regex: RegExp; typeExtractor: (m: RegExpMatchArray) => string }> = [
    {
      regex: /\bpost[\-\s]+(?:trephine\s+)?sigmoidostomy\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Trephine Sigmoidostomy',
    },
    {
      regex: /\bpost[\-\s]+colostomy\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Kolostomi',
    },
    {
      regex: /\bpost[\-\s]+ileostomy\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Ileostomi',
    },
    {
      regex: /\bpost[\-\s]+(?:anterior\s+resection|reseksi\s+anterior)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Anterior Resection',
    },
    {
      regex: /\bpost[\-\s]+(?:hemikolektomi|hemicolectomy)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Hemikolektomi',
    },
    {
      regex: /\bpost[\-\s]+(?:laparotomi|laparotomy|eksplorasi\s+laparotomi)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Laparotomi Eksplorasi',
    },
    {
      regex: /\bpost[\-\s]+(?:mrm|modified\s+radical\s+mastectomy)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Modified Radical Mastectomy (MRM)',
    },
    {
      regex: /\bpost[\-\s]+(?:lumpektomi|lumpectomy|wide\s+local\s+excision)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Lumpektomi / Wide Local Excision',
    },
    {
      regex: /\bpost[\-\s]+(?:tiroidektomi|thyroidectomy|total\s+tiroidektomi)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Total Tiroidektomi',
    },
    {
      regex: /\bpost[\-\s]+(?:gastrektomi|gastrectomy)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Gastrektomi',
    },
    {
      regex: /\bpost[\-\s]+(?:hepatektomi|hepatectomy|reseksi\s+hepar)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Reseksi Hepar / Hepatektomi',
    },
    {
      regex: /\bpost[\-\s]+(?:prostatektomi|prostatectomy|rarp|rp\b)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Prostatektomi Radikal',
    },
    {
      regex: /\bpost[\-\s]+(?:neck\s+dissection|diseksi\s+leher|nd\b)\b(?:\s*\(([^)]+)\))?/gi,
      typeExtractor: () => 'Neck Dissection',
    },
  ];

  // Also detect date-annotated surgical events
  const dateAnnotatedPattern = /\bpost[\-\s]+([\w\s]+?)\s*\((\d{1,2}\/\d{1,2}\/\d{2,4})\)/gi;
  let dateMatch: RegExpExecArray | null;
  const processedRaws = new Set<string>();

  for (const sp of surgicalPatterns) {
    sp.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = sp.regex.exec(text)) !== null) {
      const raw = m[0];
      if (processedRaws.has(raw.toLowerCase())) continue;
      processedRaws.add(raw.toLowerCase());
      const dateInParens = m[1];
      const type = sp.typeExtractor(m);
      results.push({ type, date: dateInParens, raw });
    }
  }

  // Catch any remaining "post [procedure] (date)" not caught above
  dateAnnotatedPattern.lastIndex = 0;
  while ((dateMatch = dateAnnotatedPattern.exec(text)) !== null) {
    const raw = dateMatch[0];
    if (processedRaws.has(raw.toLowerCase())) continue;
    processedRaws.add(raw.toLowerCase());
    const procedureRaw = dateMatch[1].trim();
    const date = dateMatch[2];
    // Only add if it looks like a surgical procedure (not chemo)
    if (!/kemo|chemo|folfox|folfiri|capox|cisplatin|carboplatin|paclitaxel|gemcitabine|seri|siklus/i.test(procedureRaw)) {
      results.push({ type: procedureRaw, date, raw });
    }
  }

  return results;
}

// ─── Systemic Therapy Detection ───────────────────────────────────────────────

function detectSystemicTherapies(text: string): SystemicTherapy[] {
  const results: SystemicTherapy[] = [];

  // Chemo regimen patterns
  const chemoRegimenPatterns: Array<{ regex: RegExp; regimen: string }> = [
    { regex: /\bfolfox\b/gi, regimen: 'FOLFOX' },
    { regex: /\bfolfiri\b/gi, regimen: 'FOLFIRI' },
    { regex: /\bcapox\b|\bxelox\b/gi, regimen: 'CAPOX' },
    { regex: /\bxeliri\b/gi, regimen: 'XELIRI' },
    { regex: /\bac[\-\s]t\b|\bac\/t\b/gi, regimen: 'AC-T' },
    { regex: /\bfac\b|\btac\b/gi, regimen: 'FAC/TAC' },
    { regex: /\bec[\-\s]t\b|\bec\/t\b/gi, regimen: 'EC-T' },
    { regex: /\bgemcitabine[\-\s]*(?:cisplatin|carboplatin)\b/gi, regimen: 'Gemcitabine-Cisplatin' },
    { regex: /\bgemcitabine[\-\s]*(?:paclitaxel|nab[\-\s]*paclitaxel)\b/gi, regimen: 'Gemcitabine-Paclitaxel' },
    { regex: /\bcisplatin[\-\s]*(?:5[\-\s]?fu|fluorouracil)\b/gi, regimen: 'Cisplatin-5FU' },
    { regex: /\bdocetaxel[\-\s]*cisplatin[\-\s]*(?:5[\-\s]?fu|fluorouracil)\b/gi, regimen: 'DCF' },
    { regex: /\becf\b|\becx\b|\beox\b/gi, regimen: 'ECF/ECX/EOX' },
    { regex: /\bflox\b/gi, regimen: 'FLOX' },
    { regex: /\bgemcitabine\b/gi, regimen: 'Gemcitabine' },
    { regex: /\bcisplatin\b/gi, regimen: 'Cisplatin' },
    { regex: /\bcarboplatin\b/gi, regimen: 'Carboplatin' },
    { regex: /\bpaclitaxel\b/gi, regimen: 'Paclitaxel' },
    { regex: /\bdocetaxel\b/gi, regimen: 'Docetaxel' },
    { regex: /\bpemetrexed\b/gi, regimen: 'Pemetrexed' },
    { regex: /\bcapecitabine\b|\bxeloda\b/gi, regimen: 'Capecitabine' },
    { regex: /\boxaliplatin\b/gi, regimen: 'Oxaliplatin' },
    { regex: /\birinotecan\b/gi, regimen: 'Irinotecan' },
  ];

  // Detect setting and cycle
  const settingPatterns: Array<{ regex: RegExp; setting: SystemicTherapy['setting'] }> = [
    { regex: /\b(?:nac|neoadjuvant|neo\s*adjuvant|pre[\-\s]?operatif\s+kemo)\b/i, setting: 'NAC' },
    { regex: /\b(?:adjuvant|adjuvan|post[\-\s]?operatif\s+kemo)\b/i, setting: 'adjuvant' },
    { regex: /\b(?:paliatif|palliative|kemo\s+paliatif|lini\s+[1-4]|first[\-\s]line|second[\-\s]line)\b/i, setting: 'paliatif' },
    { regex: /\b(?:definitif|concurrent|konkomitan|kemoradioterapi)\b/i, setting: 'definitif' },
    { regex: /\b(?:konkomitan|concomitant)\b/i, setting: 'konkomitan' },
  ];

  // Cycle/series pattern
  const cyclePattern = /\b(?:seri|siklus|cycle|putaran)\s+([IVXLC]+|\d+)\b/gi;

  // Date pattern
  const datePattern = /\((\d{1,2}\/\d{1,2}\/\d{2,4})\)/;

  const processedRegimens = new Set<string>();

  for (const rp of chemoRegimenPatterns) {
    rp.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rp.regex.exec(text)) !== null) {
      const regimen = rp.regimen;
      if (processedRegimens.has(regimen.toLowerCase())) continue;
      processedRegimens.add(regimen.toLowerCase());

      // Extract context window around the match (±200 chars)
      const contextStart = Math.max(0, m.index - 80);
      const contextEnd = Math.min(text.length, (m.index ?? 0) + m[0].length + 120);
      const context = text.slice(contextStart, contextEnd);

      // Determine setting
      let setting: SystemicTherapy['setting'] = 'unknown';
      for (const sp of settingPatterns) {
        if (sp.regex.test(context)) {
          setting = sp.setting;
          sp.regex.lastIndex = 0;
          break;
        }
        sp.regex.lastIndex = 0;
      }

      // Extract cycle
      const cycleMatch = context.match(cyclePattern)?.[0];
      let cycle: string | undefined;
      if (cycleMatch) {
        const cycleNum = cycleMatch.match(/([IVXLC]+|\d+)$/i)?.[1];
        if (cycleNum) {
          // Convert arabic to roman if needed
          const arabicToRoman: Record<string, string> = {
            '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
            '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
            '11': 'XI', '12': 'XII',
          };
          const romanStr = arabicToRoman[cycleNum] || cycleNum;
          cycle = `seri ${romanStr}`;
        }
      }

      // Extract date: look immediately after the regimen/cycle first (e.g. "folfiri seri 2 (10/9/26)")
      const textAfter = text.slice(m.index, (m.index ?? 0) + m[0].length + 100);
      const dateMatchAfter = textAfter.match(datePattern);
      const date = dateMatchAfter?.[1] || context.match(datePattern)?.[1];

      results.push({
        type: 'kemoterapi',
        setting,
        regimen,
        cycle,
        date,
        raw: context.slice(0, 80).trim(),
      });
    }
  }

  // Radioterapi detection
  const rtPattern = /\bpost[\-\s]+(?:radioterapi|radiotherapy|rtp|xrt|ebrt|imrt|whole\s+brain|wbrt)\b(?:\s*\(([^)]+)\))?/gi;
  let rtMatch: RegExpExecArray | null;
  rtPattern.lastIndex = 0;
  while ((rtMatch = rtPattern.exec(text)) !== null) {
    results.push({
      type: 'radioterapi',
      setting: 'definitif',
      regimen: 'Radioterapi Eksternal (EBRT)',
      date: rtMatch[1],
      raw: rtMatch[0],
    });
  }

  return results;
}

// ─── Local Invasion & Metastasis Detection ───────────────────────────────────

function detectLocalInvasion(text: string, _organ: OncologyOrgan): string[] {
  const details: string[] = [];

  // Generic invasion patterns
  const invasionPatterns = [
    { regex: /infiltrasi?\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Infiltrasi' },
    { regex: /invasi\s+(?:ke\s+)?([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Invasi ke' },
    { regex: /susp\.?\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Susp.' },
    { regex: /(?:keterlibatan|involving|melibatkan)\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Keterlibatan' },
    { regex: /fistula\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Fistula' },
    { regex: /obstruksi\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Obstruksi' },
    { regex: /perforasi\s+([\w\s]+?)(?=[,.\n]|$)/gi, label: 'Perforasi' },
  ];

  for (const ip of invasionPatterns) {
    ip.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ip.regex.exec(text)) !== null) {
      const target = m[1]?.trim();
      if (target && target.length > 1 && target.length < 60) {
        // Filter out false positives
        if (!/\b(kemo|seri|siklus|post|pre)\b/i.test(target)) {
          details.push(`${ip.label} ${target}`);
        }
      }
    }
  }

  return [...new Set(details)].slice(0, 6); // Max 6 unique invasion details
}

function detectMetastasisSites(text: string): string[] {
  const sites: string[] = [];
  const metaPatterns = [
    /\bmetastasis?\s+(?:ke\s+)?([\w\s]+?)(?=[,.\n]|$)/gi,
    /\bmet(?:s)?\s+(?:ke\s+)?([\w\s]+?)(?=[,.\n]|$)/gi,
    /\bm1[ab]?\s+(?:\()?([\w\s]+?)(?=[,.\n)\]]|$)/gi,
  ];

  const organKeywords = [
    'paru', 'hati', 'hepar', 'liver', 'tulang', 'otak', 'brain', 'kelenjar', 'peritoneum',
    'pleura', 'adrenal', 'ginjal', 'kulit', 'jaringan lunak',
  ];

  for (const op of organKeywords) {
    const siteRegex = new RegExp(`\\bmet(?:astasis)?\\s+${op}\\b`, 'gi');
    if (siteRegex.test(text)) {
      sites.push(`Metastasis ${op}`);
    }
  }

  for (const mp of metaPatterns) {
    mp.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = mp.exec(text)) !== null) {
      const site = m[1]?.trim();
      if (site && site.length > 1 && site.length < 50) {
        sites.push(`Metastasis ${site}`);
      }
    }
  }

  return [...new Set(sites)].slice(0, 4);
}

// ─── Comorbidity Detection ───────────────────────────────────────────────────

interface ComorbidityPattern {
  regex: RegExp;
  name: string;
  category: string;
}

const COMORBIDITY_PATTERNS: ComorbidityPattern[] = [
  { regex: /\bdm\s+tipe?\s+[12]\b|\bdiabetes\s+melitus\b|\bdiabetes\b/i, name: 'DM Tipe 2', category: 'Endokrin-Metabolik' },
  { regex: /\bhipertensi\b|\bHTN\b|\btekanan\s+darah\s+tinggi\b/i, name: 'Hipertensi', category: 'Kardiovaskular' },
  { regex: /\banemia\b/i, name: 'Anemia', category: 'Hematologi' },
  { regex: /\baki\b|\bgagal\s+ginjal\s+akut\b|\binjury\s+ginjal\b/i, name: 'Acute Kidney Injury (AKI)', category: 'Nefrologi' },
  { regex: /\bckd\b|\bgagal\s+ginjal\s+kronik\b|\bpenyakit\s+ginjal\s+kronik\b/i, name: 'CKD (Penyakit Ginjal Kronik)', category: 'Nefrologi' },
  { regex: /\bhipoalbumin(?:emia)?\b|\balbumin\s+(?:rendah|<\s*3)\b/i, name: 'Hipoalbuminemia', category: 'Gastrohepatologi' },
  { regex: /\bhiponatremia\b/i, name: 'Hiponatremia', category: 'Nefrologi-Metabolik' },
  { regex: /\bhipokalemia\b/i, name: 'Hipokalemia', category: 'Elektrolit' },
  { regex: /\btrombositopenia\b/i, name: 'Trombositopenia', category: 'Hematologi' },
  { regex: /\bleukopenia\b|\bneutropenia\b/i, name: 'Neutropenia / Leukopenia', category: 'Hematologi-Onkologi' },
  { regex: /\bdvt\b|\btrombosis\s+vena\s+dalam\b/i, name: 'DVT (Deep Vein Thrombosis)', category: 'Kardiovaskular' },
  { regex: /\bpe\b|\bpulmonary\s+embolism\b|\bembolisme\s+paru\b/i, name: 'Pulmonary Embolism', category: 'Pulmono-Kardiovaskular' },
  { regex: /\bpneumonia\b|\bvap\b/i, name: 'Pneumonia', category: 'Pulmonologi' },
  { regex: /\bsepsis\b/i, name: 'Sepsis', category: 'Tropik-Infeksi' },
  { regex: /\bmual\s+kemo|\bnausea\s+(?:post|pasca)\s*kemo\b|\bmuntah\s+kemo\b/i, name: 'Mual-Muntah Terkait Kemoterapi (CINV)', category: 'Hematologi-Onkologi' },
  { regex: /\bneuro[\-\s]?toksis|\bperifer\s+neuropati\b|\bneuropati\s+perifer\b/i, name: 'Neuropati Perifer Terkait Kemoterapi', category: 'Hematologi-Onkologi' },
  { regex: /\bnyeri\s+(?:kronik|berat|hebat|neuropati)|\bpain\s+management\b/i, name: 'Nyeri Kronik / Pain Management', category: 'Paliatif' },
  { regex: /\bmalnutrisi\b|\bkekurangan\s+gizi\b|\bbmi\s+<\s*18/i, name: 'Malnutrisi Klinis', category: 'Endokrin-Metabolik' },
];

function detectComorbidities(text: string): OncologyComorbidity[] {
  return COMORBIDITY_PATTERNS
    .filter(cp => cp.regex.test(text))
    .map(cp => ({ name: cp.name, category: cp.category }));
}

// ─── HOM / Therapy Consideration Heuristics ──────────────────────────────────

function generateTherapyConsiderations(
  organ: OncologyOrgan,
  ajccStage: AjccStageGroup | null,
  ecog: EcogEstimate,
  therapies: SystemicTherapy[],
  tnm: TnmDescriptor | null,
): string[] {
  const considerations: string[] = [];
  const stage = ajccStage?.stage || '';
  const ecogScore = ecog.score;
  const lastChemo = therapies.filter(t => t.type === 'kemoterapi').at(-1);
  const isPostNAC = therapies.some(t => t.setting === 'NAC');
  const isStageIV = stage.startsWith('IV') || tnm?.rawM.toUpperCase().startsWith('M1');

  // Stage IV: palliative intent
  if (isStageIV) {
    if (ecogScore !== null && ecogScore >= 3) {
      considerations.push(
        'Stadium IV dengan ECOG PS ≥3: Pertimbangkan pendekatan Best Supportive Care (BSC) / Perawatan Paliatif sebagai prioritas. Diskusikan tujuan tata laksana dengan keluarga (advance care planning).'
      );
    } else {
      considerations.push(
        'Stadium IV (M1): Tujuan terapi sistemik bersifat paliatif. Evaluasi regimen lini 1 / 2 sesuai profil organ, komorbiditas, dan ECOG PS.'
      );
    }
  }

  // Post-NAC: recommend re-staging imaging
  if (isPostNAC && !isStageIV) {
    considerations.push(
      `Pasien post-NAC ${lastChemo?.regimen || ''} ${lastChemo?.cycle || ''}: Rekomendasikan re-evaluasi imaging (CT Scan / MRI) untuk penilaian respons terapi (downstaging) sebelum rencana tindakan definitif berikutnya.`
    );
  }

  // Organ-specific biomarker screening
  if (organ === 'kolorektal') {
    considerations.push(
      'Skrining biomarker: KRAS/NRAS/BRAF mutasi (wajib sebelum memulai anti-EGFR: Cetuximab/Panitumumab), MSI-H/dMMR (eligibilitas imunoterapi Pembrolizumab), dan HER2 amplifikasi.'
    );
    if (!isStageIV) {
      considerations.push(
        'Pemantauan CEA serial dan CT Scan toraks-abdomen tiap 3–6 bulan pasca-terapi definitif sebagai surveillance onkologi.'
      );
    }
  } else if (organ === 'payudara') {
    considerations.push(
      'Skrining reseptor: ER/PR status dan HER2 overekspresi/amplifikasi (IHC + FISH). Untuk HER2-positif: pertimbangkan Trastuzumab ± Pertuzumab. Untuk HR-positif: terapi endokrin (Tamoxifen / Aromatase Inhibitor).'
    );
    if (ecogScore !== null && ecogScore <= 2) {
      considerations.push(
        'ECOG PS ≤2: Pasien memenuhi kriteria fungsional untuk terapi sistemik (kemoterapi / target therapy / endokrin). Evaluasi fungsi jantung (Ekokardiografi) sebelum memulai regimen berbasis Anthrasiklin atau Trastuzumab.'
      );
    }
  } else if (organ === 'paru_nsclc') {
    considerations.push(
      'Skrining biomarker molekuler wajib: EGFR mutasi (ekson 18–21), ALK translokasi, ROS1, BRAF V600E, KRAS G12C, MET ekson 14 skipping, PD-L1 TPS (≥50% untuk imunoterapi lini 1 Pembrolizumab). EGFR+ → TKI (Osimertinib lini 1).'
    );
  } else if (organ === 'nasofaring') {
    considerations.push(
      'Standar tata laksana lokal–regional NPC: Kemoradioterapi konkomitan Cisplatin + Radioterapi definitif (EBRT/IMRT). Evaluasi EBV DNA kuantitatif sebagai biomarker monitoring respons dan surveillance.'
    );
  } else if (organ === 'hepatoseluler') {
    considerations.push(
      'Evaluasi fungsi cadangan hati: Child-Pugh Score / ALBI Score. Untuk HCC unresectable: Sorafenib / Lenvatinib lini 1 (ECOG PS 0–2, Child-Pugh A). TACE / ablasi RFA untuk tumor lokal tanpa invasi vaskular mayor.'
    );
  } else if (organ === 'tiroid') {
    considerations.push(
      'Evaluasi post-operasi: Tiroglobulin (Tg) + Anti-Tg antibodi sebagai tumor marker. Radioiodin ablasi (RAI-131) untuk tiroid diferensiasi pasca total tiroidektomi. Supresi TSH dengan Levotiroksin dosis TSH-suppressive.'
    );
  } else if (organ === 'gaster') {
    considerations.push(
      'Skrining HER2 pada adenokarsinoma gaster / GEJ (IHC 3+ atau FISH amplifikasi): indikasi Trastuzumab kombinasi kemoterapi lini 1. Evaluasi MSI-H/dMMR untuk eligibilitas Pembrolizumab.'
    );
  } else if (organ === 'prostat') {
    considerations.push(
      'Evaluasi PSA serial, PSMA PET-CT untuk re-staging. Terapi androgen deprivasi (ADT): LHRH agonis (Leuprorelin) ± Antiandrogen. Untuk CRPC: Enzalutamide / Abiraterone / Docetaxel berdasarkan ECOG PS dan staging.'
    );
  }

  // ECOG-based systemic therapy eligibility
  if (ecogScore !== null) {
    if (ecogScore <= 2 && !isStageIV) {
      considerations.push(
        `ECOG PS ${ecogScore} (${ecogScore <= 1 ? 'baik' : 'cukup'}): Pasien secara fungsional memenuhi kriteria untuk melanjutkan terapi sistemik. Evaluasi komorbiditas, fungsi organ (kreatinin, bilirubin, CBC), dan persetujuan informed consent.`
      );
    } else if (ecogScore >= 3) {
      considerations.push(
        `ECOG PS ${ecogScore}: Performa status buruk. Risiko toksisitas kemoterapi tinggi. Diskusi multidisiplin (MDT/TMT onkologi) sangat dianjurkan sebelum memutuskan eskalasi atau eskalasi terapi.`
      );
    }
  }

  return considerations;
}

// ─── Format Stage for Roman Numerals ─────────────────────────────────────────

function formatStageDisplay(stage: AjccStageGroup): string {
  // stage.stageRoman already has "Stadium X Y" format
  return stage.stageRoman;
}

// ─── Suffix Formatter ─────────────────────────────────────────────────────────

function formatTherapySuffix(
  surgeries: SurgicalIntervention[],
  therapies: SystemicTherapy[],
): string {
  const parts: string[] = [];

  for (const s of surgeries) {
    const dateStr = s.date ? ` (${s.date})` : '';
    parts.push(`post-${s.type}${dateStr}`);
  }

  for (const t of therapies) {
    if (t.type === 'kemoterapi') {
      const setting = t.setting !== 'unknown' ? t.setting.toUpperCase() + ' ' : '';
      const cycle = t.cycle ? ` ${t.cycle}` : '';
      const date = t.date ? ` (${t.date})` : '';
      parts.push(`post-${setting}${t.regimen}${cycle}${date}`);
    } else if (t.type === 'radioterapi') {
      const date = t.date ? ` (${t.date})` : '';
      parts.push(`post-${t.regimen}${date}`);
    }
  }

  return parts.join(', ');
}

// ─── N-category descriptor for notes ─────────────────────────────────────────

function nCategoryDescription(rawN: string): string {
  const N = normalizeTnm(rawN);
  if (N === 'N0') return 'Tidak ada keterlibatan KGB regional (N0)';
  if (N === 'N1' || N === 'N1A') return 'Metastasis 1–3 KGB regional (N1)';
  if (N === 'N1B') return 'Metastasis KGB regional peri-tumor (N1b)';
  if (N === 'N1C') return 'Deposit tumor subserosa/mesocolic tanpa KGB (N1c)';
  if (N === 'N2' || N === 'N2A') return 'Metastasis 4–6 KGB regional (N2a)';
  if (N === 'N2B') return 'Metastasis 4–6 KGB regional (N2b)';
  if (N === 'N3' || N === 'N3A') return 'Metastasis ≥7 KGB regional (N3 / N3a) — konfirmasi Stadium III C pada kolorektal';
  if (N === 'N3B') return 'Metastasis ≥7 KGB regional termasuk IMA (N3b) — Stadium III C';
  return `Kategori ${rawN}`;
}

function tCategoryDescription(rawT: string, organ: OncologyOrgan): string {
  const T = normalizeTnm(rawT);
  if (organ === 'kolorektal') {
    if (T === 'TIS') return 'In situ / Mukosa saja (Tis)';
    if (T === 'T1') return 'Tumor terbatas submukosa (T1)';
    if (T === 'T2') return 'Tumor invasi muscularis propria (T2)';
    if (T === 'T3') return 'Tumor menembus muscularis propria ke subserosa atau perirektal/perikolik (T3)';
    if (T === 'T4A') return 'Tumor menembus peritoneum visceral (T4a)';
    if (T === 'T4B') return 'Tumor menginvasi organ/struktur sekitar secara langsung (T4b)';
  }
  return `Kategori ${rawT}`;
}

// ─── Main Public API ──────────────────────────────────────────────────────────

/**
 * isOncologyText - quick check if text contains oncology case indicators.
 * Guarded strictly against non-cancer conditions that use staging (e.g. AKI Stadium III, CKD Stadium 4, Gagal Jantung, DBD).
 */
export function isOncologyText(text: string): boolean {
  if (!text) return false;

  // 1. Direct oncology/cancer keywords, TNM staging patterns, and specific oncology therapies/surgeries
  const hasCancerKeywords = /\b(adenocarcinoma|karsinoma|carcinoma|keganasan|maligna|ca\s+[a-z]+|kanker|tumor|neoplasma|sarcoma|sarkoma|lymphoma|limfoma|leukemia|melanoma|kemoterapi|radioterapi|folfox|folfiri|nac\b|onkologi|kolostomi|sigmoidostomi|mastektomi|mrm\b|[cp]?t[0-4][ab]?n[0-3][ab]?m[01])/i.test(text);
  if (hasCancerKeywords) return true;

  // 2. Generic staging must NEVER trigger on nephrology, cardiology, or infectious stages
  const isNonOncologyStage = /\b(aki|acute kidney injury|ckd|chronic kidney disease|gagal ginjal|ggk|heart failure|gagal jantung|sirosis|koma|ensefalopati|dbd|dengue|dekubitus)\b/i.test(text);
  if (isNonOncologyStage) return false;

  // 3. Cancer-specific stage grouping with substages (e.g. "Stadium III C", "Stadium II A", "Stadium IV B")
  if (/\bstadium\s+[ivIV]+[a-c]\b/i.test(text)) return true;

  // 4. "Stadium I-IV" only if explicitly associated with cancer/neoplasm context
  return /\b(?:kanker|tumor|ca|keganasan|karsinoma|massa|keganasan)\b.{0,25}\bstadium\s+[ivIV]+\b/i.test(text);
}

/**
 * convertOncologyDiagnosis - main conversion engine
 *
 * Takes raw surgical/specialist text and returns complete Sp.PD assessment format.
 * All processing is 100% local/deterministic — no PHI leaves the browser.
 */
export function convertOncologyDiagnosis(rawText: string): OncologyConversionResult {
  const text = rawText || '';

  // 1. Detect organ
  const { organ, display: organDisplay } = detectOrgan(text);

  // 2. Is this actually an oncology case?
  const isOncologyCase = organ !== 'unknown' || isOncologyText(text);

  // 3. Detect histology
  const histology = detectHistology(text);

  // 4. Parse TNM
  const tnm = parseTnm(text);

  // 5. Look up AJCC stage
  let ajccStage: AjccStageGroup | null = null;
  if (tnm) {
    ajccStage = lookupAjccStage(organ, tnm, text);
  }

  // 6. Estimate ECOG
  const ecog = estimateEcog(text);

  // 7. Detect surgical interventions
  const surgicalInterventions = detectSurgicalInterventions(text);

  // 8. Detect systemic therapies
  const systemicTherapies = detectSystemicTherapies(text);

  // 9. Local invasion & metastasis
  const localInvasionDetails = detectLocalInvasion(text, organ);
  const metastasisSites = detectMetastasisSites(text);

  // 10. Comorbidities
  const comorbidities = detectComorbidities(text);

  // 11. Generate therapy considerations
  const therapyConsiderations = generateTherapyConsiderations(
    organ, ajccStage, ecog, systemicTherapies, tnm
  );

  // ── Build Diagnosis One-Liner ──────────────────────────────────────────────
  const stageDisplay = ajccStage ? formatStageDisplay(ajccStage) : '';
  const tnmDisplay = tnm ? ` (${tnm.fullTnm})` : '';
  const therapySuffix = formatTherapySuffix(surgicalInterventions, systemicTherapies);

  let diagnosisOneLiner = `${histology} ${organDisplay}`;
  if (stageDisplay) {
    diagnosisOneLiner += ` ${stageDisplay}`;
  }
  diagnosisOneLiner += tnmDisplay;
  diagnosisOneLiner += ` ${ecog.label}`;
  if (therapySuffix) {
    diagnosisOneLiner += `, ${therapySuffix}`;
  }
  diagnosisOneLiner = diagnosisOneLiner.replace(/\s+/g, ' ').trim();

  // ── Build Clinical Notes ───────────────────────────────────────────────────
  const clinicalNotes: string[] = [];

  // Invasion/T-category note
  if (tnm) {
    const tDesc = tCategoryDescription(tnm.rawT, organ);
    let tNote = `Invasi lokal: Kategori ${tnm.rawT} — ${tDesc}.`;
    if (localInvasionDetails.length > 0) {
      tNote += ` Temuan tambahan: ${localInvasionDetails.slice(0, 3).join('; ')}.`;
    }
    clinicalNotes.push(tNote);
  } else if (localInvasionDetails.length > 0) {
    clinicalNotes.push(`Temuan invasi lokal: ${localInvasionDetails.join('; ')}.`);
  }

  // N-category note
  if (tnm) {
    const nDesc = nCategoryDescription(tnm.rawN);
    let nNote = `KGB Regional: ${nDesc}.`;
    if (ajccStage?.confidence === 'confirmed') {
      nNote += ` → Mengonfirmasi ${ajccStage.stageRoman} berdasarkan AJCC Cancer Staging Manual Edisi ke-8.`;
    } else if (ajccStage?.notes) {
      nNote += ` ${ajccStage.notes}`;
    }
    clinicalNotes.push(nNote);
  }

  // Metastasis sites
  if (metastasisSites.length > 0) {
    clinicalNotes.push(`Metastasis jauh (M1): ${metastasisSites.join(', ')}.`);
  }

  // Therapy history note
  if (surgicalInterventions.length > 0 || systemicTherapies.length > 0) {
    const historyParts: string[] = [];
    for (const s of surgicalInterventions) {
      historyParts.push(`${s.type}${s.date ? ` (${s.date})` : ''}`);
    }
    for (const t of systemicTherapies) {
      const setting = t.setting !== 'unknown' ? `${t.setting.toUpperCase()} ` : '';
      const cycle = t.cycle ? ` ${t.cycle}` : '';
      const date = t.date ? ` (${t.date})` : '';
      historyParts.push(`${setting}${t.regimen}${cycle}${date}`);
    }
    clinicalNotes.push(`Riwayat terapi: ${historyParts.join(', ')}.`);
  }

  // Comorbidities note
  if (comorbidities.length > 0) {
    clinicalNotes.push(
      `Komorbiditas penyerta: ${comorbidities.map(c => c.name).join(', ')}.`
    );
  }

  // ECOG functional status note
  if (ecog.confidence === 'inferred' && ecog.score !== null) {
    clinicalNotes.push(
      `Status Fungsional: ${ecog.label} — ${ecog.description}`
    );
  }

  // ── Build Full Output ──────────────────────────────────────────────────────
  const notesBlock = clinicalNotes.map(n => `• ${n}`).join('\n');
  const homsBlock = therapyConsiderations.map(t => `  ◦ ${t}`).join('\n');

  let diagnosisWithNotes = `DIAGNOSIS UTAMA:\n${diagnosisOneLiner}\n\n`;
  if (clinicalNotes.length > 0) {
    diagnosisWithNotes += `CATATAN KLINIS SINGKAT:\n${notesBlock}\n\n`;
  }
  if (therapyConsiderations.length > 0) {
    diagnosisWithNotes += `PERTIMBANGAN TERAPI SISTEMIK / HOM:\n${homsBlock}`;
  }

  if (comorbidities.length > 0) {
    diagnosisWithNotes += `\n\nKOMORBIDITAS PENYERTA:\n${comorbidities.map(c => `• ${c.name} (${c.category})`).join('\n')}`;
  }

  return {
    isOncologyCase,
    organ,
    organDisplay,
    histology,
    tnm,
    ajccStage,
    ecog,
    surgicalInterventions,
    systemicTherapies,
    localInvasionDetails,
    metastasisSites,
    comorbidities,
    diagnosisOneLiner,
    diagnosisWithNotes,
    clinicalNotes,
    therapyConsiderations,
  };
}
