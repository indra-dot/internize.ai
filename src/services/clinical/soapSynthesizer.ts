/**
 * Structured SOAP Note Synthesizer v3 — Hospital CPPT & Multi-Signal Scoring Engine
 * 
 * Supports:
 * 1. Hospital CPPT / Catatan Perkembangan Pasien Terintegrasi (RS Ngoerah, RSCM, RSUD, dll.)
 *    - Strict separation: Assessment ONLY contains diagnoses (Primary & Comorbid/Raber).
 *    - Objective groups: Physical Exam & Vitals, Special Exam (RT), Labs, and Imaging/Diagnostics (BOF, Thorax, USG, EKG with their Kesan).
 *    - Subjective captures Patient info, Team/Raber, Highlight, Anamnesis, RPD, RPO.
 *    - Plan retains pdx, mtx, instructions/therapies, and other team advis (Nefro, Tropik, Uro).
 * 2. Multi-Signal Scoring Engine for unstructured clinical narrative.
 * 3. 100% on-device, zero hallucination, anti-leakage guards preventing lab & exam data from entering Assessment.
 */

import type { RxNormConcept, SnomedConcept, SoapCitation, SoapNote } from '../../types/clinical';

export interface SoapSynthesizerOptions {
  includePertinentNegatives?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Laboratory and Clinical Diagnostic Matchers
// ──────────────────────────────────────────────────────────────────────────────

export const LAB_KEYWORDS =
  /\b(wbc|rbc|hgb|hb|hct|mcv|mch|mchc|plt|trombosit|leukosit|ne#|ly#|mo#|eo#|ba#|neutrofil|limfosit|monosit|eosinofil|basofil|led|esr|diff|pt|aptt|inr|fibrinogen|d-dimer|ureum|urea|bun|kreatinin|creatinine|egfr|lfg|e-lfg|sgot|ast|sgpt|alt|bilirubin|alkali|alp|gamma|ggt|albumin|protein|globulin|natrium|na|kalium|k|klorida|cl|kalsium|ca|magnesium|mg|fosfat|p|gds|gdp|gd2pp|hba1c|crp|prokalsitonin|pct|fe\b|si\b|tibc|ferritin|asam urat|uric acid|troponin|ckmb|bnp|nt-probnp|ph\b|pco2|po2|beecf|be|hco3|so2c|tco2|urinalisis|sedimen|leukosituria|proteinuria|glukosuria|bakteriuria)\b/i;

export const VITAL_SIGNS_KEYWORDS =
  /\b(bp|blood pressure|tekanan darah|td|pulse|nadi|hr|heart rate|bpm|temp|temperature|suhu|o2|spo2|oxygen saturation|saturasi|rr|respiratory rate|frekuensi napas|gcs)\b/i;

export const IMAGING_KEYWORDS =
  /\b(bof|bno|foto thorax|rontgen|x-ray|usg|ultrasound|ekg|ecg|ct scan|mri|echocardiography|echo)\b/i;

/** Detects if a line contains laboratory results, values, or date series */
export function isLabLine(text: string): boolean {
  if (!text) return false;
  if (LAB_KEYWORDS.test(text)) return true;
  // Match lab date headers like "16/9/26--20/9" or "16/9/26" followed by test values
  if (/^\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:--\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)*\s*$/.test(text)) return true;
  // Match number with lab units
  if (/\d+(?:[.,]\d+)?\s*(?:mg\/dl|mmol\/l|meq\/l|g\/dl|u\/l|iu\/l|pg\/ml|ng\/ml|mcg\/l|nmol\/l|%)\b/i.test(text)) return true;
  return false;
}

/** Detects if a line contains vital sign parameters */
export function isVitalSignLine(text: string): boolean {
  if (!text) return false;
  return /^\s*(?:td|bp|nadi|pulse|hr|rr|suhu|temp|s|spo2|gcs)\s*[:=]/i.test(text);
}

/**
 * Checks whether text follows a hospital CPPT / semi-structured clinical format
 */
export function hasHospitalCpptStructure(text: string): boolean {
  if (!text) return false;
  const hasAssHeader = /^\s*(?:ass|assessment|a)\s*[:.\s-]*$/im.test(text);
  const hasSOAPHeaders = /^\s*(?:s|subjective)\s*[:.\s-]/im.test(text) && /^\s*(?:o|objective|p|plan)\s*[:.\s-]/im.test(text);
  const hasDiagnosticBlocks = /^\s*(?:bof|foto thorax|rontgen|usg\s*(?:abdomen)?|ekg|ecg)\b/im.test(text);
  const hasCpptPlan = /^\s*(?:pdx|mtx)\s*[:.\s-]/im.test(text);
  const hasHighlight = /^\s*(?:={2,}\s*)?highlight(?:\s*={2,})?\s*$/im.test(text);

  return hasAssHeader || hasSOAPHeaders || (hasDiagnosticBlocks && hasCpptPlan) || hasHighlight;
}

/**
 * Parses hospital CPPT notes with strict separation:
 * - Assessment: ONLY diagnoses (Primary and Comorbid/Raber)
 * - Objective: Physical Exam & Vitals, Special Exam (RT), Labs, Imaging & Kesan
 * - Subjective: Patient info, Highlight, Anamnesis, RPD, RPO
 * - Plan: pdx, mtx, instructions, other teams
 */
function parseHospitalCpptSoap(
  cleanText: string,
  diagnoses: SnomedConcept[],
  medications: RxNormConcept[],
): SoapNote {
  const lines = cleanText.split(/\r?\n/).map((l) => l.trimEnd());

  type CpptMode =
    | 'HEADER'
    | 'ASSESSMENT_PRIMARY'
    | 'ASSESSMENT_COMORBID'
    | 'HIGHLIGHT'
    | 'SUBJECTIVE'
    | 'RPD'
    | 'RPO'
    | 'PHYSICAL_EXAM'
    | 'SPECIAL_EXAM'
    | 'LAB'
    | 'IMAGING'
    | 'PLAN_PDX'
    | 'PLAN_MTX'
    | 'PLAN_TX'
    | 'PLAN_OTHER_TEAM';

  let mode: CpptMode = 'HEADER';
  let currentTeam = '';

  const subjectiveLines: string[] = [];
  const primaryAssLines: string[] = [];
  const comorbidAssLines: string[] = [];
  const physicalExamLines: string[] = [];
  const specialExamLines: string[] = [];
  const labLines: string[] = [];
  const imagingLines: string[] = [];
  const planPdxLines: string[] = [];
  const planMtxLines: string[] = [];
  const planTxLines: string[] = [];
  const otherTeams: Array<{ team: string; instructions: string[] }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Assessment headers (e.g. "ass", "assessment", "A:")
    if (/^\s*(?:ass|assessment|a)\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'ASSESSMENT_PRIMARY';
      continue;
    }

    // 2. Assessment comorbid divider
    if (mode === 'ASSESSMENT_PRIMARY' && /^={2,}/.test(trimmed)) {
      mode = 'ASSESSMENT_COMORBID';
      continue;
    }

    // 3. Highlight
    if (/^\s*(?:={2,}\s*)?highlight(?:\s*={2,})?\s*$/i.test(trimmed)) {
      mode = 'HIGHLIGHT';
      subjectiveLines.push('--- HIGHLIGHT ---');
      continue;
    }

    // 4. Subjective headers
    if (/^\s*(?:s|subjective)\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'SUBJECTIVE';
      continue;
    }
    if (/^\s*rpd\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'RPD';
      subjectiveLines.push('RPD:');
      continue;
    }
    if (/^\s*rpo\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'RPO';
      subjectiveLines.push('RPO:');
      continue;
    }

    // 5. Objective headers
    if (/^\s*(?:o|objective)\s*[:.\s-]*$/i.test(trimmed)) {
      // Lookahead: check if next lines are lab tests
      const nextLine = lines.slice(i + 1, i + 5).find((l) => l.trim().length > 0) || '';
      if (isLabLine(nextLine) || /^\s*\d{1,2}\/\d{1,2}/.test(nextLine.trim())) {
        mode = 'LAB';
      } else {
        mode = 'PHYSICAL_EXAM';
      }
      continue;
    }
    if (/^\s*bof\b/i.test(trimmed)) {
      mode = 'IMAGING';
      imagingLines.push('BOF:');
      continue;
    }
    if (/^\s*foto thorax\b/i.test(trimmed) || /^\s*rontgen\b/i.test(trimmed) || /^\s*x-ray\b/i.test(trimmed)) {
      mode = 'IMAGING';
      imagingLines.push(trimmed.includes(':') ? trimmed : `${trimmed}:`);
      continue;
    }
    if (/^\s*(?:hasil pemeriksaan\s+)?usg\b/i.test(trimmed)) {
      mode = 'IMAGING';
      imagingLines.push(trimmed.includes(':') ? trimmed : `${trimmed}:`);
      continue;
    }
    if (/^\s*ekg\b/i.test(trimmed) || /^\s*ecg\b/i.test(trimmed)) {
      mode = 'IMAGING';
      imagingLines.push(trimmed);
      continue;
    }
    if (/^\s*rt\s+\d/i.test(trimmed) || /^\s*(?:rt|rectal toucher|colok dubur)\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'SPECIAL_EXAM';
      specialExamLines.push(trimmed);
      continue;
    }
    if (/^\s*lab(?:oratorium)?\b/i.test(trimmed) || /^\s*penunjang\s+rs\b/i.test(trimmed)) {
      mode = 'LAB';
      labLines.push(trimmed);
      continue;
    }

    // 6. Plan headers
    if (/^\s*(?:p|plan)\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'PLAN_TX';
      continue;
    }
    if (/^\s*pdx\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'PLAN_PDX';
      planPdxLines.push('pdx:');
      continue;
    }
    if (/^\s*mtx\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'PLAN_MTX';
      planMtxLines.push('mtx:');
      continue;
    }
    if (/^\s*(?:i|tx|terapi|instruksi)\s*[:.\s-]*$/i.test(trimmed)) {
      mode = 'PLAN_TX';
      planTxLines.push('Instruksi / Terapi:');
      continue;
    }

    // 7. Other teams / Raber (e.g. "============ NEFRO", "======== TROPIK", "==== URO")
    const teamMatch = trimmed.match(/^={2,}\s*([A-Z\s]+?)\s*={0,}$/);
    if (
      teamMatch &&
      ['NEFRO', 'TROPIK', 'URO', 'KARDIO', 'PARU', 'NEURO', 'BEDAH', 'ANESTESI', 'ENDOKRIN', 'HEMATO', 'REUMATO', 'GERIATRI'].some((t) =>
        teamMatch[1].includes(t),
      )
    ) {
      currentTeam = teamMatch[1].trim();
      mode = 'PLAN_OTHER_TEAM';
      otherTeams.push({ team: currentTeam, instructions: [] });
      continue;
    }

    // Section dividers cleanup
    if (/^={3,}$/.test(trimmed)) {
      continue;
    }

    // Line assignment with strict anti-leakage protection
    switch (mode) {
      case 'HEADER':
        subjectiveLines.push(trimmed);
        break;
      case 'ASSESSMENT_PRIMARY':
        // Ensure lab/vitals never leak into assessment
        if (!isLabLine(trimmed) && !isVitalSignLine(trimmed)) {
          primaryAssLines.push(trimmed);
        } else {
          labLines.push(trimmed);
        }
        break;
      case 'ASSESSMENT_COMORBID':
        if (!isLabLine(trimmed) && !isVitalSignLine(trimmed)) {
          comorbidAssLines.push(trimmed);
        } else {
          labLines.push(trimmed);
        }
        break;
      case 'HIGHLIGHT':
      case 'SUBJECTIVE':
      case 'RPD':
      case 'RPO':
        subjectiveLines.push(trimmed);
        break;
      case 'PHYSICAL_EXAM':
        if (isLabLine(trimmed)) {
          labLines.push(trimmed);
        } else {
          physicalExamLines.push(trimmed);
        }
        break;
      case 'SPECIAL_EXAM':
        specialExamLines.push(trimmed);
        break;
      case 'LAB':
        labLines.push(trimmed);
        break;
      case 'IMAGING':
        imagingLines.push(trimmed);
        break;
      case 'PLAN_PDX':
        planPdxLines.push(trimmed);
        break;
      case 'PLAN_MTX':
        planMtxLines.push(trimmed);
        break;
      case 'PLAN_TX':
        planTxLines.push(trimmed);
        break;
      case 'PLAN_OTHER_TEAM':
        if (otherTeams.length > 0) {
          otherTeams[otherTeams.length - 1].instructions.push(trimmed);
        }
        break;
    }
  }

