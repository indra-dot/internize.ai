/**
 * guidelineSources.ts
 * ===================
 * Bibliographic references for the clinical scores and protocols shown in the app,
 * so a clinician can check each recommendation against its original source.
 *
 * Only citations that were checked against the primary record (or its PubMed/DOI
 * metadata) are listed here. Do not add a citation from memory. Entries marked
 * `partial` have a detail still to verify (noted in `note`).
 */

export interface GuidelineSource {
  id: string;
  citation: string;
  url?: string;
  status: 'confirmed' | 'partial' | 'internal';
  note?: string;
}

export const GUIDELINE_SOURCES: Record<string, GuidelineSource> = {
  rcri: {
    id: 'rcri',
    citation:
      'Lee TH, et al. Derivation and prospective validation of a simple index for prediction of cardiac risk of major noncardiac surgery. Circulation. 1999;100(10):1043-1049.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10477528/',
    status: 'confirmed',
  },
  ariscat: {
    id: 'ariscat',
    citation:
      'Canet J, et al. (ARISCAT Group). Prediction of postoperative pulmonary complications in a population-based surgical cohort. Anesthesiology. 2010;113(6):1338-1350.',
    url: 'https://doi.org/10.1097/ALN.0b013e3181fc6e0a',
    status: 'confirmed',
  },
  caprini: {
    id: 'caprini',
    citation:
      'Caprini JA, et al. Clinical assessment of venous thromboembolic risk in surgical patients. Semin Thromb Hemost. 1991;17(Suppl 3):304-312.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1754886/',
    status: 'confirmed',
  },
  improve: {
    id: 'improve',
    citation:
      'Decousus H, et al. (IMPROVE Investigators). Factors at admission associated with bleeding risk in medical patients: findings from the IMPROVE investigators. Chest. 2011;139(1):69-79.',
    status: 'partial',
    note: 'PMID belum diambil dari catatan primer. Cut-off skor diambil dari sumber sekunder.',
  },
  morse: {
    id: 'morse',
    citation:
      'Morse JM, Morse RM, Tylko SJ. Development of a scale to identify the fall-prone patient. Can J Aging. 1989;8(4):366-377.',
    url: 'https://doi.org/10.1017/S0714980800008576',
    status: 'confirmed',
  },
  internal: {
    id: 'internal',
    citation:
      'Templat protokol internal pusat pelatihan rumah sakit. Belum dipetakan ke pedoman nasional atau internasional.',
    status: 'internal',
  },
};

/** Keyword that identifies a score in protocol text, mapped to its source id. */
const SCORE_KEYWORDS: Array<{ pattern: RegExp; sourceId: string }> = [
  { pattern: /\bRCRI\b|Revised Cardiac Risk Index/i, sourceId: 'rcri' },
  { pattern: /\bARISCAT\b/i, sourceId: 'ariscat' },
  { pattern: /\bCaprini\b/i, sourceId: 'caprini' },
  { pattern: /\bIMPROVE\b/i, sourceId: 'improve' },
  { pattern: /\bMorse\b/i, sourceId: 'morse' },
];

/**
 * Returns the sources for a protocol, based on the scores its text actually uses.
 * Falls back to the internal label when no verified source matches.
 */
export function getProtocolSources(protocol: {
  title: string;
  sections: Array<{ heading: string; items: string[] }>;
  scoringSystems?: Array<{ name: string }>;
}): GuidelineSource[] {
  const text = [
    protocol.title,
    ...protocol.sections.flatMap((sec) => [sec.heading, ...sec.items]),
    ...(protocol.scoringSystems ?? []).map((s) => s.name),
  ].join('\n');

  const ids = new Set<string>();
  for (const { pattern, sourceId } of SCORE_KEYWORDS) {
    if (pattern.test(text)) ids.add(sourceId);
  }

  if (ids.size === 0) return [GUIDELINE_SOURCES.internal];
  return [...ids].map((id) => GUIDELINE_SOURCES[id]);
}
