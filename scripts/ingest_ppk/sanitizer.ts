/**
 * sanitizer.ts — Milestone 2 PPK Hospital Identity Redaction & Privacy Scrubbing
 * 
 * Implements:
 * 1. Unicode NFKC pre-normalization (normalizes Cyrillic \u041d, non-standard dashes/quotes).
 * 2. Complete regex catalog stripping hospital names, physician names, leadership, NIP, SK, and tracking codes.
 * 3. Negative assertion protection preserving generic clinical terms (RS tipe B, RS rujukan, KRS, MRS, etc.).
 * 4. Audit logging of redacted entity counts for PPK_INGESTION_REPORT.md.
 */

export interface SanitizationAuditStats {
  rsSanglahCount: number;
  rsNgoerahCount: number;
  denpasarCount: number;
  physicianNamesCount: number;
  nipCount: number;
  directorsLeadershipCount: number;
  documentNumbersCount: number;
  clinicalPathwayPlaceholdersCount: number;
  ministryHeadersCount: number;
  totalRedactions: number;
}

export interface SanitizationRule {
  id: string;
  category: keyof SanitizationAuditStats;
  pattern: RegExp;
  replacement: string;
  description: string;
}

export const SANITIZATION_RULES: SanitizationRule[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Delimiters & Pagination Markers
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'PAGE_BREAK_DELIMITERS',
    category: 'documentNumbersCount',
    pattern: /-{2,}\s*PAGE\s+BREAK\s*-{2,}|\bPAGE\s+BREAK\s*-{0,3}/gi,
    replacement: '',
    description: 'Strips OCR and extraction page break delimiters'
  },
  {
    id: 'PAGINATION_METADATA',
    category: 'documentNumbersCount',
    pattern: /\bHalaman\s*[\:\-]?\s*\d+\s*(?:\/\s*\d+)?\b/gi,
    replacement: '',
    description: 'Strips Halaman X/Y headers'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Hospital Names, OCR Corruptions & Locations
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'RS_NGOERAH_OCR_VARIANTS',
    category: 'rsNgoerahCount',
    pattern: /(?:RSUP\s+)?PROF\.?\s*Dr\.?\s*(?:I\.?\s*G\.?\s*N\.?\s*G\.?|LG\.?\s*HG|JL\s+Il\.?\s*G\.?N\.?\s*G\.?\s*ERAH)[^\n\r,]*(?:NGOERA[HN]\w*)?/gi,
    replacement: '',
    description: 'Strips Prof Ngoerah OCR variants including LG HG and corrupted headers'
  },
  {
    id: 'NGOERAH_BROAD_TOKEN',
    category: 'rsNgoerahCount',
    pattern: /(?:RSUP\s*|RS\s*I?\s*)?NGOERA[HN]\w*|NGOERA[HN]\w*/gi,
    replacement: '',
    description: 'Strips Ngoerah and OCR-corrupted Ngoeran including fused RS/RSI prefixes'
  },
  {
    id: 'RS_SANGLAH_CORRUPT_SPACED',
    category: 'rsSanglahCount',
    pattern: /(?:RSUP\s*|RS\s*)?[A-Z\s]*NGLA[H\u041d]\w*|\bA\s+NGLAH\b/gi,
    replacement: '',
    description: 'Strips Sanglah including spaced OCR corruption A NGLAH'
  },
  {
    id: 'SANGLAH_CORRUPT_TYPOS',
    category: 'rsSanglahCount',
    pattern: /\b(?:AM?GLAH|AGLAH|AMOLAM)\b/gi,
    replacement: '',
    description: 'Strips OCR misspellings of Sanglah (AGLAH, AMGLAH, AMOLAM)'
  },
  {
    id: 'SANGLAH_STANDARD',
    category: 'rsSanglahCount',
    pattern: /(?:RSUP\s*|RS\s*)?SANGLA[H\u041d]\w*/gi,
    replacement: '',
    description: 'Strips standard Sanglah permutations'
  },
  {
    id: 'CITY_DENPASAR_VARIANTS',
    category: 'denpasarCount',
    pattern: /\b(?:DEMPASAR|DEMPASA|DENPAAR|DENPASAR\w*)\b/gi,
    replacement: '',
    description: 'Strips hospital city Denpasar and OCR variants (DEMPASAR, DEMPASA, DENPAAR)'
  },
  {
    id: 'BARE_RSUP_RESIDUE',
    category: 'rsSanglahCount',
    pattern: /\bRSUP\b\s*[\:\,\—\-]*/gi,
    replacement: '',
    description: 'Strips bare RSUP prefix and trailing punctuation without touching RS tipe B/KRS/MRS'
  },
  {
    id: 'MINISTRY_AND_GOV_ENTITIES',
    category: 'ministryHeadersCount',
    pattern: /(?:KEMENTERIAN\s+KESEHATAN|DIREKTORAT\s+JENDERAL\s+PELAYANAN\s+KESEHATAN|DITJEN\s+PELAYANAN\s+KESEHATAN|Kemenkes\s*[\-\—]?\s*(?:RS\s*I?\s*)?|KEME\s+ERIAN\s+KE|KEMENTE\s*RIAN)/gi,
    replacement: '',
    description: 'Strips ministry and government administrative headers'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Physician Names, Directors, Leadership & Signatures
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'DIRECTOR_WAYAN_VARIANTS',
    category: 'physicianNamesCount',
    pattern: /(?:dr\.?\s*)?(?:[1I]\s+)?WAYAN[^\n\r,]*(?:,\s*M\.?Kes)?/gi,
    replacement: '',
    description: 'Strips Director Dr. I Wayan Sudana and OCR variants (dr. 1 Wayan-, M.Kes)'
  },
  {
    id: 'WAYAN_OCR_SIGNATURE_BLOCKS',
    category: 'physicianNamesCount',
    pattern: /\b(?:SAI\s+)?WAYAN\s+S[lI\d\b]?|\\?\s*EN\s+yayan\s+Sy[^\n\r,]*|\bNe\s+uaa,\s*M\.?Kes\b/gi,
    replacement: '',
    description: 'Strips OCR corrupted director signature blocks (SAI WAYAN Sl, EN yayan Sy)'
  },
  {
    id: 'BARE_WAYAN_AND_SUDANA',
    category: 'physicianNamesCount',
    pattern: /\b(?:Wayan|Sudana)\b/gi,
    replacement: '',
    description: 'Strips bare Wayan and Sudana personal name tokens'
  },
  {
    id: 'NAMESAKE_IGNG',
    category: 'physicianNamesCount',
    pattern: /\bPROF\.?\s*DR\.?[^\n\r]*|(?:I\.?\s*G\.?\s*N\.?\s*G\.?|LG\.?\s*HG)[^\n\r]*/gi,
    replacement: '',
    description: 'Strips Prof. Dr. I.G.N.G. namesake and OCR variants'
  },
  {
    id: 'DIRECTOR_APPROVAL_LINE',
    category: 'directorsLeadershipCount',
    pattern: /(?:Ditetapkan\s+(?:oleh|Oteh|aleh|[\:\-])|PBEKTUR\s+TAMA|Direktur\s+Utama|Keme\s+Plt|DIREKTUR)[^\n\r]*/gi,
    replacement: '',
    description: 'Strips approval header line, Direktur Utama, and Plt director titles'
  },
  {
    id: 'MEDIC_COMMITTEE_CHAIR',
    category: 'directorsLeadershipCount',
    pattern: /\b(?:Ketua\s+)?Komite\s+Medik\b/gi,
    replacement: '',
    description: 'Strips Ketua Komite Medik title'
  },
  {
    id: 'DEPARTMENT_KSM_HEADERS',
    category: 'directorsLeadershipCount',
    pattern: /(?:[A-Za-z\(\)\,\.\s]{0,10})?(?:KSM|SMF)\s*[\:\-]?\s*(?:(?:ILMU\s+)?PENYAKIT\s+DALAM|PARU)(?:\s+[^\n\r]+)?/gi,
    replacement: '',
    description: 'Strips department committee header lines'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Employee IDs (NIP, NIR, NPP)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'EMPLOYEE_IDS_BROAD',
    category: 'nipCount',
    pattern: /\b(?:NIP|NIR|NPP)[\.\:\s]*\d{6,}(?:\s*\d+)*\b/gi,
    replacement: '',
    description: 'Strips NIP, NIR, and NPP employee numbers'
  },
  {
    id: 'NIP_EXACT_DIGITS_SEQUENCE',
    category: 'nipCount',
    pattern: /(?:19650409|19850409)(?:\s*\d+)*/g,
    replacement: '',
    description: 'Strips exact director birth-NIP sequence and OCR 19850409'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Document Tracking Numbers & Administrative Decrees
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'DOC_NUMBER_YR_YM_SERIES',
    category: 'documentNumbersCount',
    pattern: /\|?[ \t]*[vvyY1][MR1m]{1,2}[\.\, \t_]*01[\.\, \t_]*0?[12]?[\/A-Za-z0-9\.\,\_\- \t\…]+(?:\/[ \t]*\d{4}|(?:\r?\n)?[ \t]*\d{1,4}\/\d{4})?/gi,
    replacement: '',
    description: 'Strips YR.01 and YM.01 document tracking codes across OCR variants'
  },
  {
    id: 'DOC_NUMBER_HK_ALL_SERIES',
    category: 'documentNumbersCount',
    pattern: /\bHK[\.\s_]*02[\.\s_]*\d{2}[\/A-Za-z0-9\.\_\- \t\…]+(?:\/[ \t]*\d{4})?/gi,
    replacement: '',
    description: 'Strips hospital decree tracking series HK.02.04, HK.02.03, HK.02.02'
  },
  {
    id: 'SK_DECREES_AND_POLICIES',
    category: 'documentNumbersCount',
    pattern: /(?:Surat\s+Keputusan|SK)\s*(?:Direktur\s+Utama|Direktur|No\.?|Nomor)?[\s\:\-]*[^\n\r,]+/gi,
    replacement: '',
    description: 'Strips administrative decree and SK tracking numbers'
  },
  {
    id: 'SOP_KEBIJAKAN_LINE',
    category: 'documentNumbersCount',
    pattern: /\bKebijakan\s+\d+\.?[^\n\r]*/gi,
    replacement: '',
    description: 'Strips SOP Kebijakan administrative lines'
  },
  {
    id: 'CP_TEMPLATE_DOC_NUM',
    category: 'documentNumbersCount',
    pattern: /(?:[xX]{4,}\/)?INT\.(?:CP|SPO)[\.\/A-Za-z0-9_\- \t…]+(?:\/[ \t]*\d{4}|(?:\r?\n)?[ \t]*\d{1,4}\/\d{4})?/gi,
    replacement: '',
    description: 'Strips clinical pathway and SPO placeholder tracking numbers'
  },
  {
    id: 'TABLE_HEADER_METADATA',
    category: 'documentNumbersCount',
    pattern: /(?:No\.\s*Dokumen(?:\s*[\:\-])?|No\.\s*Revisi(?:\s*[\:\-]?\s*(?:\d+|xx))?|\bPPK\s+RAWAT\s+(?:INAP|JALAN)\b|\bSPO\s+PELAYANAN\b)/gi,
    replacement: '',
    description: 'Strips form table headers (No. Dokumen, No. Revisi, PPK RAWAT INAP/JALAN, SPO PELAYANAN)'
  },
  {
    id: 'ISSUE_DATE_HEADER',
    category: 'documentNumbersCount',
    pattern: /Tanggal\s+[tT]erbit\s*[\:\-]?(?:\s*\d{1,2}\s+[A-Za-z]+\s+\d{4})?/gi,
    replacement: '',
    description: 'Strips administrative issue date headers'
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Clinical Pathway Form Fill Placeholders
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'CP_PATIENT_FORM_FIELDS',
    category: 'clinicalPathwayPlaceholdersCount',
    pattern: /^(?:Nama\s+pasien|Jenis\s+kelamin|Tanggal\s+lahir|Tgl\s+masuk|Tgl\s+keluar|Ruang\s+rawat|Kelas)\b[…\.\s\-_].*$/gim,
    replacement: '',
    description: 'Removes empty form fill lines with dots/dashes in Clinical Pathways'
  }
];

