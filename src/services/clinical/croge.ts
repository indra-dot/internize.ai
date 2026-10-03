/**
 * CROGE: Clinical Rules & Ontology Grounding Engine
 * Synchronous, deterministic clinical NLP engine (<5ms) for disease and medication extraction,
 * NegEx negation detection, SNOMED CT and RxNorm ontology resolution, and SOAP note synthesis.
 */

import type {
  ClinicalAnalysisResult,
  ClinicalEntity,
  RxNormConcept,
  SnomedConcept,
  SoapNote,
} from '../../types/clinical';
import { deidentifyText } from '../deid/deidentifier';
import {
  DOSAGE_REGEX,
  FREQUENCY_REGEX,
  ROUTE_REGEX,
  lookupRxNormConcepts,
} from './rxnormDictionary';
import { lookupSnomedConcepts } from './snomedDictionary';
import { synthesizeSoapNote } from './soapSynthesizer';

/**
 * Bilingual (Indonesian & English) NegEx-style clinical negation detector
 * with clause boundary awareness, medical symbol recognition, and ID disambiguation.
 */
export function isNegatedSpan(text: string, start: number, end: number): boolean {
  if (!text || start < 0) return false;

  const lower = text.toLowerCase();
  const preText = lower.slice(Math.max(0, start - 60), start);

  // 1. Check if "no" is an Indonesian abbreviation for "nomor" (e.g. "no rm", "no telp", "no hp", "no reg")
  const isIndoNomor = /\bno\.?\s*(?:rm|rekam\s*medis|telp|telepon|hp|registrasi|reg|antrian|kamar|bed|peserta|bpjs)\b/i.test(preText);

  // Filler words in both languages
  const fillers = '(?:(?:any|prior|known|reported|evidence of|signs of|history of|riwayat|keluhan|tanda|gejala|adanya|tampak|bukti|kejadian)\\s+)?';

  // Indonesian & English immediate pre-triggers
  const preTriggers = isIndoNomor
    ? '(?:not|denies|denied|denying|without|negative for|never had|rules out|ruled out|free of|tidak ada|tidak terdapat|tidak ditemukan|tidak pernah|tidak|tanpa|disangkal|menyangkal|bukan|nihil|belum ada|belum tampak|bebas dari|bebas|negatif)'
    : '(?:no|not|denies|denied|denying|without|negative for|never had|rules out|ruled out|free of|tidak ada|tidak terdapat|tidak ditemukan|tidak pernah|tidak|tanpa|disangkal|menyangkal|bukan|nihil|belum ada|belum tampak|bebas dari|bebas|negatif)';

  const immediateNegRegex = new RegExp(`\\b${preTriggers}\\s+${fillers}$`, 'i');
  if (immediateNegRegex.test(preText)) {
    return true;
  }

  // 2. Trigger in the immediate clause without conjunction cancellation
  // Conjunctions breaking negation scope: but, however, although, except, yet, namun, tetapi, melainkan, akan tetapi, kecuali
  const clauses = preText.split(/[.;\n]|\b(?:but|however|although|except|yet|namun|tetapi|melainkan|akan tetapi|kecuali)\b/i);
  const currentClause = clauses[clauses.length - 1] || '';

  const clauseNegTriggers = isIndoNomor
    ? '\\b(not|denies|denied|without|negative for|never had|ruled out|free of|tidak ada|tidak terdapat|tidak ditemukan|tidak pernah|tanpa|disangkal|menyangkal|bukan|nihil|belum ada|negatif)\\b'
    : '\\b(no|not|denies|denied|without|negative for|never had|ruled out|free of|tidak ada|tidak terdapat|tidak ditemukan|tidak pernah|tanpa|disangkal|menyangkal|bukan|nihil|belum ada|negatif)\\b';

  if (new RegExp(clauseNegTriggers, 'i').test(currentClause)) {
    return true;
  }

  // 3. Post-triggers within immediate following clause
  // Includes symbols: (-), (-/-), ( - ), : -
  // Includes Indonesian post-triggers: disangkal, tidak ada, negatif, nihil, diragukan, disingkirkan
  // Handles immediate triggers and compound lists (e.g. "mual muntah disangkal", "batuk dan pilek disangkal", "DM, HT disangkal")
  const postText = lower.slice(end, Math.min(lower.length, end + 60));
  const postClause = postText.split(/[.;\n]|\b(?:but|however|although|namun|tetapi|melainkan|akan tetapi)\b/i)[0] || '';

  // Immediate post-trigger
  const directPostNegRegex =
    /^\s*(?::\s*)?(?:\(\s*-\s*(?:\/\s*-\s*)?\)|-\s*(?:\/-\s*)?|\b(?:was ruled out|is ruled out|ruled out|is negative|was negative|unlikely|disangkal|tidak ada|negatif|nihil|diragukan|disingkirkan|belum tampak)\b)/i;
  if (directPostNegRegex.test(postClause)) {
    return true;
  }

  // Compound list post-trigger: allows a list of symptoms/diseases preceding a terminal negation trigger
  const listPostNegRegex =
    /^[\s,\w\/\-()]*(?:\b(?:dan|maupun|atau|serta|\/)\b[\s,\w\/\-()]*)*\b(?:disangkal|tidak ada|negatif|nihil|diragukan|disingkirkan|belum tampak|was ruled out|is ruled out|ruled out)\b/i;
  if (listPostNegRegex.test(postClause)) {
    return true;
  }

  return false;
}

/**
 * Extracts SNOMED CT concepts from clinical text.
 * Deduplicates by concept SCTID code and respects negation boundaries.
 */
