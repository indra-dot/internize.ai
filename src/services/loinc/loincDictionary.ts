/**
 * loincDictionary.ts
 * Curated LOINC biomarker dictionary for common lab analytes.
 * Each entry contains the LOINC code, display name, UCUM unit(s),
 * regex patterns to extract values from narrative text,
 * and reference ranges for abnormal flag derivation.
 */

export interface LoincEntry {
  loincCode: string;
  testName: string;
  longCommonName: string;
  synonyms: string[];
  ucumUnit: string;
  /** Regex to capture numeric value + optional unit from text */
  valuePattern: RegExp;
  referenceRange?: string;
  /** Thresholds for flag derivation (in the canonical unit) */
  low?: number;
  high?: number;
}

export const LOINC_DICTIONARY: LoincEntry[] = [
  // ─── Lipids ───────────────────────────────────────────────────────────────
  {
    loincCode: '2571-8',
    testName: 'Triglycerides',
    longCommonName: 'Triglycerides [Mass/volume] in Serum or Plasma',
    synonyms: ['triglyceride', 'triglycerides', 'trig', 'TRIG', 'TG'],
    ucumUnit: 'mg/dL',
    valuePattern:
      /\b(?:triglycerides?|trig|TG)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L)?\b/gi,
    referenceRange: '< 150 mg/dL',
    high: 150,
  },
  {
    loincCode: '2093-3',
    testName: 'Cholesterol, Total',
    longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma',
    synonyms: ['cholesterol', 'total cholesterol', 'CHOL', 'TC'],
    ucumUnit: 'mg/dL',
    valuePattern: /\b(?:total\s+)?cholesterol\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L)?\b/gi,
    referenceRange: '< 200 mg/dL',
    high: 200,
  },
  {
    loincCode: '18262-6',
    testName: 'LDL Cholesterol',
    longCommonName: 'LDL Cholesterol [Mass/volume] in Serum or Plasma by Direct assay',
    synonyms: ['LDL', 'LDL cholesterol', 'LDL-C', 'low density lipoprotein'],
    ucumUnit: 'mg/dL',
    valuePattern: /\bLDL(?:[-\s]C(?:holesterol)?)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mg\/dL)?\b/gi,
    referenceRange: '< 100 mg/dL',
    high: 100,
  },
  {
    loincCode: '2085-9',
    testName: 'HDL Cholesterol',
    longCommonName: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma',
    synonyms: ['HDL', 'HDL cholesterol', 'HDL-C', 'high density lipoprotein'],
    ucumUnit: 'mg/dL',
    valuePattern: /\bHDL(?:[-\s]C(?:holesterol)?)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mg\/dL)?\b/gi,
    referenceRange: '> 40 mg/dL',
    low: 40,
  },
  // ─── Glucose / Metabolic ──────────────────────────────────────────────────
  {
    loincCode: '2345-7',
    testName: 'Glucose',
    longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
    synonyms: ['glucose', 'blood glucose', 'fasting glucose', 'GLU', 'BG', 'GDS', 'GDP', 'GD2PP', 'GDA', 'BS', 'BSS', 'BST', 'BSP', 'gula darah'],
    ucumUnit: 'mg/dL',
    valuePattern:
      /\b(?:(?:fasting\s+)?blood\s+glucose|glucose|glukosa|gds|gdp|gd2pp|gda|bss|bst|bsp|blood\s*sugar|bs(?!\s*(?:mg|amp|tab\b|bedah\s*saraf))|gula\s*darah)(?:\s*(?:sewaktu|acak|puasa|2\s*jam\s*(?:pp|post\s*prandial)|terjadwal|saat\s*ini|kontrol|evaluasi|pre-?meal|post-?meal|pagi|siang|sore|malam|bedtime|subuh))*(?:\s*(?:pk\.?|pukul|jam|\()\s*\d{1,2}[.:]\d{2}(?:\s*(?:wib|wita|wit))?\s*\)?)?[^\S\r\n]*[:=]?[^\S\r\n]*(\d+(?:[.,]\d+)*)(?!\s*[\/\-]\s*\d)\s*(?:mg\/dL|mmol\/L)?\b/gi,
    referenceRange: '70–99 mg/dL (fasting)',
    low: 70,
    high: 99,
  },
  {
    loincCode: '4548-4',
    testName: 'Hemoglobin A1c',
    longCommonName: 'Hemoglobin A1c/Hemoglobin.total in Blood',
    synonyms: ['HbA1c', 'A1c', 'HgbA1C', 'hemoglobin a1c', 'glycated hemoglobin'],
    ucumUnit: '%',
    valuePattern: /\b(?:HbA1c|A1c|HgbA1C)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%?\b/gi,
    referenceRange: '< 5.7%',
    high: 5.7,
  },
  {
    loincCode: '2160-0',
    testName: 'Creatinine',
    longCommonName: 'Creatinine [Mass/volume] in Serum or Plasma',
    synonyms: ['creatinine', 'Cr', 'SCr', 'serum creatinine'],
    ucumUnit: 'mg/dL',
    valuePattern: /\b(?:serum\s+)?creatinine\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mg\/dL)?\b/gi,
    referenceRange: '0.7–1.3 mg/dL',
    low: 0.7,
    high: 1.3,
  },
  // ─── Hormones ─────────────────────────────────────────────────────────────
  {
    loincCode: '2986-8',
    testName: 'Testosterone',
    longCommonName: 'Testosterone [Mass/volume] in Serum or Plasma',
    synonyms: ['testosterone', 'total testosterone', 'T', 'serum testosterone'],
    ucumUnit: 'ng/dL',
    valuePattern: /\b(?:total\s+)?testosterone\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:ng\/dL|nmol\/L)?\b/gi,
    referenceRange: '300–1000 ng/dL (male)',
    low: 300,
    high: 1000,
  },
  {
    loincCode: '3016-3',
    testName: 'TSH',
    longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma',
    synonyms: ['TSH', 'thyroid stimulating hormone', 'thyrotropin'],
    ucumUnit: 'mIU/L',
    valuePattern: /\bTSH\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:mIU\/L|uIU\/mL|mU\/L)?\b/gi,
    referenceRange: '0.4–4.0 mIU/L',
    low: 0.4,
    high: 4.0,
  },
  // ─── Complete Blood Count ─────────────────────────────────────────────────
  {
    loincCode: '718-7',
    testName: 'Hemoglobin',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    synonyms: ['hemoglobin', 'Hgb', 'Hb', 'haemoglobin'],
    ucumUnit: 'g/dL',
    valuePattern: /\b(?:Hgb|Hb|hemoglobin)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:g\/dL)?\b/gi,
    referenceRange: '13.5–17.5 g/dL (male)',
    low: 13.5,
    high: 17.5,
  },
  {
    loincCode: '777-3',
    testName: 'Platelets',
    longCommonName: 'Platelets [#/volume] in Blood by Automated count',
    synonyms: ['platelets', 'PLT', 'platelet count'],
    ucumUnit: '10^3/uL',
    valuePattern:
      /\b(?:PLT|platelets?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:10\^3\/uL|K\/uL|x10\^3\/uL)?\b/gi,
    referenceRange: '150–400 ×10³/µL',
    low: 150,
    high: 400,
  },
  // ─── Liver / Renal ────────────────────────────────────────────────────────
  {
    loincCode: '1742-6',
    testName: 'ALT',
    longCommonName: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma',
    synonyms: ['ALT', 'SGPT', 'alanine aminotransferase'],
    ucumUnit: 'U/L',
    valuePattern: /\b(?:ALT|SGPT)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:U\/L|IU\/L)?\b/gi,
    referenceRange: '7–56 U/L',
    high: 56,
  },
  {
    loincCode: '1920-8',
    testName: 'AST',
    longCommonName: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma',
    synonyms: ['AST', 'SGOT', 'aspartate aminotransferase'],
    ucumUnit: 'U/L',
    valuePattern: /\b(?:AST|SGOT)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:U\/L|IU\/L)?\b/gi,
    referenceRange: '10–40 U/L',
    high: 40,
  },
];