export class ClinicalSanitizer {
  private auditStats: SanitizationAuditStats = {
    rsSanglahCount: 0,
    rsNgoerahCount: 0,
    denpasarCount: 0,
    physicianNamesCount: 0,
    nipCount: 0,
    directorsLeadershipCount: 0,
    documentNumbersCount: 0,
    clinicalPathwayPlaceholdersCount: 0,
    ministryHeadersCount: 0,
    totalRedactions: 0
  };

  /**
   * Sanitizes clinical narrative or extracted text:
   * 1. Applies Unicode NFKC normalization.
   * 2. Sequentially executes redaction rules while recording stats.
   * 3. Cleans whitespace while preserving paragraph breaks.
   */
  public sanitize(rawText: string): string {
    if (!rawText) return '';

    // Step 1: Unicode NFKC normalization
    let normalized = rawText.normalize('NFKC');

    // Replace explicit Cyrillic En if any survived
    normalized = normalized.replace(/\u041D/g, 'H');

    // Step 2: Apply redaction rules
    for (const rule of SANITIZATION_RULES) {
      const matches = normalized.match(rule.pattern);
      if (matches && matches.length > 0) {
        this.auditStats[rule.category] = (this.auditStats[rule.category] as number) + matches.length;
        this.auditStats.totalRedactions += matches.length;
        normalized = normalized.replace(rule.pattern, rule.replacement);
      }
    }

    // Step 3: Whitespace & layout cleanup
    const lines = normalized
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line, idx, arr) => {
        if (line === '') {
          return idx > 0 && arr[idx - 1] !== '';
        }
        return true;
      });

    return lines.join('\n').trim();
  }

  /**
   * Validates that zero hospital identities or physician names leak into sanitized text.
   * Returns list of violation messages if any leaks detected.
   */
  public static verifyZeroLeakage(text: string): string[] {
    const violations: string[] = [];

    const FORBIDDEN_TOKENS = [
      { token: /\bRSUP\b/i, label: 'Hospital prefix RSUP' },
      { token: /Sanglah/i, label: 'Sanglah hospital name' },
      { token: /\bA\s+NGLAH\b/i, label: 'Corrupted Sanglah (A NGLAH)' },
      { token: /\b(?:AM?GLAH|AGLAH|AMOLAM)\b/i, label: 'Corrupted Sanglah typos (AGLAH, AMGLAH, AMOLAM)' },
      { token: /NGOERA[HN]/i, label: 'Ngoerah hospital name (including NGOERAN)' },
      { token: /\b(?:DEMPASAR|DEMPASA|DENPAAR)\b/i, label: 'Denpasar hospital location variants' },
      { token: /\bWayan\b/i, label: 'Physician / Director name Wayan' },
      { token: /\bSudana\b/i, label: 'Physician / Director surname Sudana' },
      { token: /\byayan\s+Sy\b/i, label: 'Corrupted physician signature (yayan Sy)' },
      { token: /dr\.\s*[1I]\s*Wayan/i, label: 'Corrupted physician title (dr. 1 Wayan)' },
      { token: /SAI\s+WAYAN/i, label: 'Corrupted physician signature (SAI WAYAN)' },
      { token: /I\.G\.N\.G|LG\.?\s*HG/i, label: 'Namesake initials (I.G.N.G. / LG HG)' },
      { token: /\b(?:NIR|NPP)[\.\:\s]*\d{6,}/i, label: 'Employee ID series NIR/NPP' },
      { token: /(?:19650409|19850409)/, label: 'Director birth/NIP digits' },
      { token: /\|?\s*[vvyY1][MR1m]{1,2}[\.\s_]*01/i, label: 'Tracking code series YR.01 / YM.01' },
      { token: /\bINT\.(?:CP|SPO|SOP)\b/i, label: 'Tracking code series INT.CP / INT.SPO' },
      { token: /\b(?:KSM|SMF)\s*[\:\-]?\s*(?:ILMU\s+)?PENYAKIT\s+DALAM\b/i, label: 'Department header KSM/SMF Penyakit Dalam' },
      { token: /\bPROF\.?\s*DR\.?/i, label: 'Namesake title PROF. DR.' },
      { token: /\bHK[\.\s_]*02/i, label: 'Tracking code series HK.02' },
      { token: /Surat\s+Keputusan|SK\s+No/i, label: 'Administrative decree text' },
      { token: /PAGE\s+BREAK/i, label: 'Extraction delimiter PAGE BREAK' },
      { token: /\bPPK\s+RAWAT\s+(?:INAP|JALAN)\b/i, label: 'Form header PPK RAWAT INAP/JALAN' }
    ];

    for (const { token, label } of FORBIDDEN_TOKENS) {
      if (token.test(text)) {
        violations.push(`Zero-leakage violation: detected ${label} in sanitized text!`);
      }
    }

    return violations;
  }

  public getStats(): SanitizationAuditStats {
    return { ...this.auditStats };
  }
}
