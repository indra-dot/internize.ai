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
  // 1. URLs
  {
    category: 'URL',
    replacement: '[URL]',
    patterns: [/https?:\/\/[^\s"'<>()]+/gi],
  },
  // 2. Email addresses
  {
    category: 'EMAIL',
    replacement: '[EMAIL]',
    patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi],
  },
  // 3. Medical Record Numbers (Indonesian & International MRN)
  {
    category: 'MRN',
    replacement: '[MRN]',
    patterns: [
      /\b(?:No\.?\s*RM|RM|NRM|MRN|No\.?\s*Rekam\s*Medis|Nomor\s*Rekam\s*Medis|Rekam\s*Medis|Medical\s*Record(?:\s*Number)?)[:.\s#]+(?=[A-Za-z0-9\-./]*\d)(?:[A-Za-z0-9\/-]|\.(?=\d)){3,16}\b/gi,
      /\bMR#\s*(\d{4,10})\b/gi,
    ],
  },
  // 4. IP addresses
  {
    category: 'IP_ADDRESS',
    replacement: '[IP_ADDRESS]',
    patterns: [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  },
  // 5a. Indonesian NIK (16-digit integer)
  {
    category: 'SSN',
    replacement: '[NIK]',
    patterns: [
      /\b(?:NIK|No\.?\s*KTP)[:.\s#]*([1-9]\d{15})\b/gi,
      /\b[1-9]\d{15}\b/g,
    ],
  },
  // 5b. Social Security Numbers (US)
  {
    category: 'SSN',
    replacement: '[SSN]',
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/g,
      /\bSSN[:.\s]+\d{3}-\d{2}-\d{4}\b/gi,
    ],
  },
  // 6a. Indonesian BPJS Kesehatan (13-digit integer)
  {
    category: 'HEALTH_PLAN_ID',
    replacement: '[BPJS]',
    patterns: [
      /\b(?:BPJS(?:\s+Kesehatan)?|No\.?\s*Kartu(?:\s*BPJS)?|No\.?\s*Peserta|No\.?\s*BPJS)[:.\s#]*([0-9-]{13,16})\b/gi,
      /\b\d{13}\b/g,
    ],
  },
  // 6b. Health plan beneficiary numbers (Western)
  {
    category: 'HEALTH_PLAN_ID',
    replacement: '[HEALTH_PLAN_ID]',
    patterns: [
      /\b(?:Member|Beneficiary|Plan)\s*(?:ID|#|No\.?)[:.\s]+([A-Z0-9-]{6,20})\b/gi,
    ],
  },
  // 7. Phone numbers (Indonesian mobile, WA, landlines, and US phone)
  {
    category: 'PHONE',
    replacement: '[PHONE]',
    patterns: [
      /\b(?:Telp(?:\.\|on)?|HP|WA|WhatsApp|Kontak|Mobile|Phone)[:.\s]+(?:\(?\+?62[\s.-]?|\(?0)[0-9\s.()-]{6,15}\d\b/gi,
      /\+62[\s.-]?8[1-9][0-9\s.-]{6,12}\d\b/g,
      /\b08[1-9][0-9\s.-]{6,12}\d\b/g,
      /\b628[1-9][0-9\s.-]{6,12}\d\b/g,
      /(?:\(0\d{2,3}\)|\b0\d{2,3})[\s.-]?(?:\d{5,8}|\d{3,4}[\s.-]?\d{3,4})\b/g,
      /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    ],
  },
  // 8. Fax numbers
  {
    category: 'FAX',
    replacement: '[FAX]',
    patterns: [
      /\bfax[:.\s]+(?:\+?62[\s.-]?|0|\+1)[0-9\s.-]{7,15}\d\b/gi,
      /\bfax[:.\s]+(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/gi,
    ],
  },
  // 9. Geographic — street addresses (Indonesian & Western)
  {
    category: 'ADDRESS',
    replacement: '[ADDRESS]',
    patterns: [
      /\bAlamat[:.\s]+[^\n\r]+/gi,
      /\b(?:Jl\.?|Jalan|Gang|Gg\.?)\s+[A-Z0-9][a-zA-Z0-9.'-]+(?:\s+(?:No\.?\s*\d+[A-Z]?|[A-Z0-9][a-zA-Z0-9.'-]+))*(?:\s+No\.?\s*\d+[A-Z]?)?/gi,
      /\b(?:RT|RW)\.?\s*\d{1,3}(?:\s*[\/]\s*(?:RT|RW)?\.?\s*\d{1,3})?\b/gi,
      /\b(?:Kel(?:urahan)?|Desa)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,
      /\b(?:Kec(?:amatan)?)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,
      /\b(?:Kab(?:upaten)?|Kota)\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g,
      /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Rd|Ln|Dr|Way|Ct|Pl)\b\.?/gi,
    ],
  },
  // 10. ZIP codes (protected against platelet and leukocyte lab counts /uL, /mm3)
  {
    category: 'ZIP',
    replacement: '[ZIP]',
    patterns: [/\b\d{5}(?:-\d{4})?\b(?!\s*(?:\/|per\s+|sel|mg|ug|mcg|uL|\u00B5L|mm3|IU|U|x10))/g],
  },
  // 11. Dates — DOB, admission, Indonesian spelled months, slash/hyphen/dot dates
  {
    category: 'DATE',
    replacement: '[DATE]',
    patterns: [
      /\b(?:DOB|Date of Birth|D\.O\.B\.?|Tgl\s*Lahir|Tanggal\s*Lahir|Tgl\s*Masuk|Tanggal\s*Masuk)[:.\s]+(?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:19|20)\d{2}\b/gi,
      /\b(?:0?[1-9]|[12]\d|3[01])[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:19|20)\d{2}\b/g,
      /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agu(?:stus)?|Ags|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)\s+(?:19|20)\d{2}\b/gi,
      /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/gi,
    ],
  },
  // 12. Names — Indonesian honorifics, doctors/DPJP, labeled patients, Western names
  {
    category: 'NAME',
    replacement: '[NAME]',
    patterns: [
      /\b(?:Tn|Ny|Nn|By|Sdr|Sdri|Bp|Bpk)\.?\s+(?:(?:Ny\.?\s+)?[A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3})\b/g,
      /\b(?:An|an)\.?\s+(?!(?:defisiensi|aplastik|hemolitik|gravis|pernisiosa|renal|normositik|mikrositik|makrositik|megaloblastik|sideroblastik|ec|akut|kronik|pasien|dokter)\b)(?:[A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3})\b/g,
      /\b(?:Ibu|ibu)\.?\s+(?!(?:jari|hamil|menyusui|kandung|bayi)\b)(?:[A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3})\b/g,
      /\b(?:dr\.|drg\.|Dr\.|Dokter|dokter|DPJP)[:.\s]+(?:dr\.?\s+)?([A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3}(?:,\s*Sp\.[A-Z]{1,4}(?:-[A-Z]{1,4})?)?)\b/g,
      /\b(?:Pasien|Nama(?:\s*Pasien)?)[:.\s]+(?!(?:An\.?\s+(?:defisiensi|aplastik|hemolitik|gravis|pernisiosa|renal|normositik|mikrositik|makrositik|megaloblastik|sideroblastik|ec|akut|kronik)|Anemia\b|RM\b|ICU\b|IGD\b|HCU\b|Bangsal\b|Ruang\b)\b)([A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){0,3})\b/g,
      /(?!\b(?:Medical Record|Rekam Medis|Rumah Sakit|Tanda Vital|Daftar Masalah|Catatan Perkembangan|Tgl Lahir|Tanggal Lahir|Tgl Masuk|Tanggal Masuk|Pasien|Curiga|Evaluasi|Terapi|Riwayat|Kesan|Diagnosis|Problem|Suspek|Observasi|Kasus|Status|Kondisi|Anemia|Defisiensi|Aplastik|Hemolitik)\b)\b([A-Z][a-z]{1,19})\s+(?!(?:An(?:\.|\b)|Anemia\b))([A-Z][a-z]{1,19})\s+(?!(?:An(?:\.|\b)|Anemia\b))([A-Z][a-z]{1,24})\b/g,
      /(?!\b(?:Medical Record|Rekam Medis|Rumah Sakit|Tanda Vital|Daftar Masalah|Catatan Perkembangan|Tgl Lahir|Tanggal Lahir|Tgl Masuk|Tanggal Masuk|Pasien|Curiga|Evaluasi|Terapi|Riwayat|Kesan|Diagnosis|Problem|Suspek|Observasi|Kasus|Status|Kondisi|Anemia|Defisiensi|Aplastik|Hemolitik)\b)\b([A-Z][a-z]{1,19})\s+(?!(?:An(?:\.|\b)|Anemia\b))([A-Z][a-z]{1,24})\b/g,
    ],
  },
  // 13. Account numbers
  {
    category: 'ACCOUNT_NUMBER',
    replacement: '[ACCOUNT_NUMBER]',
    patterns: [
      /\bAccount\s*(?:No\.?|Number|#)[:.\s]+([A-Z0-9-]{4,20})\b/gi,
      /\bAcct\.?\s*#[:.\s]+([A-Z0-9-]{4,20})\b/gi,
    ],
  },
  // 14. Certificate / license numbers
  {
    category: 'LICENSE_NUMBER',
    replacement: '[LICENSE_NUMBER]',
    patterns: [/\b(?:License|Certificate|Cert\.?)\s*(?:No\.?|#)[:.\s]+([A-Z0-9-]{4,20})\b/gi],
  },
  // 15. Vehicle identifiers
  {
    category: 'VEHICLE_ID',
    replacement: '[VEHICLE_ID]',
    patterns: [/\b(?:VIN|License Plate|Plate No\.?)[:.\s]+([A-Z0-9]{6,17})\b/gi],
  },
  // 16. Device identifiers and serial numbers
  {
    category: 'DEVICE_ID',
    replacement: '[DEVICE_ID]',
    patterns: [/\b(?:Device|Serial)\s*(?:ID|No\.?|#)[:.\s]+([A-Z0-9-]{6,20})\b/gi],
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

export type DeidentificationEntity = DeidEntity;

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
