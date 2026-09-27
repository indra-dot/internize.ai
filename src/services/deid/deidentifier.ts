/**
 * deidentifier.ts
 * On-device HIPAA Safe Harbor de-identification engine.
 * Covers all 18 Safe Harbor identifier categories (45 CFR §164.514(b)(2)).
 * Zero network calls — all processing is local regex + rule-based.
 */

import type { DeidEntity } from '../../types/research';

// ---------------------------------------------------------------------------
// Regex patterns for each Safe Harbor category
// ---------------------------------------------------------------------------

interface PatternDef {
  category: string;
  replacement: string;
  patterns: RegExp[];
}

const SAFE_HARBOR_PATTERNS: PatternDef[] = [
  // 1. Names — common Western name patterns (First [Middle] Last)
  {
    category: 'NAME',
    replacement: '[NAME]',
    patterns: [
      /\b([A-Z][a-z]{1,19})\s+([A-Z][a-z]{1,19})\s+([A-Z][a-z]{1,24})\b/g, // First Middle Last
      /\b([A-Z][a-z]{1,19})\s+([A-Z][a-z]{1,24})\b/g, // First Last
    ],
  },
  // 2. Geographic — street addresses
  {
    category: 'ADDRESS',
    replacement: '[ADDRESS]',
    patterns: [
      /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Rd|Ln|Dr|Way|Ct|Pl)\b\.?/gi,
    ],
  },
  // 3. ZIP codes (first 3 digits can remain per Safe Harbor only for large-population ZIPs — we redact all)
  {
    category: 'ZIP',
    replacement: '[ZIP]',
    patterns: [/\b\d{5}(?:-\d{4})?\b/g],
  },
  // 4. Dates — DOB, admission, discharge, death (keep year if >89 year age calc is not an issue)
  {
    category: 'DATE',
    replacement: '[DATE]',
    patterns: [
      /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, // MM/DD/YYYY
      /\b(?:0?[1-9]|[12]\d|3[01])-(?:0?[1-9]|1[0-2])-(?:19|20)\d{2}\b/g, // DD-MM-YYYY
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
      /\b(?:DOB|Date of Birth|D\.O\.B\.?)[:.\s]+(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/gi,
    ],
  },
  // 5. Phone numbers
  {
    category: 'PHONE',
    replacement: '[PHONE]',
    patterns: [/\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g],
  },
  // 6. Fax numbers (same pattern, labeled separately)
  {
    category: 'FAX',
    replacement: '[FAX]',
    patterns: [/\bfax[:.\s]+(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/gi],
  },
  // 7. Email addresses
  {
    category: 'EMAIL',
    replacement: '[EMAIL]',
    patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi],
  },
  // 8. Social Security Numbers
  {
    category: 'SSN',
    replacement: '[SSN]',
    patterns: [/\b\d{3}-\d{2}-\d{4}\b/g, /\bSSN[:.\s]+\d{3}-\d{2}-\d{4}\b/gi],
  },
  // 9. Medical Record Numbers
  {
    category: 'MRN',
    replacement: '[MRN]',
    patterns: [
      /\bMRN[:.\s#]+([A-Z0-9-]{4,12})\b/gi,
      /\bMedical Record(?:\s+Number)?[:.\s#]+([A-Z0-9-]{4,12})\b/gi,
      /\bMR#\s*(\d{4,10})\b/gi,
    ],
  },
  // 10. Health plan beneficiary numbers
  {
    category: 'HEALTH_PLAN_ID',
    replacement: '[HEALTH_PLAN_ID]',
    patterns: [/\b(?:Member|Beneficiary|Plan)\s*(?:ID|#|No\.?)[:.\s]+([A-Z0-9-]{6,20})\b/gi],
  },
  // 11. Account numbers
  {
    category: 'ACCOUNT_NUMBER',
    replacement: '[ACCOUNT_NUMBER]',
    patterns: [
      /\bAccount\s*(?:No\.?|Number|#)[:.\s]+([A-Z0-9-]{4,20})\b/gi,
      /\bAcct\.?\s*#[:.\s]+([A-Z0-9-]{4,20})\b/gi,
    ],
  },
  // 12. Certificate / license numbers
  {
    category: 'LICENSE_NUMBER',
    replacement: '[LICENSE_NUMBER]',
    patterns: [/\b(?:License|Certificate|Cert\.?)\s*(?:No\.?|#)[:.\s]+([A-Z0-9-]{4,20})\b/gi],
  },
  // 13. Vehicle identifiers
  {
    category: 'VEHICLE_ID',
    replacement: '[VEHICLE_ID]',
    patterns: [/\b(?:VIN|License Plate|Plate No\.?)[:.\s]+([A-Z0-9]{6,17})\b/gi],
  },
  // 14. Device identifiers and serial numbers
  {
    category: 'DEVICE_ID',
    replacement: '[DEVICE_ID]',
    patterns: [/\b(?:Device|Serial)\s*(?:ID|No\.?|#)[:.\s]+([A-Z0-9-]{6,20})\b/gi],
  },
  // 15. URLs
  {
    category: 'URL',
    replacement: '[URL]',
    patterns: [/https?:\/\/[^\s"'<>()]+/gi],
  },
  // 16. IP addresses
  {
    category: 'IP_ADDRESS',
    replacement: '[IP_ADDRESS]',
    patterns: [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  },
  // 17. Biometric identifiers (finger/voice prints — textual references)
  {
    category: 'BIOMETRIC',
    replacement: '[BIOMETRIC]',
    patterns: [
      /\b(?:fingerprint|voiceprint|retinal scan|biometric)\s*(?:ID|identifier)?[:.\s]+([A-Z0-9-]{6,20})\b/gi,
    ],
  },
  // 18. Full-face photographs and comparable images — textual filename references
  {
    category: 'IMAGE_REF',
    replacement: '[IMAGE_REF]',
    patterns: [/\b[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif|bmp|tiff)\b/gi],
  },
  // Bonus: Age if > 89 per Safe Harbor
  {
    category: 'AGE_OVER_89',
    replacement: '[AGE_OVER_89]',
    patterns: [/\b(9\d|[1-9]\d{2,})\s*(?:year[s]?(?:\s*old)?|y\.?o\.?)\b/gi],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DeidentificationResult {
  redactedText: string;
  entities: DeidEntity[];
}

/**
 * Runs all 18+ Safe Harbor pattern categories over the input text.
 * Returns the redacted string and a list of all detected+replaced entities.
 */
export function deidentifyText(rawText: string): DeidentificationResult {
  const entities: DeidEntity[] = [];
  let workingText = rawText;

  for (const def of SAFE_HARBOR_PATTERNS) {
    for (const pattern of def.patterns) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;

      const matches: { index: number; match: string }[] = [];
      let m = pattern.exec(workingText);
      while (m !== null) {
        matches.push({ index: m.index, match: m[0] });
        if (!pattern.global) break;
        m = pattern.exec(workingText);
      }

      // Replace in reverse order to preserve indices
      for (const { index, match } of matches.reverse()) {
        if (match.trim().length === 0) continue;
        entities.push({
          text: match,
          category: def.category,
          replacement: def.replacement,
          start: index,
          end: index + match.length,
        });
        workingText =
          workingText.slice(0, index) + def.replacement + workingText.slice(index + match.length);
      }
    }
  }

  // Sort entities by original start position for UI display
  entities.sort((a, b) => a.start - b.start);

  return { redactedText: workingText, entities };
}