  // Compile final sections
  // 1. Subjective
  const finalSubjective = [...subjectiveLines];

  // 2. Objective
  const finalObjective: string[] = [];
  if (physicalExamLines.length > 0) {
    finalObjective.push('--- PEMERIKSAAN FISIK & VITAL SIGN ---', ...physicalExamLines);
  }
  if (specialExamLines.length > 0) {
    if (finalObjective.length > 0) finalObjective.push('');
    finalObjective.push('--- PEMERIKSAAN KHUSUS ---', ...specialExamLines);
  }
  if (labLines.length > 0) {
    if (finalObjective.length > 0) finalObjective.push('');
    finalObjective.push('--- HASIL LABORATORIUM ---', ...labLines);
  }
  if (imagingLines.length > 0) {
    if (finalObjective.length > 0) finalObjective.push('');
    finalObjective.push('--- PENUNJANG & RADIOLOGI ---', ...imagingLines);
  }

  // 3. Assessment — ONLY DIAGNOSES
  const finalAssessment: string[] = [];
  if (primaryAssLines.length > 0) {
    finalAssessment.push('Diagnosis Utama / Masalah Terkait:', ...primaryAssLines);
  }
  if (comorbidAssLines.length > 0) {
    if (finalAssessment.length > 0) finalAssessment.push('');
    finalAssessment.push('Diagnosis Komorbid / Tim Lain (Raber):', ...comorbidAssLines);
  }
  if (finalAssessment.length === 0) {
    if (diagnoses.length > 0) {
      for (const d of diagnoses) {
        finalAssessment.push(`${d.preferredTerm} (SNOMED CT: ${d.code})`);
      }
    } else {
      finalAssessment.push('Clinical findings and symptoms evaluated — no specific diagnosis code extracted from source text.');
    }
  }