export function extractSnomed(text: string): SnomedConcept[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanText = deidentifyText(text).redactedText;
  const matches = lookupSnomedConcepts(cleanText, (start, end) =>
    isNegatedSpan(cleanText, start, end),
  );

  return matches.map((m) => ({
    code: m.code,
    display: m.display,
    preferredTerm: m.preferredTerm,
    matchedText: m.matchedText,
    confidence: m.confidence,
    hierarchy: m.hierarchy,
    fsn: m.fsn,
  }));
}

/**
 * Extracts RxNorm medications and reconciles dosage, route, frequency, and SCD codes.
 */
export function extractRxNorm(text: string): RxNormConcept[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanText = deidentifyText(text).redactedText;
  const matches = lookupRxNormConcepts(cleanText);

  return matches.map((m) => ({
    rxcui: m.rxcui,
    name: m.name,
    termType: m.termType,
    ttyDisplay: m.ttyDisplay,
    dosage: m.dosage,
    route: m.route,
    frequency: m.frequency,
    matchedText: m.matchedText,
    confidence: m.confidence,
    scdRxcui: m.scdRxcui,
    scdName: m.scdName,
    reconciliationStatus: m.reconciliationStatus,
  }));
}

/**
 * Extracts all clinical entities (DISEASE, DRUG, DOSAGE, FREQUENCY, ROUTE) with character spans.
 */
export function extractEntities(text: string): ClinicalEntity[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanText = deidentifyText(text).redactedText;
  const entities: ClinicalEntity[] = [];
  let idCounter = 1;

  // 1. Diseases / Conditions via SNOMED lookup
  const snomedMatches = lookupSnomedConcepts(cleanText);
  for (const s of snomedMatches) {
    const isNeg = isNegatedSpan(cleanText, s.start, s.end);
    entities.push({
      id: `entity-${idCounter++}`,
      text: s.matchedText,
      label: 'DISEASE',
      start: s.start,
      end: s.end,
      confidence: s.confidence,
      isNegated: isNeg,
    });
  }

  // 2. Medications via RxNorm lookup
  const rxnormMatches = lookupRxNormConcepts(cleanText);
  for (const r of rxnormMatches) {
    entities.push({
      id: `entity-${idCounter++}`,
      text: r.name,
      label: 'DRUG',
      start: r.start,
      end: r.start + r.name.length,
      confidence: r.confidence,
      isNegated: false,
    });

    if (r.dosage) {
      DOSAGE_REGEX.lastIndex = 0;
      const dosageMatch = DOSAGE_REGEX.exec(r.matchedText);
      DOSAGE_REGEX.lastIndex = 0;
      if (dosageMatch) {
        entities.push({
          id: `entity-${idCounter++}`,
          text: dosageMatch[0],
          label: 'DOSAGE',
          start: r.start + dosageMatch.index,
          end: r.start + dosageMatch.index + dosageMatch[0].length,
          confidence: 0.95,
        });
      }
    }

    if (r.frequency) {
      FREQUENCY_REGEX.lastIndex = 0;
      const freqMatch = FREQUENCY_REGEX.exec(r.matchedText);
      FREQUENCY_REGEX.lastIndex = 0;
      if (freqMatch) {
        entities.push({
          id: `entity-${idCounter++}`,
          text: freqMatch[0],
          label: 'FREQUENCY',
          start: r.start + freqMatch.index,
          end: r.start + freqMatch.index + freqMatch[0].length,
          confidence: 0.95,
        });
      }
    }

    if (r.route) {
      ROUTE_REGEX.lastIndex = 0;
      const routeMatch = ROUTE_REGEX.exec(r.matchedText);
      ROUTE_REGEX.lastIndex = 0;
      if (routeMatch) {
        entities.push({
          id: `entity-${idCounter++}`,
          text: routeMatch[0],
          label: 'ROUTE',
          start: r.start + routeMatch.index,
          end: r.start + routeMatch.index + routeMatch[0].length,
          confidence: 0.95,
        });
      }
    }
  }

  // Sort entities by start offset ascending
  return entities.sort((a, b) => a.start - b.start);
}

/**
 * Generates a structured SOAP note from raw clinical narrative.
 */
export function generateSoap(text: string): SoapNote {
  const cleanText = deidentifyText(text).redactedText;
  const diagnoses = extractSnomed(cleanText);
  const medications = extractRxNorm(cleanText);
  return synthesizeSoapNote(cleanText, diagnoses, medications);
}

/**
 * Runs full deterministic clinical analysis in <5ms with zero external network calls.
 */
export async function analyze(text: string): Promise<ClinicalAnalysisResult> {
  const t0 = performance.now();

  const cleanText = deidentifyText(text).redactedText;
  const diagnoses = extractSnomed(cleanText);
  const medications = extractRxNorm(cleanText);
  const soapNote = synthesizeSoapNote(cleanText, diagnoses, medications);

  const duration = Math.max(1, Math.round(performance.now() - t0));

  return {
    rawText: text,
    soapNote,
    diagnoses,
    medications,
    executionTimeMs: duration,
    inferenceDevice: 'cpu',
  };
}

/**
 * Static engine class adhering to ReferenceClinicalEngine interface contract.
 */
export const CrogeEngine = {
  extractSnomed,
  extractRxNorm,
  extractEntities,
  generateSoap,
  analyze,
};

// Alias for backwards compatibility with test harnesses
export const ReferenceClinicalEngine = CrogeEngine;

export default CrogeEngine;
