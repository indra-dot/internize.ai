/**
 * guidelineSources.ts
 * ===================
 * Bibliographic references for the clinical protocols and scores shown in the app,
 * so a clinician can check each recommendation against its original source.
 *
 * Status meaning:
 * - `confirmed`: the publication details were checked and the source is a direct match.
 * - `partial`: the publication details were checked and the topic matches, but the
 *   dose or step in the protocol was NOT compared line by line with the guideline text.
 *   `note` says what still needs checking.
 * - `internal`: no verified guideline was found. The protocol is an institutional template.
 *
 * Do not add a citation from memory. Every entry must come from a search of the primary record.
 */

export interface GuidelineSource {
  id: string;
  citation: string;
  url?: string;
  status: 'confirmed' | 'partial' | 'internal';
  note?: string;
}

export const GUIDELINE_SOURCES: Record<string, GuidelineSource> = {
  // ── Scores ────────────────────────────────────────────────────────────────
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
  mehran2004: {
    id: 'mehran2004',
    citation:
      'Mehran R, et al. A simple risk score for prediction of contrast-induced nephropathy after percutaneous coronary intervention: development and initial validation. J Am Coll Cardiol. 2004;44(7):1393-1399.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/15464318/',
    status: 'partial',
    note: 'Bibliografi terkonfirmasi. Bobot tiap faktor belum dicocokkan dengan makalah asli.',
  },
  hurria2011: {
    id: 'hurria2011',
    citation:
      'Hurria A, et al. Predicting chemotherapy toxicity in older adults with cancer: a prospective multicenter study. J Clin Oncol. 2011;29:3457-3465.',
    status: 'partial',
    note: 'Cut-off skor berbeda antar sumber sekunder. Cek makalah asli sebelum dikutip.',
  },

  // ── Guidelines ────────────────────────────────────────────────────────────
  whelton2017: {
    id: 'whelton2017',
    citation:
      'Whelton PK, Carey RM, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension. 2018;71(6):e13-e115.',
    url: 'https://doi.org/10.1161/HYP.0000000000000066',
    status: 'partial',
    note: 'Ambang krisis hipertensi sudah dicek. Dosis nicardipine belum dicocokkan.',
  },
  esc_acs2023: {
    id: 'esc_acs2023',
    citation:
      'Byrne RA, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720-3826.',
    url: 'https://doi.org/10.1093/eurheartj/ehad191',
    status: 'partial',
    note: 'Bibliografi terkonfirmasi. Rekomendasi nitrat belum diverifikasi dari teks asli.',
  },
  spasovski2014: {
    id: 'spasovski2014',
    citation:
      'Spasovski G, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Nephrol Dial Transplant. 2014;29(Suppl 2).',
    url: 'https://doi.org/10.1093/ndt/gfu040',
    status: 'partial',
    note: 'Batas kecepatan koreksi natrium belum dicocokkan dengan teks asli.',
  },
  who_dengue2009: {
    id: 'who_dengue2009',
    citation:
      'World Health Organization. Dengue: guidelines for diagnosis, treatment, prevention and control. Geneva: WHO/TDR; 2009. WHO/HTM/NTD/DEN/2009.1.',
    url: 'https://www.who.int/publications/i/item/9789241547871',
    status: 'partial',
    note: 'Dokumen ini mencantumkan masa berlaku 2014. Cek apakah WHO sudah menerbitkan versi yang lebih baru.',
  },
  baveno7: {
    id: 'baveno7',
    citation:
      'de Franchis R, et al. (Baveno VII Faculty). Baveno VII - Renewing consensus in portal hypertension. J Hepatol. 2022;76(4):959-974.',
    url: 'https://doi.org/10.1016/j.jhep.2021.12.022',
    status: 'partial',
    note: 'Rekomendasi perdarahan varises akut belum dicocokkan dengan teks asli.',
  },
  acg_ulcer2021: {
    id: 'acg_ulcer2021',
    citation:
      'Laine L, et al. ACG Clinical Guideline: Upper Gastrointestinal and Ulcer Bleeding. Am J Gastroenterol. 2021;116(5):899-917.',
    url: 'https://doi.org/10.14309/ajg.0000000000001245',
    status: 'partial',
    note: 'Rekomendasi PPI dan endoskopi belum dicocokkan dengan teks asli.',
  },
  nih_oi: {
    id: 'nih_oi',
    citation:
      'Panel on Guidelines for the Prevention and Treatment of Opportunistic Infections in Adults and Adolescents with HIV. Guidelines for the Prevention and Treatment of Opportunistic Infections in Adults and Adolescents with HIV. NIH/CDC/HIVMA-IDSA. Pedoman daring, diperbarui berkala.',
    url: 'https://clinicalinfo.hiv.gov/en/node/13161',
    status: 'partial',
    note: 'Pedoman hidup. Cek tanggal revisi terbaru. Dosis belum dicocokkan.',
  },
  idsa_candida2016: {
    id: 'idsa_candida2016',
    citation:
      'Pappas PG, et al. Clinical Practice Guideline for the Management of Candidiasis: 2016 Update by the Infectious Diseases Society of America. Clin Infect Dis. 2016;62(4):e1-e50.',
    url: 'https://doi.org/10.1093/cid/civ933',
    status: 'partial',
    note: 'Rekomendasi lini pertama dan dosis belum dicocokkan dengan teks asli.',
  },
  cdc_sti2021: {
    id: 'cdc_sti2021',
    citation:
      'Workowski KA, et al. Sexually Transmitted Infections Treatment Guidelines, 2021. MMWR Recomm Rep. 2021;70(RR-4):1-187.',
    url: 'https://doi.org/10.15585/mmwr.rr7004a1',
    status: 'partial',
    note: 'Ada erratum yang dicatat CDC. Cek sebelum dikutip. Rejimen sifilis belum dicocokkan.',
  },
  ata2016: {
    id: 'ata2016',
    citation:
      'Ross DS, et al. 2016 American Thyroid Association Guidelines for Diagnosis and Management of Hyperthyroidism and Other Causes of Thyrotoxicosis. Thyroid. 2016;26(10):1343-1421.',
    url: 'https://doi.org/10.1089/thy.2016.0229',
    status: 'partial',
    note: 'Bagian krisis tiroid belum diverifikasi isinya.',
  },
  dhatariya2024: {
    id: 'dhatariya2024',
    citation:
      'Dhatariya KK, et al. Hyperglycemic Crises in Adults With Diabetes: A Consensus Report. Diabetes Care. 2024;47(8):1257-1275.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/39052901/',
    status: 'partial',
    note: 'Kriteria DKA dan HHS belum dicocokkan dengan tabel asli.',
  },
  ada_hospital2025: {
    id: 'ada_hospital2025',
    citation:
      'American Diabetes Association Professional Practice Committee. 16. Diabetes Care in the Hospital: Standards of Care in Diabetes-2025. Diabetes Care. 2025;48(Suppl 1).',
    status: 'partial',
    note: 'Target glukosa perioperatif belum dicocokkan dengan teks 2025.',
  },
  aringer2019: {
    id: 'aringer2019',
    citation:
      'Aringer M, et al. 2019 European League Against Rheumatism/American College of Rheumatology Classification Criteria for Systemic Lupus Erythematosus. Arthritis Rheumatol. 2019;71(9):1400-1412.',
    status: 'partial',
    note: 'Bibliografi terkonfirmasi. Bobot item belum dicocokkan dengan tabel asli.',
  },
  fanouriakis2020: {
    id: 'fanouriakis2020',
    citation:
      'Fanouriakis A, et al. 2019 Update of the Joint EULAR and ERA-EDTA recommendations for the management of lupus nephritis. Ann Rheum Dis. 2020;79(6):713-723.',
    status: 'partial',
    note: 'Ada pembaruan EULAR 2025 untuk nefritis lupus. Protokol perlu ditinjau terhadap versi itu.',
  },
  metcalf2025: {
    id: 'metcalf2025',
    citation:
      'Metcalf RA, et al. Platelet transfusion: AABB international clinical practice guideline (2025). JAMA. 2025.',
    url: 'https://doi.org/10.1001/jama.2025.7529',
    status: 'partial',
    note: 'DOI berasal dari sumber sekunder. Ambang trombosit pra-operasi belum dicocokkan dengan teks asli.',
  },
  wao2020: {
    id: 'wao2020',
    citation:
      'Cardona V, et al. World Allergy Organization anaphylaxis guidance 2020. World Allergy Organ J. 2020;13(10):100472.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/33204386/',
    status: 'partial',
    note: 'Bibliografi terkonfirmasi. Dosis epinefrin belum dicocokkan dengan teks asli.',
  },
  ukka2026: {
    id: 'ukka2026',
    citation:
      'UK Kidney Association. Clinical practice guideline: management of hyperkalaemia in adults (updated July 2026).',
    url: 'https://www.ukkidney.org/',
    status: 'partial',
    note: 'Pedoman Inggris, bukan pedoman Indonesia. Dokumen diambil dari hasil pencarian.',
  },

  // ── Fallback ──────────────────────────────────────────────────────────────
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
 * Explicit protocol → guideline mapping, by protocol id. Only topics with a verified
 * source are listed. Other protocols stay internal, and the UI says so.
 */
export const PROTOCOL_SOURCE_IDS: Record<string, string[]> = {
  'drip-nicardipine': ['whelton2017'],
  'drip-ntg-v1': ['esc_acs2023'],
  'drip-ntg-v2': ['esc_acs2023'],
  'koreksi-hiponatremia': ['spasovski2014'],
  'dss-dengue': ['who_dengue2009'],
  'ruptur-varises-esofagus': ['baveno7'],
  'ulkus-peptikum': ['acg_ulcer2021'],
  'profilaksis-pcp-toxo': ['nih_oi'],
  'terapi-pcp': ['nih_oi'],
  'terapi-toxo': ['nih_oi'],
  kriptosporidiosis: ['nih_oi'],
  'retinitis-cmv': ['nih_oi'],
  candidiasis: ['idsa_candida2016'],
  sifilis: ['cdc_sti2021'],
  'thyroid-storm': ['ata2016'],
  'kad-hhs': ['dhatariya2024'],
  'insulin-drip-basal': ['ada_hospital2025'],
  'gd-perioperatif': ['ada_hospital2025'],
  'acr-eular-sle-2019': ['aringer2019'],
  'metilpulse-dose': ['fanouriakis2020'],
  'protokol-cyclophosphamide': ['fanouriakis2020'],
  'pre-chemo-geriatri': ['hurria2011'],
  'mehran-cin-risk': ['mehran2004'],
  'transfusi-trombosit': ['metcalf2025'],
  'reaksi-hipersensitivitas': ['wao2020'],
  'triple-drug-hyperkalemia': ['ukka2026'],
};

/**
 * Returns the sources for a protocol. Combines the explicit mapping with score names
 * found in its text. Falls back to the internal label when nothing matches.
 */
export function getProtocolSources(protocol: {
  id: string;
  title: string;
  sections: Array<{ heading: string; items: string[] }>;
  scoringSystems?: Array<{ name: string }>;
}): GuidelineSource[] {
  const text = [
    protocol.title,
    ...protocol.sections.flatMap((sec) => [sec.heading, ...sec.items]),
    ...(protocol.scoringSystems ?? []).map((s) => s.name),
  ].join('\n');

  const ids = new Set<string>(PROTOCOL_SOURCE_IDS[protocol.id] ?? []);
  for (const { pattern, sourceId } of SCORE_KEYWORDS) {
    if (pattern.test(text)) ids.add(sourceId);
  }

  if (ids.size === 0) return [GUIDELINE_SOURCES.internal];
  return [...ids].map((id) => GUIDELINE_SOURCES[id]);
}