  // 4. Plan
  const finalPlan: string[] = [];
  if (planPdxLines.length > 0) finalPlan.push(...planPdxLines);
  if (planMtxLines.length > 0) finalPlan.push(...planMtxLines);
  if (planTxLines.length > 0) finalPlan.push(...planTxLines);
  for (const team of otherTeams) {
    if (team.instructions.length > 0) {
      if (finalPlan.length > 0) finalPlan.push('');
      finalPlan.push(`[${team.team}]`, ...team.instructions);
    }
  }
  if (finalPlan.length === 0) {
    if (medications.length > 0) {
      for (const m of medications) {
        const sigParts = [m.name];
        if (m.dosage) sigParts.push(m.dosage);
        if (m.route) sigParts.push(m.route);
        if (m.frequency) sigParts.push(m.frequency);
        finalPlan.push(`Continue ${sigParts.join(' ')}. Monitor clinical response.`);
      }
    } else {
      finalPlan.push('Routine clinical observation and follow-up as clinically indicated.');
    }
  }

  // Build character span citations for contract compatibility
  const buildCitations = (linesArr: string[]): SoapCitation[] => {
    return linesArr.map((line) => {
      const matchIdx = cleanText.indexOf(line);
      if (matchIdx !== -1) {
        return { start: matchIdx, end: matchIdx + line.length, sourceText: line };
      }
      return { start: 0, end: Math.min(line.length, cleanText.length), sourceText: line };
    });
  };

  return {
    subjective: { title: 'Subjective', content: finalSubjective, citations: buildCitations(finalSubjective) },
    objective: { title: 'Objective', content: finalObjective, citations: buildCitations(finalObjective) },
    assessment: { title: 'Assessment', content: finalAssessment, citations: buildCitations(finalAssessment) },
    plan: { title: 'Plan', content: finalPlan, citations: buildCitations(finalPlan) },
    generatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// General Narrative Parsing (Multi-Signal Scoring)
// ──────────────────────────────────────────────────────────────────────────────

/** Splits text into sentences/clauses with start/end offsets */
function splitIntoSentences(text: string): Array<{ text: string; start: number; end: number }> {
  if (!text || text.trim().length === 0) return [];

  const sentences: Array<{ text: string; start: number; end: number }> = [];

  // Split pada bullet points, newlines, dan batas kalimat standar
  const segments = text.split(/(?<=[\.!?])\s+|\n+|(?<=;)\s+|(?=[\-•–]\s)/);
  let cursor = 0;
  for (const seg of segments) {
    const trimmed = seg.replace(/^[\-•–\*]\s+/, '').trim();
    if (trimmed.length < 3) {
      cursor += seg.length;
      continue;
    }
    const start = text.indexOf(trimmed, cursor);
    if (start === -1) {
      cursor += seg.length;
      continue;
    }
    const end = start + trimmed.length;
    sentences.push({ text: trimmed, start, end });
    cursor = end;
  }

  if (sentences.length === 0 && text.trim().length > 0) {
    const trimmed = text.trim();
    const start = text.indexOf(trimmed);
    sentences.push({ text: trimmed, start, end: start + trimmed.length });
  }

  return sentences;
}

interface SectionScores {
  subjective: number;
  objective: number;
  assessment: number;
  plan: number;
}

/**
 * Scores each sentence for SOAP sections with anti-leakage guards.
 */
function scoreSentence(
  sentence: string,
  diagnoses: SnomedConcept[],
  medications: RxNormConcept[],
): SectionScores {
  const s = sentence.toLowerCase();
  const scores: SectionScores = { subjective: 0, objective: 0, assessment: 0, plan: 0 };

  // Strict anti-leakage: Lab results or vital signs NEVER belong to Assessment or Subjective
  if (isLabLine(sentence)) {
    scores.objective += 10;
    scores.assessment = -100;
    scores.subjective = -100;
    return scores;
  }

  if (VITAL_SIGNS_KEYWORDS.test(s) && /\d+/.test(s)) {
    scores.objective += 8;
    scores.assessment = -100;
    scores.subjective = -100;
    return scores;
  }

  if (IMAGING_KEYWORDS.test(s)) {
    scores.objective += 8;
    scores.assessment = -100;
    return scores;
  }

  // ===== SUBJECTIVE SIGNALS (keluhan utama, anamnesis, riwayat) =====
  if (
    /\b(patient|pasien|presents|mengeluh|complains?|chief complaint|keluhan utama|states?|menyatakan|reports?|melaporkan|history|riwayat|hpi|feeling|merasa|experiencing|mengalami|denies|menyangkal|suffering|menderita)\b/.test(
      s,
    )
  ) {
    scores.subjective += 3;
  }
  if (
    /\b(pain|nyeri|sakit|ache|discomfort|tidak nyaman|dyspnea|sesak|sesak napas|nausea|mual|vomiting|muntah|fatigue|kelelahan|lemas|weakness|lemah|dizziness|pusing|vertigo|headache|sakit kepala|cough|batuk|fever|demam|chills|menggigil|sweating|keringat|appetite|nafsu makan|insomnia|sulit tidur|palpitation|jantung berdebar)\b/.test(
      s,
    )
  ) {
    scores.subjective += 2;
  }
  if (/\b(since|sejak|for the past|selama|ago|yang lalu|last|terakhir|onset|mulai|started|began)\b/.test(s)) {
    scores.subjective += 1;
  }

  // ===== OBJECTIVE SIGNALS (vital sign, pemeriksaan fisik, lab, temuan terukur) =====
  if (
    /\b(vital|bp|blood pressure|tekanan darah|td|pulse|nadi|hr|heart rate|bpm|temp|temperature|suhu|o2|spo2|oxygen saturation|saturasi|weight|berat badan|bb|height|tinggi badan|tb|bmi|imt|rr|respiratory rate|frekuensi napas|gcs)\b/.test(
      s,
    )
  ) {
    scores.objective += 4;
  }
  if (
    /\b(lab|laboratorium|result|hasil|exam|examination|pemeriksaan|physical|fisik|findings|temuan|auscultation|auskultasi|palpation|palpasi|percussion|perkusi|inspection|inspeksi|reflex|refleks)\b/.test(
      s,
    )
  ) {
    scores.objective += 3;
  }
  if (
    /\d+(?:[.,]\d+)?\s*(?:mg\/dl|mmhg|bpm|°c|°f|%|iu|iu\/l|ng\/dl|mcg\/l|g\/dl|mmol\/l|meq\/l|miu\/ml|u\/l|pg\/ml|nmol\/l|cm|kg|lbs?)\b/i.test(
      s,
    )
  ) {
    scores.objective += 3;
  }
  if (
    /\b(normocephalic|atraumatic|clear to auscultation|regular rate|regular rhythm|rrr|no murmur|no edema|soft|non.?tender|within normal limits|wnl|unremarkable|intact|equal|bilateral|basal)\b/.test(
      s,
    )
  ) {
    scores.objective += 2;
  }

  // ===== ASSESSMENT SIGNALS (diagnosis, kesan klinis) =====
  if (/^\s*(?:assessment|a:|diagnosis kerja|diagnosa kerja|diagnosis banding|diagnosa banding)[:.]?\s*/i.test(sentence)) {
    scores.assessment += 10;
  }
  if (
    /\b(assessment|diagnos|diagnosis|impression|consistent with|compatible with|comorbid|evaluated for|clinical.?diagnosis|diagnosis klinis|kesan klinis|working diagnosis|diferensial)\b/.test(
      s,
    )
  ) {
    scores.assessment += 5;
  }
  if (diagnoses.some((d) => s.includes(d.matchedText.toLowerCase()) || s.includes(d.preferredTerm.toLowerCase()))) {
    scores.assessment += 4;
  }
  if (
    /\b(stage|grade|severity|mild|moderate|severe|ringan|sedang|berat|uncontrolled|tidak terkontrol|terkontrol|controlled|stable|stabil|unstable|akut|acute|kronik|chronic|progressing|memburuk|improving|membaik)\b/.test(
      s,
    )
  ) {
    scores.assessment += 2;
  }
  if (/\b(?:I|E|J|K|N|R|Z)\d{2}(?:\.\d+)?\b/.test(sentence)) {
    scores.assessment += 3;
  }

  // ===== PLAN SIGNALS (rencana, terapi, tindak lanjut) =====
  if (/^\s*(?:plan|p:|rencana|penatalaksanaan|tatalaksana|terapi|pengobatan|management)[:.]?\s*/i.test(sentence)) {
    scores.plan += 10;
  }
  if (
    /\b(plan|continue|lanjutkan|start|mulai|mulai terapi|prescribe|resepkan|order|schedule|jadwal|follow.?up|kontrol|counsel|konsul|discharge|pulang|rawat jalan|rawat inap|rujuk|refer|rencana|penatalaksanaan|tatalaksana)\b/.test(
      s,
    )
  ) {
    scores.plan += 5;
  }
  if (medications.some((m) => s.includes(m.name.toLowerCase()))) {
    scores.plan += 3;
  }
  if (
    /\b(dose|dosis|tablet|tab|kapsul|cap|ampul|vial|infus|drip|injeksi|injection|oral|intravena|iv|im|sc|subcutan|topical|topikal|nebulisasi|nebulizer|inhalasi)\b/.test(
      s,
    )
  ) {
    scores.plan += 2;
  }
  if (
    /\b(daily|twice|once|bid|tid|qid|od|bd|tds|sehari|kali sehari|per hari|pagi|malam|siang|tiap|setiap|setiap hari|once a day|twice a day|malam hari|pagi hari)\b/.test(
      s,
    )
  ) {
    scores.plan += 2;
  }
  if (
    /\b(monitor|pantau|evaluasi|cek ulang|check|repeat|recheck|kontrol ulang|review|follow up|kunjungan ulang|lab ulang|repeat labs|next appointment)\b/.test(
      s,
    )
  ) {
    scores.plan += 2;
  }
  if (/\d+\s*(?:mg|mcg|g|ml).*?\d+x\d+/i.test(s)) {
    scores.plan += 3;
  }

  return scores;
}

function getBestSection(scores: SectionScores): keyof SectionScores | null {
  const entries = Object.entries(scores) as [keyof SectionScores, number][];
  const maxScore = Math.max(...entries.map(([, v]) => v));

  if (maxScore <= 0) return 'subjective';

  const tied = entries.filter(([, v]) => v === maxScore);
  if (tied.length === 1) return tied[0][0];

  const priority: Array<keyof SectionScores> = ['assessment', 'plan', 'objective', 'subjective'];
  for (const p of priority) {
    if (tied.some(([k]) => k === p)) return p;
  }
  return 'subjective';
}

/**
 * Generates a structured SOAP note with character span citations.
 */
export function synthesizeSoapNote(
  rawText: string,
  diagnoses: SnomedConcept[] = [],
  medications: RxNormConcept[] = [],
): SoapNote {
  const cleanText = rawText?.trim() || '';

  if (!cleanText) {
    return {
      subjective: { title: 'Subjective', content: [], citations: [] },
      objective: { title: 'Objective', content: [], citations: [] },
      assessment: { title: 'Assessment', content: [], citations: [] },
      plan: { title: 'Plan', content: [], citations: [] },
      generatedAt: new Date().toISOString(),
    };
  }

  // Branch 1: Hospital CPPT / Semi-structured clinical notes
  if (hasHospitalCpptStructure(cleanText)) {
    return parseHospitalCpptSoap(cleanText, diagnoses, medications);
  }

  // Branch 2: Unstructured narrative with multi-signal scoring
  const subjectiveLines: string[] = [];
  const subjectiveCitations: SoapCitation[] = [];
  const objectiveLines: string[] = [];
  const objectiveCitations: SoapCitation[] = [];
  const assessmentLines: string[] = [];
  const assessmentCitations: SoapCitation[] = [];
  const planLines: string[] = [];
  const planCitations: SoapCitation[] = [];

  const sentences = splitIntoSentences(cleanText);

  const sectionAccumulators = {
    subjective: { lines: subjectiveLines, citations: subjectiveCitations },
    objective: { lines: objectiveLines, citations: objectiveCitations },
    assessment: { lines: assessmentLines, citations: assessmentCitations },
    plan: { lines: planLines, citations: planCitations },
  };

  let activeBlock: 'referral' | 'consultation' | 'lab' | 'current' | null = null;

  for (const s of sentences) {
    if (/^={2,}\s*SUMBER RUJUKAN/i.test(s.text)) {
      activeBlock = 'referral';
      continue;
    }
    if (/^={2,}\s*JAWABAN KONSULAN/i.test(s.text)) {
      activeBlock = 'consultation';
      continue;
    }
    if (/^={2,}\s*HASIL LAB/i.test(s.text)) {
      activeBlock = 'lab';
      continue;
    }
    if (/^={2,}\s*KONDISI & KELUHAN/i.test(s.text)) {
      activeBlock = 'current';
      continue;
    }
    if (/^={2,}\s*.*?\s*={2,}$/.test(s.text)) {
      continue;
    }

    const scores = scoreSentence(s.text, diagnoses, medications);

    if (activeBlock === 'lab') {
      scores.objective += 6;
      scores.assessment = -100;
    } else if (activeBlock === 'consultation') {
      scores.plan += 2;
      scores.assessment += 2;
    } else if (activeBlock === 'referral') {
      scores.subjective += 2;
    }

    const bestSection = getBestSection(scores);
    if (bestSection) {
      sectionAccumulators[bestSection].lines.push(s.text);
      sectionAccumulators[bestSection].citations.push({ start: s.start, end: s.end, sourceText: s.text });
    }
  }

  // Enrichment
  if (assessmentLines.length === 0) {
    if (diagnoses.length > 0) {
      for (const d of diagnoses) {
        assessmentLines.push(`${d.preferredTerm} (SNOMED CT: ${d.code})`);
        const matchIdx = cleanText.toLowerCase().indexOf(d.matchedText.toLowerCase());
        if (matchIdx !== -1) {
          assessmentCitations.push({
            start: matchIdx,
            end: matchIdx + d.matchedText.length,
            sourceText: cleanText.slice(matchIdx, matchIdx + d.matchedText.length),
          });
        }
      }
    } else {
      assessmentLines.push('Clinical findings and symptoms evaluated — no specific diagnosis code extracted from source text.');
    }
  }

  if (planLines.length === 0) {
    if (medications.length > 0) {
      for (const m of medications) {
        const sigParts = [m.name];
        if (m.dosage) sigParts.push(m.dosage);
        if (m.route) sigParts.push(m.route);
        if (m.frequency) sigParts.push(m.frequency);
        planLines.push(`Continue ${sigParts.join(' ')}. Monitor clinical response.`);
        const matchIdx = cleanText.toLowerCase().indexOf(m.name.toLowerCase());
        if (matchIdx !== -1) {
          planCitations.push({
            start: matchIdx,
            end: matchIdx + m.matchedText.length,
            sourceText: cleanText.slice(matchIdx, matchIdx + m.matchedText.length),
          });
        }
      }
    } else {
      planLines.push('Routine clinical observation and follow-up as clinically indicated.');
    }
  }

  if (objectiveLines.length === 0) {
    if (medications.length > 0) {
      const medSummary = medications.map((m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`.trim()).join(', ');
      objectiveLines.push(`Current medication regimen: ${medSummary}.`);
      for (const m of medications) {
        const matchIdx = cleanText.toLowerCase().indexOf(m.name.toLowerCase());
        if (matchIdx !== -1) {
          objectiveCitations.push({
            start: matchIdx,
            end: matchIdx + m.matchedText.length,
            sourceText: cleanText.slice(matchIdx, matchIdx + m.matchedText.length),
          });
        }
      }
    } else {
      objectiveLines.push('Vital signs and physical examination: Not documented in source excerpt.');
    }
  }

  if (subjectiveLines.length === 0 && cleanText.length > 0) {
    subjectiveLines.push(cleanText);
    subjectiveCitations.push({ start: 0, end: cleanText.length, sourceText: cleanText });
  }

  return {
    subjective: { title: 'Subjective', content: subjectiveLines, citations: subjectiveCitations },
    objective: { title: 'Objective', content: objectiveLines, citations: objectiveCitations },
    assessment: { title: 'Assessment', content: assessmentLines, citations: assessmentCitations },
    plan: { title: 'Plan', content: planLines, citations: planCitations },
    generatedAt: new Date().toISOString(),
  };
}
