/**
 * internize.ai — Sp.PD Internal Medicine Clinical Scaffolding & Knowledge Engine
 *
 * 100% on-device, zero-egress, deterministic clinical expert engine for Dokter Spesialis Penyakit Dalam (Sp.PD).
 * Covers 11 Divisi IPD PAPDI:
 * 1. Endokrin & Metabolik
 * 2. Ginjal & Hipertensi (Nefrologi)
 * 3. Tropik & Infeksi
 * 4. Kardiovaskular
 * 5. Pulmonologi
 * 6. Gastroenterohepatologi
 * 7. Hematologi & Onkologi Medik
 * 8. Reumatologi
 * 9. Alergi & Imunologi Klinis
 * 10. Geriatri
 * 11. Psikosomatik & Kedokteran Holistik
 *
 * Adaptive Workflows:
 * - Mode Jawab Konsul TS (Pre-Op Clearance, Rawat Bersama, Evaluasi Akut)
 * - Mode Periksa Pasien (POMR Bangsal & Poliklinik: #1, #2, #3... Pdx, Ptx, Pmx, Pex)
 * - Mode Ringkas Kasus (Resume Medis, Active Problems, Abnormal Labs)
 */

import {
  type ClinicalProtocolTemplate,
  matchProtocols,
  calculateARISCAT,
  calculateCaprini,
  calculateImprove,
  calculateDeliriumPAPDI,
  calculateMorse,
} from './protocols';

export type InternalMedicineDivision =
  | 'endokrin'
  | 'ginjal'
  | 'tropik'
  | 'kardio'
  | 'pulmo'
  | 'gastro'
  | 'hemato'
  | 'reuma'
  | 'alergi'
  | 'geriatri'
  | 'psikosomatik';

export interface DivisionMeta {
  id: InternalMedicineDivision;
  nameIndonesian: string;
  nameEnglish: string;
  badgeColor: string;
  iconName: string;
}

export const PAPDI_DIVISIONS: Record<InternalMedicineDivision, DivisionMeta> = {
  endokrin: {
    id: 'endokrin',
    nameIndonesian: 'Endokrin, Nutrisi & Metabolik',
    nameEnglish: 'Endocrinology & Metabolism',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    iconName: 'Flame',
  },
  ginjal: {
    id: 'ginjal',
    nameIndonesian: 'Ginjal & Hipertensi (Nefrologi)',
    nameEnglish: 'Nephrology & Hypertension',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    iconName: 'Activity',
  },
  tropik: {
    id: 'tropik',
    nameIndonesian: 'Tropik & Infeksi',
    nameEnglish: 'Infectious Diseases & Tropical Medicine',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    iconName: 'ShieldAlert',
  },
  kardio: {
    id: 'kardio',
    nameIndonesian: 'Kardiovaskular',
    nameEnglish: 'Cardiovascular Medicine',
    badgeColor: 'bg-red-100 text-red-900 border-red-300',
    iconName: 'HeartPulse',
  },
  pulmo: {
    id: 'pulmo',
    nameIndonesian: 'Pulmonologi & Respirologi',
    nameEnglish: 'Pulmonology',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    iconName: 'Wind',
  },
  gastro: {
    id: 'gastro',
    nameIndonesian: 'Gastroenterohepatologi',
    nameEnglish: 'Gastroenterology & Hepatology',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    iconName: 'Stomach',
  },
  hemato: {
    id: 'hemato',
    nameIndonesian: 'Hematologi & Onkologi Medik',
    nameEnglish: 'Hematology & Medical Oncology',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    iconName: 'Droplet',
  },
  reuma: {
    id: 'reuma',
    nameIndonesian: 'Reumatologi',
    nameEnglish: 'Rheumatology',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    iconName: 'Bone',
  },
  alergi: {
    id: 'alergi',
    nameIndonesian: 'Alergi & Imunologi Klinis',
    nameEnglish: 'Allergy & Clinical Immunology',
    badgeColor: 'bg-pink-100 text-pink-900 border-pink-300',
    iconName: 'ShieldCheck',
  },
  geriatri: {
    id: 'geriatri',
    nameIndonesian: 'Geriatri (Kedokteran Lansia)',
    nameEnglish: 'Geriatric Medicine',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    iconName: 'UserCheck',
  },
  psikosomatik: {
    id: 'psikosomatik',
    nameIndonesian: 'Psikosomatik & Kedokteran Holistik',
    nameEnglish: 'Psychosomatic Medicine',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    iconName: 'Brain',
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Lab & Vitals Extraction Interfaces
// ──────────────────────────────────────────────────────────────────────────────

export interface ParsedVitals {
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  spO2?: number;
  gcs?: string;
  rawMatched: Record<string, string>;
}

export type LabSpecimenType =
  | 'serum'
  | 'lcs'
  | 'urin'
  | 'feses'
  | 'asites'
  | 'pleura'
  | 'darah'
  | 'other';

export interface ParsedLabItem {
  name: string;
  value: number;
  unit: string;
  rawString: string;
  flag: 'normal' | 'low' | 'high' | 'critical';
  interpretation: string;
  division: InternalMedicineDivision;
  specimen?: LabSpecimenType;
  date?: string;
}

export interface LabTrendPoint {
  date?: string;
  value: number;
  rawString?: string;
}

export interface LabTrendSeries {
  name: string;
  specimen: LabSpecimenType;
  unit: string;
  trend: LabTrendPoint[];
  latestValue: number;
  latestDate?: string;
  flag: 'normal' | 'low' | 'high' | 'critical';
}

export type SurgicalUrgencyType = 'elektif' | 'life_saving';

export type OperativeToleranceStatus =
  | 'LAIK OPERASI'
  | 'LAIK OPERASI DENGAN CATATAN'
  | 'TUNDA OPERASI ELEKTIF'
  | 'TUNDA OPERASI'
  | 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL';

export interface SpPdProblem {
  order: number;
  title: string;
  division: InternalMedicineDivision;
  divisionName: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  assessment: string;
  sEvidence: string[];
  oEvidence: string[];
  pdx: string[];
  ptx: string[];
  pmx: string[];
  pex: string[];
}

export interface SpPdConsultResult {
  urgencyType: SurgicalUrgencyType;
  consultType?: 'preop' | 'raber' | 'akut';
  presetLabel: string;
  requestingSpecialty: string;
  toleranceStatus: OperativeToleranceStatus;
  toleranceReason: string;
  urgencyLevel: 'CITO / Emergensi' | 'Elektif Terjadwal' | 'Urgent';
  riskStratification: {
    rcriLeeScore: number;
    rcriLeeClass: string;
    cardiacRiskNotes: string;
    bleedingRiskNotes: string;
    glycemicRiskNotes: string;
    renalRiskNotes: string;
    pulmonaryRiskNotes: string;
    ariscatScore?: number | null;
    capriniScore?: number | null;
    improveBleedingScore?: number | null;
  };
  abnormalLabs: ParsedLabItem[];
  labTrends?: LabTrendSeries[];
  problems: SpPdProblem[];
  preOpAdvis: string[];
  intraOpAdvis: string[];
  postOpAdvis: string[];
  jointCareAdvis: string[];
  fullDraftText: string;
  matchedProtocols?: ClinicalProtocolTemplate[];
}

export interface SpPdPomrResult {
  patientOverview: string;
  vitals: ParsedVitals;
  abnormalLabs: ParsedLabItem[];
  labTrends?: LabTrendSeries[];
  problems: SpPdProblem[];
  generalSubjective: string[];
  generalObjective: string[];
  fullDraftText: string;
}

export interface SpPdSummaryResult {
  patientBrief: string;
  chiefComplaint: string;
  activeProblemList: Array<{ division: string; problems: string[] }>;
  criticalAbnormalLabs: ParsedLabItem[];
  labTrends?: LabTrendSeries[];
  pastHistory: string[];
  currentMedications: string[];
  ongoingTherapy: string[];
  internistAdvice: string[];
  fullDraftText: string;
}

export interface FlaggedSafetyDrug {
  drug: string;
  category: string;
  warning: string;
  action: string;
  severity: 'critical' | 'high' | 'warning' | 'info';
}

export interface RenalSafetyStatus {
  eGfr: number | null;
  crCl: number | null;
  stage: string;
  isImpaired: boolean;
  creatinineValue: number | null;
  flaggedDrugs: FlaggedSafetyDrug[];
}

export interface HepaticSafetyStatus {
  isImpaired: boolean;
  astValue: number | null;
  altValue: number | null;
  warning: string | null;
  flaggedDrugs: FlaggedSafetyDrug[];
}

export interface DrugElectrolyteHazard {
  id: string;
  category: 'qtc_arrhythmia' | 'hemostasis_bleeding' | 'nephrotoxic' | 'other';
  title: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
  recommendation: string;
  involvedItems: string[];
}

export interface ClinicalSafetyReport {
  renal: RenalSafetyStatus;
  hepatic: HepaticSafetyStatus;
  hazards: DrugElectrolyteHazard[];
  labTrends: LabTrendSeries[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Vitals & Lab Parsers
// ──────────────────────────────────────────────────────────────────────────────

export function extractVitals(text: string): ParsedVitals {
  const result: ParsedVitals = { rawMatched: {} };
  if (!text) return result;

  // 1. Blood Pressure:
  // Supports: TD 120/80, BP: 140/90, Tensi 150/90, Indonesian shorthand "T: 130/80", or standalone "140/90 mmHg"
  const bpMatch = text.match(
    /(?:\b(?:td|bp|tensi|tekanan\s*darah|t)\s*[:=]?\s*(\d{2,3})\s*[\/|\\]\s*(\d{2,3})\b|\b(\d{2,3})\s*[\/|\\]\s*(\d{2,3})\s*(?:mmhg)?\b)/i,
  );
  if (bpMatch) {
    const sys = bpMatch[1] || bpMatch[3];
    const dia = bpMatch[2] || bpMatch[4];
    if (sys && dia) {
      result.systolic = Number.parseInt(sys, 10);
      result.diastolic = Number.parseInt(dia, 10);
      result.rawMatched.bp = `${result.systolic}/${result.diastolic} mmHg`;
    }
  }

  // 2. Heart Rate: HR 98, Nadi 102, Pulse 88 bpm, Indonesian shorthand "N: 84 x/m"
  const hrMatch = text.match(
    /\b(?:hr|heart\s*rate|nadi|pulse|n)\s*[:=]?\s*(\d{2,3})\s*(?:x\/m|x\/menit|bpm)?\b/i,
  );
  if (hrMatch) {
    result.heartRate = Number.parseInt(hrMatch[1], 10);
    result.rawMatched.hr = `${result.heartRate} x/menit`;
  }

  // 3. Respiratory Rate: RR 22, Nafas 24 x/menit, Indonesian shorthand "R: 20 x/m"
  const rrMatch = text.match(
    /\b(?:rr|respiratory\s*rate|nafas|napas|frekuensi\s*napas|r)\s*[:=]?\s*(\d{1,2})\s*(?:x\/m|x\/menit)?\b/i,
  );
  if (rrMatch) {
    result.respiratoryRate = Number.parseInt(rrMatch[1], 10);
    result.rawMatched.rr = `${result.respiratoryRate} x/menit`;
  }

  // 4. Temperature: Suhu 38.5 C, Temp: 36.7, Indonesian shorthand "S: 37.2 C"
  // Note: Avoid matching "T" (which is Tensi in Indonesian records); only match Suhu, Temp, or "S"
  const tempMatch = text.match(
    /\b(?:suhu|temp(?:erature)?|s(?!\s*[\/|\\]))\s*[:=]?\s*(\d{2}(?:[.,]\d)?)\s*(?:°?\s*c)?\b/i,
  );
  if (tempMatch) {
    const parsedTemp = Number.parseFloat(tempMatch[1].replace(',', '.'));
    // Clinical sanity check: Human body temperature 30 - 45 °C
    if (parsedTemp >= 30 && parsedTemp <= 45) {
      result.temperature = parsedTemp;
      result.rawMatched.temp = `${result.temperature} °C`;
    }
  }

  // 5. SpO2: SpO2 97%, Saturasi 92%
  const spo2Match = text.match(/\b(?:spo2|saturasi|sat\s*o2)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (spo2Match) {
    const parsedSpo2 = Number.parseInt(spo2Match[1], 10);
    if (parsedSpo2 <= 100) {
      result.spO2 = parsedSpo2;
      result.rawMatched.spo2 = `${result.spO2}%`;
    }
  }

  // 6. GCS: GCS E4M6V5, GCS: 15, GCS E2M4V2
  const gcsMatch = text.match(/\bgcs\s*[:=]?\s*([eE]\d+[mM]\d+[vV]\d+|1[0-5]|[3-9])\b/i);
  if (gcsMatch) {
    result.gcs = gcsMatch[1].trim().toUpperCase();
    result.rawMatched.gcs = result.gcs;
  }

  return result;
}

// Helper number parser for Indonesian formatting (supports 1.050.000, 245.000, and 1,8 decimals)
export const parseIndoNumber = (str: string): number => {
  const trimmed = str.trim();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed)) {
    return Number.parseFloat(trimmed.replace(/\./g, ''));
  }
  return Number.parseFloat(trimmed.replace(',', '.'));
};

/**
 * Extracts laboratory findings with specimen disambiguation (Serum, LCS, Urin, Feses, Pleura)
 * and multi-column serial date trend tracking (e.g. RS Ngoerah serial date format).
 */
export function extractLabTrendsAndAbnormal(text: string): {
  abnormalLabs: ParsedLabItem[];
  labTrends: LabTrendSeries[];
} {
  const abnormalLabs: ParsedLabItem[] = [];
  const trendMap = new Map<
    string,
    { specimen: LabSpecimenType; unit: string; points: LabTrendPoint[] }
  >();

  if (!text) return { abnormalLabs, labTrends: [] };

  const lines = text.split(/\r?\n/);
  let currentSpecimen: LabSpecimenType = 'serum';
  let activeDates: string[] = [];

  // Helper extractor for single-pattern matches favoring the most recent match
  const extractVal = (sourceText: string, pattern: RegExp): number | null => {
    const matches = Array.from(sourceText.matchAll(pattern));
    if (matches.length === 0) return null;
    const m = matches[matches.length - 1];
    const num = parseIndoNumber(m[1]);
    return Number.isNaN(num) ? null : num;
  };

  // ── Step 1: Scan line-by-line for serial dates & tabular entries ───────────
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Specimen context changes
    const dateMatchInHeader = rawLine.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/);
    if (/hasil\s*analisa\s*lcs|cairan\s*otak|liquor|csf/i.test(rawLine)) {
      currentSpecimen = 'lcs';
      activeDates = dateMatchInHeader ? [dateMatchInHeader[0]] : [];
      continue;
    }
    if (/urin\s*lengkap|urin\s*rutin|urinalisis/i.test(rawLine)) {
      currentSpecimen = 'urin';
      activeDates = dateMatchInHeader ? [dateMatchInHeader[0]] : [];
      continue;
    }
    if (/tinja\s*lengkap|analisis\s*feses|feses\s*rutin/i.test(rawLine)) {
      currentSpecimen = 'feses';
      activeDates = dateMatchInHeader ? [dateMatchInHeader[0]] : [];
      continue;
    }
    if (/hasil\s*(?:lab\s*darah|laboratorium|lab\b|pemeriksaan\s*penunjang)/i.test(rawLine)) {
      currentSpecimen = 'serum';
      activeDates = dateMatchInHeader ? [dateMatchInHeader[0]] : [];
      continue;
    }
    if (/^===|pdx:|mtx:|terapi:|gastro\s*visite|st\.\s*general|st\.\s*neuro/i.test(rawLine)) {
      currentSpecimen = 'other';
      activeDates = [];
      continue;
    }

    // Check if line is a date header (e.g. "2/9/26 - 4/9 - 9/9 - 15/9" or "26/9/26")
    const dateMatches = Array.from(
      rawLine.matchAll(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g),
    );
    const isOnlyDates =
      dateMatches.length > 0 &&
      rawLine
        .replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, '')
        .replace(/[\s\-\–\/]/g, '').length === 0;

    if (isOnlyDates) {
      activeDates = dateMatches.map((m) => m[0]);
      continue;
    }

    // Process entries when inside a recognized specimen block
    if (currentSpecimen !== 'other') {
      // Format A: Tabular (e.g. WBC 11.2 - 13.5 - 14.2)
      const serialMatch = rawLine.match(
        /^([a-zA-Z0-9_\(\)\/\s\-\#\.]+?)\s+((?:(?:\d+(?:[.,]\d+)*|x)\s*[\-\–]\s*)+(?:\d+(?:[.,]\d+)*|x))\s*$/i,
      );
      if (serialMatch) {
        const paramName = serialMatch[1].trim();
        const valueTokens = serialMatch[2].split(/[\-\–]/).map((s) => s.trim());

        if (!/post|evaluasi|rencana|terpasang|gcs|pupil|infus|drip|kasa/i.test(paramName)) {
          let unit = '';
          if (/kalium|natrium|klorida/i.test(paramName)) unit = 'mEq/L';
          else if (/wbc|plt|leukosit|trombosit/i.test(paramName)) unit = '/uL';
          else if (/hgb|hb|kreatinin|bun|protein|albumin|bilirubin/i.test(paramName)) unit = 'g/dL';
          else if (/ast|alt|sgot|sgpt|alp|gamma/i.test(paramName)) unit = 'U/L';

          const entry = trendMap.get(paramName) || { specimen: currentSpecimen, unit, points: [] };
          valueTokens.forEach((token, idx) => {
            if (token === 'x' || token === '-' || !token) return;
            const num = parseIndoNumber(token);
            if (!Number.isNaN(num)) {
              const date =
                activeDates[idx] || (activeDates.length === 1 ? activeDates[0] : undefined);
              entry.points.push({ date, value: num });
            }
          });
          trendMap.set(paramName, entry);
          continue;
        }
      }

      // Format B: Key-Value / Bulleted entries (e.g. "- Kalium (K) - Serum: 1.87 mEq/L" or "- Glukosa: 46 mg/dL")
      const kvMatch = rawLine.match(
        /^[•\-*]?\s*([a-zA-Z0-9_\(\)\/\s\-\#\.]+?)\s*[:=]\s*(\d+(?:[.,]\d+)*)\s*([a-zA-Z\/%]+)?/i,
      );
      if (kvMatch) {
        const paramName = kvMatch[1].trim();
        const num = parseIndoNumber(kvMatch[2]);
        const unit = kvMatch[3]?.trim() || '';

        if (
          !Number.isNaN(num) &&
          !/post|evaluasi|rencana|terpasang|gcs|pupil|infus|drip|kasa|warna|reaksi|nonne|pandy|kultur|jumlah\s*sel/i.test(
            paramName,
          )
        ) {
          let resolvedUnit = unit;
          if (!resolvedUnit) {
            if (/kalium|natrium|klorida/i.test(paramName)) resolvedUnit = 'mEq/L';
            else if (/wbc|plt|leukosit|trombosit/i.test(paramName)) resolvedUnit = '/uL';
            else if (/hgb|hb|kreatinin|bun|protein|albumin|bilirubin/i.test(paramName))
              resolvedUnit = 'g/dL';
            else if (/ast|alt|sgot|sgpt|alp|gamma/i.test(paramName)) resolvedUnit = 'U/L';
            else if (/glukosa|gds/i.test(paramName)) resolvedUnit = 'mg/dL';
          }

          const entry = trendMap.get(paramName) || {
            specimen: currentSpecimen,
            unit: resolvedUnit,
            points: [],
          };
          const date = activeDates.length > 0 ? activeDates[0] : undefined;
          entry.points.push({ date, value: num });
          trendMap.set(paramName, entry);
          continue;
        }
      }
    }
  }

  // ── Step 2: Assemble Trend Series ──────────────────────────────────────────
  const labTrends: LabTrendSeries[] = [];
  for (const [name, data] of trendMap.entries()) {
    if (data.points.length === 0) continue;
    const latest = data.points[data.points.length - 1];

    let flag: 'normal' | 'low' | 'high' | 'critical' = 'normal';
    const lowerName = name.toLowerCase();
    const val = latest.value;

    if (lowerName.includes('kalium') || lowerName === 'k') {
      if (val < 2.5 || val >= 6.0) flag = 'critical';
      else if (val < 3.5) flag = 'low';
      else if (val > 5.3) flag = 'high';
    } else if (lowerName.includes('trombosit') || lowerName.includes('plt')) {
      const normPlt = val < 1000 ? val * 1000 : val;
      if (normPlt < 100000) flag = 'critical';
      else if (normPlt < 150000) flag = 'low';
      else if (normPlt > 450000) flag = 'high';
    } else if (lowerName.includes('glukosa')) {
      if (data.specimen === 'serum') {
        if (val < 70 || val >= 350) flag = 'critical';
        else if (val >= 200) flag = 'high';
      } else if (data.specimen === 'lcs') {
        if (val < 30) flag = 'low';
      }
    } else if (lowerName.includes('inr')) {
      if (val >= 1.5) flag = 'critical';
      else if (val > 1.2) flag = 'high';
    } else if (
      lowerName.includes('sgot') ||
      lowerName.includes('sgpt') ||
      lowerName.includes('ast') ||
      lowerName.includes('alt')
    ) {
      if (val > 150) flag = 'critical';
      else if (val > 50) flag = 'high';
    }

    labTrends.push({
      name,
      specimen: data.specimen,
      unit: data.unit,
      trend: data.points,
      latestValue: latest.value,
      latestDate: latest.date,
      flag,
    });
  }

  // ── Step 3: Evaluate Serum Parameters (Trends first, fallback to regex) ───

  // 1. Potassium / Kalium
  const kaliumTrend = labTrends.find(
    (t) => /kalium|(?<![a-z])k(?!\s*[a-z])/i.test(t.name) && t.specimen === 'serum',
  );
  let kalium = kaliumTrend ? kaliumTrend.latestValue : null;
  if (kalium === null) {
    kalium = extractVal(
      text,
      /(?<!vit(?:amin)?\s*)\b(?:kalium|k(?!\s*(?:mg|amp|ampul|tab|tablet|iu|ui|kal|cal|g\b|kg\b|[\/|\\])))\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mmol\/l|meq\/l)?\b/gi,
    );
  }
  if (kalium !== null) {
    if (kalium < 3.5) {
      abnormalLabs.push({
        name: 'Kalium (K) Serum',
        value: kalium,
        unit: 'mEq/L',
        rawString: `Kalium: ${kalium} mEq/L`,
        flag: kalium < 3.0 ? 'critical' : 'low',
        interpretation:
          kalium < 3.0
            ? `Hipokalemia Berat (K: ${kalium} mEq/L — Risiko Aritmia Ventrikel / Henti Jantung & Ileus Paralitik — Koreksi IV Cito)`
            : 'Hipokalemia Ringan-Sedang',
        division: 'ginjal',
        specimen: 'serum',
        date: kaliumTrend?.latestDate,
      });
    } else if (kalium > 5.5) {
      abnormalLabs.push({
        name: 'Kalium (K) Serum',
        value: kalium,
        unit: 'mEq/L',
        rawString: `Kalium: ${kalium} mEq/L`,
        flag: kalium >= 6.0 ? 'critical' : 'high',
        interpretation:
          kalium >= 6.0
            ? `Hiperkalemia Berat (K: ${kalium} mEq/L — Risiko Aritmia Letal - Wajib Stabilisasi Cito)`
            : 'Hiperkalemia Ringan-Sedang',
        division: 'ginjal',
        specimen: 'serum',
        date: kaliumTrend?.latestDate,
      });
    }
  }

  // 2. Sodium / Natrium
  const natriumTrend = labTrends.find(
    (t) => /natrium|(?<![a-z])na(?!\s*[a-z])/i.test(t.name) && t.specimen === 'serum',
  );
  let natrium = natriumTrend ? natriumTrend.latestValue : null;
  if (natrium === null) {
    natrium = extractVal(
      text,
      /\b(?:natrium|na(?!\s*(?:mg|amp|ampul|tab|tablet|iu|ui|bik|bic|diklofenak|diclofenac)))\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mmol\/l|meq\/l)?\b/gi,
    );
  }
  if (natrium !== null) {
    if (natrium < 135) {
      abnormalLabs.push({
        name: 'Natrium (Na) Serum',
        value: natrium,
        unit: 'mEq/L',
        rawString: `Natrium: ${natrium} mEq/L`,
        flag: natrium < 125 ? 'critical' : 'low',
        interpretation:
          natrium < 125 ? 'Hiponatremia Berat (Risiko Edema Serebri/Ensefalopati)' : 'Hiponatremia',
        division: 'ginjal',
        specimen: 'serum',
        date: natriumTrend?.latestDate,
      });
    } else if (natrium > 145) {
      abnormalLabs.push({
        name: 'Natrium (Na) Serum',
        value: natrium,
        unit: 'mEq/L',
        rawString: `Natrium: ${natrium} mEq/L`,
        flag: natrium > 155 ? 'critical' : 'high',
        interpretation: 'Hipernatremia (Dehidrasi Hipertonik / Gangguan Regulasi Osmotik)',
        division: 'ginjal',
        specimen: 'serum',
        date: natriumTrend?.latestDate,
      });
    }
  }

  // 3. Platelets / Trombosit
  const pltTrend = labTrends.find(
    (t) => /trombosit|plt|platelet/i.test(t.name) && t.specimen === 'serum',
  );
  let plt = pltTrend ? pltTrend.latestValue : null;
  if (plt === null) {
    plt = extractVal(
      text,
      /\b(?:trombosit|plt|platelet)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:ribu|\.000|\/ul)?\b/gi,
    );
  }
  if (plt !== null) {
    const normalizedPlt = plt < 1000 ? plt * 1000 : plt;
    if (normalizedPlt < 150000) {
      abnormalLabs.push({
        name: 'Trombosit (PLT)',
        value: normalizedPlt,
        unit: '/uL',
        rawString: `Trombosit: ${normalizedPlt.toLocaleString('id-ID')}/uL`,
        flag: normalizedPlt < 100000 ? 'critical' : 'low',
        interpretation:
          normalizedPlt < 100000
            ? `Trombositopenia Signifikan (${normalizedPlt.toLocaleString('id-ID')}/uL) — Waspada Risiko Perdarahan Mayor Prosedur Bedah Saraf (Target ≥ 100.000 /uL)`
            : 'Trombositopenia Ringan-Sedang',
        division: 'hemato',
        specimen: 'serum',
        date: pltTrend?.latestDate,
      });
    } else if (normalizedPlt > 450000) {
      abnormalLabs.push({
        name: 'Trombosit (PLT)',
        value: normalizedPlt,
        unit: '/uL',
        rawString: `Trombosit: ${normalizedPlt.toLocaleString('id-ID')}/uL`,
        flag: normalizedPlt >= 1000000 ? 'critical' : 'high',
        interpretation:
          normalizedPlt >= 1000000
            ? 'Trombositosis Ekstrem (Waspada Myeloproliferative Neoplasm / Risiko Trombosis Mayor)'
            : 'Trombositosis (Reaksi Fase Akut / Inflamasi Sistemik)',
        division: 'hemato',
        specimen: 'serum',
        date: pltTrend?.latestDate,
      });
    }
  }

  // 4. Leukosit / WBC
  const wbcTrend = labTrends.find((t) => /leukosit|wbc/i.test(t.name) && t.specimen === 'serum');
  let wbc = wbcTrend ? wbcTrend.latestValue : null;
  if (wbc === null) {
    wbc = extractVal(
      text,
      /\b(?:leukosit|wbc|white\s*blood\s*cell)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:ribu|\.000|\/ul)?\b/gi,
    );
  }
  if (wbc !== null) {
    const normalizedWbc = wbc < 100 ? wbc * 1000 : wbc;
    if (normalizedWbc > 11000) {
      abnormalLabs.push({
        name: 'Leukosit (WBC)',
        value: normalizedWbc,
        unit: '/uL',
        rawString: `Leukosit: ${normalizedWbc.toLocaleString('id-ID')}/uL`,
        flag: normalizedWbc >= 20000 ? 'critical' : 'high',
        interpretation:
          normalizedWbc >= 20000
            ? 'Leukositosis Berat (Reaksi Leukemoid / Sepsis Akut)'
            : 'Leukositosis (Kecurigaan Infeksi / Inflamasi Akut)',
        division: 'tropik',
        specimen: 'serum',
        date: wbcTrend?.latestDate,
      });
    } else if (normalizedWbc < 4000) {
      abnormalLabs.push({
        name: 'Leukosit (WBC)',
        value: normalizedWbc,
        unit: '/uL',
        rawString: `Leukosit: ${normalizedWbc.toLocaleString('id-ID')}/uL`,
        flag: normalizedWbc < 2000 ? 'critical' : 'low',
        interpretation: 'Leukopenia (Waspada Imunosupresi / Infeksi Virus / Toksisitas Obat)',
        division: 'hemato',
        specimen: 'serum',
        date: wbcTrend?.latestDate,
      });
    }
  }

  // 5. Hemoglobin (Hb)
  const hbTrend = labTrends.find((t) => /hgb|(?<![a-z])hb\b|hemoglobin/i.test(t.name) && t.specimen === 'serum');
  let hb = hbTrend ? hbTrend.latestValue : null;
  if (hb === null) {
    hb = extractVal(text, /\b(?:hb|hgb|hemoglobin)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:g\/dl)?\b/gi);
  }
  if (hb !== null) {
    if (hb < 10.0) {
      abnormalLabs.push({
        name: 'Hemoglobin (Hb)',
        value: hb,
        unit: 'g/dL',
        rawString: `Hb: ${hb} g/dL`,
        flag: hb < 8.0 ? 'critical' : 'low',
        interpretation:
          hb < 8.0
            ? 'Anemia Berat (Target Bedah Mayor ≥ 10 g/dL - Pertimbangkan Transfusi PRC)'
            : 'Anemia Ringan-Sedang',
        division: 'hemato',
        specimen: 'serum',
        date: hbTrend?.latestDate,
      });
    } else if (hb > 17.5) {
      abnormalLabs.push({
        name: 'Hemoglobin (Hb)',
        value: hb,
        unit: 'g/dL',
        rawString: `Hb: ${hb} g/dL`,
        flag: 'high',
        interpretation: 'Polisitemia / Hemokonsentrasi',
        division: 'hemato',
        specimen: 'serum',
        date: hbTrend?.latestDate,
      });
    }
  }

  // 6. Faal Hemostasis: INR, PPT, APTT
  const inrTrend = labTrends.find((t) => /inr/i.test(t.name));
  let inr = inrTrend ? inrTrend.latestValue : null;
  if (inr === null) inr = extractVal(text, /\binr\s*[:=]?\s*(\d+(?:[.,]\d+)*)\b/gi);
  if (inr !== null && inr > 1.4) {
    abnormalLabs.push({
      name: 'INR (Faal Koagulasi)',
      value: inr,
      unit: '',
      rawString: `INR: ${inr}`,
      flag: inr >= 1.6 ? 'critical' : 'high',
      interpretation: `Pemanjangan Faal Hemostasis (INR: ${inr}) — Waspada Risiko Perdarahan Mayor Pre-Operatif`,
      division: 'hemato',
      specimen: 'serum',
      date: inrTrend?.latestDate,
    });
  }

  // 7. Creatinine & Ureum
  const crTrend = labTrends.find((t) => /kreatinin|creatinine/i.test(t.name));
  let cr = crTrend ? crTrend.latestValue : null;
  if (cr === null) {
    cr = extractVal(
      text,
      /(?<!capillary\s*refill\s*|crt\s*)\b(?:kreatinin|creatinine|serum\s*cr|s\.?cr|cr(?!\s*(?:detik|dtk|sec|s\b|t\b)))\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mg\/dl)?\b/gi,
    );
  }
  if (cr !== null && cr > 1.3) {
    abnormalLabs.push({
      name: 'Kreatinin Serum',
      value: cr,
      unit: 'mg/dL',
      rawString: `Kreatinin: ${cr} mg/dL`,
      flag: cr >= 3.0 ? 'critical' : 'high',
      interpretation:
        cr >= 3.0
          ? 'Penurunan Fungsi Ginjal Berat (AKI Stage 3 / CKD On HD - Hindari Nefrotoksik)'
          : 'Penurunan Fungsi Ginjal (Curiga AKI / CKD)',
      division: 'ginjal',
      specimen: 'serum',
      date: crTrend?.latestDate,
    });
  }

  const ureum = extractVal(
    text,
    /\b(?:ureum|bun|urea|ur(?!\s*[\/|\\]))\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mg\/dl)?\b/gi,
  );
  if (ureum !== null && ureum > 50) {
    abnormalLabs.push({
      name: 'Ureum / BUN',
      value: ureum,
      unit: 'mg/dL',
      rawString: `Ureum: ${ureum} mg/dL`,
      flag: ureum > 150 ? 'critical' : 'high',
      interpretation:
        ureum > 150
          ? 'Uremia Berat (Waspada Ensefalopati Uremikum / Indikasi Hemodialisis Akut)'
          : 'Azotemia / Peningkatan Ureum',
      division: 'ginjal',
      specimen: 'serum',
    });
  }

  // 8. Liver Enzymes: SGOT & SGPT
  const sgotTrend = labTrends.find((t) => /sgot|ast/i.test(t.name));
  const sgptTrend = labTrends.find((t) => /sgpt|alt/i.test(t.name));
  const sgotVal = sgotTrend ? sgotTrend.latestValue : extractVal(text, /\b(?:sgot|ast)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\b/gi);
  const sgptVal = sgptTrend ? sgptTrend.latestValue : extractVal(text, /\b(?:sgpt|alt)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\b/gi);
  if ((sgotVal !== null && sgotVal > 80) || (sgptVal !== null && sgptVal > 80)) {
    abnormalLabs.push({
      name: 'Transaminase Hepar (SGOT/SGPT)',
      value: Math.max(sgotVal || 0, sgptVal || 0),
      unit: 'U/L',
      rawString: `SGOT/SGPT: ${sgotVal || '-'}/${sgptVal || '-'} U/L`,
      flag: (sgotVal && sgotVal > 200) || (sgptVal && sgptVal > 200) ? 'critical' : 'high',
      interpretation:
        'Hepatocellular Injury / Peningkatan Transaminase (Evaluasi DILI / Hepatitis / Sepsis)',
      division: 'gastro',
      specimen: 'serum',
    });
  }

  // 9. Albumin
  const albTrend = labTrends.find((t) => /albumin|alb/i.test(t.name));
  let alb = albTrend ? albTrend.latestValue : null;
  if (alb === null) alb = extractVal(text, /\b(?:albumin|alb)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:g\/dl)?\b/gi);
  if (alb !== null && alb < 3.2) {
    abnormalLabs.push({
      name: 'Albumin Serum',
      value: alb,
      unit: 'g/dL',
      rawString: `Albumin: ${alb} g/dL`,
      flag: alb < 2.5 ? 'critical' : 'low',
      interpretation:
        alb < 2.5
          ? 'Hipoalbuminemia Berat (Risiko Edema, Dehisiensi Luka Operasi & Delayed Healing)'
          : 'Hipoalbuminemia Ringan-Sedang',
      division: 'gastro',
      specimen: 'serum',
      date: albTrend?.latestDate,
    });
  }

  // 10. Lactate
  const lactate = extractVal(
    text,
    /\b(?:laktat|lactate)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mmol\/l)?\b/gi,
  );
  if (lactate !== null && lactate > 2.0) {
    abnormalLabs.push({
      name: 'Laktat Serum',
      value: lactate,
      unit: 'mmol/L',
      rawString: `Laktat: ${lactate} mmol/L`,
      flag: lactate >= 4.0 ? 'critical' : 'high',
      interpretation:
        lactate >= 4.0
          ? 'Hiperlaktatemia Berat (Tanda Hipoperfusi Jaringan / Syok Septik — Resusitasi Cairan Cito)'
          : 'Peningkatan Laktat (Kecurigaan Hipoperfusi / Metabolisme Anaerob)',
      division: 'tropik',
      specimen: 'serum',
    });
  }

  // 11. Troponin / CK-MB
  if (
    /\b(?:troponin|trop\s*[it]|ck-?mb)\s*[:=]?\s*(?:\+|(?:pos|positif|tinggi|elevated))\b/i.test(
      text,
    )
  ) {
    abnormalLabs.push({
      name: 'Troponin I/T',
      value: 1,
      unit: 'Kualitatif',
      rawString: 'Troponin: Positif (+)',
      flag: 'critical',
      interpretation:
        'Injury Miokard Akut (KONTRAINDIKASI OPERASI ELEKTIF - Tunda & Evaluasi Cito Kardio)',
      division: 'kardio',
      specimen: 'serum',
    });
  }

  // 12. Blood Glucose (GDS/GDP) — CRITICAL: Strip LCS and Urine sections first!
  const nonLcsText = text
    .replace(/hasil\s*analisa\s*lcs[\s\S]*?(?=(?:hasil\s*kultur|urin|tinja|hasil\s*lab|$))/gi, '')
    .replace(/urin\s*lengkap[\s\S]*?(?=(?:tinja|hasil\s*analisa|hasil\s*lab|$))/gi, '');

  const gds = extractVal(
    nonLcsText,
    /\b(?:gds|gdp|gd2pp|gula\s*darah(?:\s*sewaktu|\s*puasa|\s*2\s*jam)?)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(?:mg\/dl)?\b/gi,
  );
  if (gds !== null) {
    if (gds > 200) {
      abnormalLabs.push({
        name: 'Gula Darah Sewaktu (GDS)',
        value: gds,
        unit: 'mg/dL',
        rawString: `GDS: ${gds} mg/dL`,
        flag: gds >= 300 ? 'critical' : 'high',
        interpretation:
          gds >= 300
            ? 'Hiperglikemia Ekstrem (Waspada KAD/HHS - Target Pre-Op 140-180 mg/dL)'
            : 'Hiperglikemia Tak Terkontrol',
        division: 'endokrin',
        specimen: 'serum',
      });
    } else if (gds < 70) {
      abnormalLabs.push({
        name: 'Gula Darah Sewaktu (GDS)',
        value: gds,
        unit: 'mg/dL',
        rawString: `GDS: ${gds} mg/dL`,
        flag: 'critical',
        interpretation: 'Hipoglikemia Klinis (Emergency Metabolik - Bolus D40% Segera)',
        division: 'endokrin',
        specimen: 'serum',
      });
    }
  }

  // 13. HbA1c
  const hba1c = extractVal(nonLcsText, /\b(?:hba1c|a1c)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*%?\b/gi);
  if (hba1c !== null && hba1c >= 8.0) {
    abnormalLabs.push({
      name: 'HbA1c',
      value: hba1c,
      unit: '%',
      rawString: `HbA1c: ${hba1c}%`,
      flag: hba1c >= 10.0 ? 'critical' : 'high',
      interpretation:
        hba1c >= 10.0
          ? 'Kontrol Glikemik Sangat Buruk (Risiko Infeksi Berat & Komplikasi Perioperatif Mayor)'
          : 'Kontrol Glikemik Suboptimal (Target Pre-Op Elektif < 7.0 - 8.0%)',
      division: 'endokrin',
      specimen: 'serum',
    });
  }

  // ── Step 4: Specimen-Specific LCS (CSF) Findings ─────────────────────────
  const lcsBlockMatch = text.match(
    /hasil\s*analisa\s*lcs[\s\S]*?(?=(?:hasil\s*kultur|urin|tinja|===|pdx|$))/i,
  );
  if (lcsBlockMatch) {
    const lcsText = lcsBlockMatch[0];

    // Glukosa LCS (Liquor Cerebrospinalis)
    const glucLcs = extractVal(lcsText, /\bglukosa\s*[:=]?\s*(\d+(?:[.,]\d+)*)/gi);
    if (glucLcs !== null) {
      abnormalLabs.push({
        name: 'Glukosa Cairan Otak (LCS)',
        value: glucLcs,
        unit: 'mg/dL',
        rawString: `Glukosa LCS: ${glucLcs} mg/dL`,
        flag: glucLcs < 40 ? 'low' : 'normal',
        interpretation: `Glukosa LCS: ${glucLcs} mg/dL (Evaluasi Rasio Glukosa LCS/Serum untuk Infeksi/Meningitis Bakterial)`,
        division: 'tropik',
        specimen: 'lcs',
      });
    }

    // TP Liquor (Protein Total LCS)
    const tpLiquor = extractVal(lcsText, /(?:tp\s*liquor|mtp)\s*[:=]?\s*(\d+(?:[.,]\d+)*)/gi);
    if (tpLiquor !== null && tpLiquor > 45) {
      abnormalLabs.push({
        name: 'Protein Total LCS (TP Liquor)',
        value: tpLiquor,
        unit: 'mg/dL',
        rawString: `TP Liquor: ${tpLiquor} mg/dL`,
        flag: 'high',
        interpretation:
          'Protein LCS Meningkat (>45 mg/dL) — Penanda Inflamasi / Infeksi Susunan Saraf Pusat',
        division: 'tropik',
        specimen: 'lcs',
      });
    }

    // Hitung Sel Leukosit LCS
    const leukoLcs = extractVal(lcsText, /lekosit\s*[:=]?\s*(\d+(?:[.,]\d+)*)/gi);
    if (leukoLcs !== null && leukoLcs > 5) {
      abnormalLabs.push({
        name: 'Hitung Sel Leukosit LCS',
        value: leukoLcs,
        unit: '/uL',
        rawString: `Lekosit LCS: ${leukoLcs}/uL`,
        flag: 'high',
        interpretation:
          'Pleositosis Ringan LCS — Kecurigaan Ventrikulitis / Meningoensefalitis Bakterial',
        division: 'tropik',
        specimen: 'lcs',
      });
    }

    // Pandy / None
    if (/pandy\s*positif|none\s*positif/i.test(lcsText)) {
      abnormalLabs.push({
        name: 'Reaksi Pandy & None LCS',
        value: 1,
        unit: 'Kualitatif',
        rawString: 'Reaksi Pandy (+), None (+)',
        flag: 'high',
        interpretation: 'Reaksi Pandy & None Positif (+) — Peningkatan Globulin & Protein Intratekal',
        division: 'tropik',
        specimen: 'lcs',
      });
    }
  }

  // ── Step 5: Specimen-Specific Microbiology / Cultures ───────────────────
  if (/corynebacterium\s*striatum/i.test(text)) {
    abnormalLabs.push({
      name: 'Kultur Cairan Otak (LCS)',
      value: 1,
      unit: 'Kultur',
      rawString: 'Kultur LCS: Teridentifikasi Corynebacterium striatum',
      flag: 'critical',
      interpretation:
        'Biakan LCS Positif Corynebacterium striatum — Konfirmasi Ventrikulitis / Meningoensefalitis Bakterial',
      division: 'tropik',
      specimen: 'lcs',
    });
  }
  if (/mrse|methicillin\s*resistant\s*staphylococcus\s*epidermidis/i.test(text)) {
    abnormalLabs.push({
      name: 'Kultur Darah',
      value: 1,
      unit: 'Kultur',
      rawString: 'Kultur Darah: Terisolasi MRSE (2 sisi)',
      flag: 'critical',
      interpretation:
        'Bakteremia MRSE (Methicillin Resistant S. epidermidis) — Pertahankan Vancomycin',
      division: 'tropik',
      specimen: 'serum',
    });
  }

  // ── Step 6: Urine Findings ───────────────────────────────────────────────
  const urinBlockMatch = text.match(
    /urin\s*lengkap[\s\S]*?(?=(?:tinja|hasil\s*analisa|hasil\s*lab|$))/i,
  );
  if (urinBlockMatch) {
    const urinText = urinBlockMatch[0];
    const bakteriUrin = extractVal(urinText, /bakteri\s*[:=]?\s*(\d+(?:[.,]\d+)*)/gi);
    if (bakteriUrin !== null && bakteriUrin > 100) {
      abnormalLabs.push({
        name: 'Bakteri Sedimen Urin',
        value: bakteriUrin,
        unit: '/uL',
        rawString: `Bakteri Urin: ${bakteriUrin} /uL`,
        flag: 'high',
        interpretation: 'Bakteriuria Signifikan (Kecurigaan Kolonisasi / ISK)',
        division: 'ginjal',
        specimen: 'urin',
      });
    }
  }

  // ── Step 7: Stool Findings ───────────────────────────────────────────────
  if (/tinja\s*lengkap|analisis\s*feses/i.test(text) && /cair/i.test(text)) {
    abnormalLabs.push({
      name: 'Analisis Feses (Tinja)',
      value: 1,
      unit: 'Kualitatif',
      rawString: 'Konsistensi Tinja: Cair (Fat +, Serat +)',
      flag: 'high',
      interpretation: 'Feses Cair (Diare Akut) dengan Malabsorpsi Lemak/Serat',
      division: 'gastro',
      specimen: 'feses',
    });
  }

  return { abnormalLabs, labTrends };
}

/**
 * Backwards compatible helper returning only abnormal lab items.
 */
export function extractAbnormalLabs(text: string): ParsedLabItem[] {
  return extractLabTrendsAndAbnormal(text).abnormalLabs;
}

/**
 * Returns serial lab trend series from text.
 */
export function extractLabTrends(text: string): LabTrendSeries[] {
  return extractLabTrendsAndAbnormal(text).labTrends;
}

// ──────────────────────────────────────────────────────────────────────────────
// 11 Divisi IPD PAPDI Classifier & Clinical Scaffolder
// ──────────────────────────────────────────────────────────────────────────────

interface DivisionRule {
  division: InternalMedicineDivision;
  keywords: RegExp;
  generateProblem: (
    matches: string[],
    vitals: ParsedVitals,
    labs: ParsedLabItem[],
    fullText: string,
  ) => SpPdProblem | null;
}

const DIVISION_RULES: DivisionRule[] = [
  // 1. ENDOKRIN & METABOLIK
  {
    division: 'endokrin',
    keywords:
      /\b(diabetes|dm\s*tipe\s*[12]|dm\s*type\s*[12]|hiperglikemia|gds\s*\d+|hba1c|kad|ketoasidosis|hhs|honk|tiroid|hipertiroid|hipotiroid|graves|struma|tirotoksikosis|dislipidemia|kolesterol|trigliserida|metformin|glimepirid|insulin|novorapid|lantus|levemir|hipoglikemi|hipoglikemia)\b/i,
    generateProblem: (_matches, vitals, labs, fullText) => {
      const gdsLab = labs.find(
        (l) => l.name.includes('Gula Darah') && l.specimen !== 'lcs' && l.specimen !== 'urin',
      );
      const isHypoGluc =
        (gdsLab && gdsLab.value < 70) || /\b(hipoglikemi|hipoglikemia)\b/i.test(fullText);
      const isDk = /\b(kad|ketoasidosis|hhs|honk)\b/i.test(fullText);
      const isThyroid = /\b(tiroid|hipertiroid|hipotiroid|graves|struma|tirotoksikosis)\b/i.test(
        fullText,
      );
      const isHighGluc =
        (gdsLab && (gdsLab.flag === 'critical' || gdsLab.flag === 'high') && gdsLab.value >= 200) ||
        /\b(gds\s*(?:2\d\d|3\d\d|4\d\d|5\d\d))\b/i.test(fullText);
      const hasDmHistory =
        /\b(diabetes|dm\s*tipe\s*[12]|dm\s*type\s*[12]|metformin|glimepirid|insulin|novorapid|lantus|levemir)\b/i.test(
          fullText,
        ) || Boolean(labs.find((l) => l.name.includes('HbA1c') && l.value >= 6.5));

      if (isHypoGluc) {
        return {
          order: 1,
          title: 'Hipoglikemia Klinis / Akut Simptomatik (Kegawatan Metabolik)',
          division: 'endokrin',
          divisionName: PAPDI_DIVISIONS.endokrin.nameIndonesian,
          criticality: 'critical',
          assessment:
            'Hipoglikemia Klinis (GDS < 70 mg/dL). Kegawatan metabolik akut dengan risiko kerusakan neuronal jika tidak segera dikoreksi.',
          sEvidence: [
            'Penurunan kesadaran, lemas badan, keringat dingin, tremor, atau asupan nutrisi menurun.',
          ],
          oEvidence: [
            gdsLab ? gdsLab.rawString : 'GDS < 70 mg/dL',
            ...(vitals.gcs ? [`GCS: ${vitals.gcs}`] : []),
          ],
          pdx: [
            'Cek GDS serial per 15-30 menit pasca koreksi hingga GDS > 100 mg/dL',
            'Evaluasi penyebab hipoglikemia (asupan oral kurang, sepsis berat, insufisiensi adrenal)',
            'Pemeriksaan elektrolit lengkap (Natrium, Kalium) & fungsi ginjal',
          ],
          ptx: [
            'Protokol Hipoglikemia Akut CITO: Bolus Dextrose 40% (D40%) 2 flakon (50 mL) IV CITO.',
            'Pasang infus Dextrose 10% (D10%) maintenance 15-20 tpm.',
            'Bila belum sadar & GDS < 100 mg/dL setelah 15 menit, ulangi bolus D40% 1-2 flakon.',
            'Hentikan sementara semua obat antidiabetik (insulin / OAD / sulfonilurea).',
          ],
          pmx: [
            'Monitoring GDS ketat: target GDS 140 - 180 mg/dL, hindari overkoreksi drastis',
            'Monitoring status neurologis dan tanda vital berkala',
          ],
          pex: [
            'Edukasi keluarga mengenai tanda-tanda hipoglikemia berulang dan pentingnya pemenuhan nutrisi tepat waktu.',
          ],
        };
      }

      if (!hasDmHistory && !isHighGluc && !isDk && !isThyroid) {
        return null;
      }

      let title = 'Diabetes Mellitus Tipe 2 Terkontrol';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isDk) {
        title = 'Krisis Hiperglikemia Akut (KAD / HHS) — Kegawatan Endokrin';
        criticality = 'critical';
      } else if (isHighGluc) {
        title = hasDmHistory
          ? 'Diabetes Mellitus Tipe 2 dengan Hiperglikemia Tidak Terkontrol / Regulasi Cepat'
          : 'Hiperglikemia Awitan Baru / Reaktif (Evaluasi Regulasi Glikemik)';
        criticality = 'high';
      } else if (isThyroid) {
        title = 'Kelainan Kelenjar Tiroid (Evaluasi Eutiroid Perioperatif)';
        criticality = 'medium';
      }

      return {
        order: 1,
        title,
        division: 'endokrin',
        divisionName: PAPDI_DIVISIONS.endokrin.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi kendali metabolik dan risiko perioperatif metabolik.`,
        sEvidence: ['Riwayat pengobatan antidiabetik / keluhan poliuria, polidipsia, lemas badan.'],
        oEvidence: [
          gdsLab ? gdsLab.rawString : 'Parameter gula darah dalam evaluasi.',
          ...(vitals.rawMatched.bp ? [`Tekanan darah: ${vitals.rawMatched.bp}`] : []),
        ],
        pdx: [
          'Monitoring GDS berkala (per 4-6 jam jika puasa/perioperatif)',
          'Pemeriksaan HbA1c, profil lipid, urinalisis lengkap (evaluasi glukosuria & proteinuria)',
          ...(isDk ? ['Analisa Gas Darah (AGD), Keton darah/urin, elektrolit serial'] : []),
        ],
        ptx: [
          isHighGluc
            ? 'Regulasi cepat insulin sliding scale intravena/subkutan (target GDS pre-op 140 - 180 mg/dL).'
            : 'Lanjutkan regimen insulin atau OAD sesuai jadwal.',
          'Stop OAD nefrotoksik/berisiko: Metformin stop 24-48 jam pre-prosedur kontras/operasi; SGLT-2 inhibitor stop 3 hari pre-op untuk cegah euglycemic DKA.',
          'Pagi operasi: tunda obat hipoglikemik oral (OHO); berikan maintenance cairan D5% / D10% bila pasien puasa panjang.',
        ],
        pmx: [
          'Target GDS perioperatif: 140 - 180 mg/dL (cegah hiperglikemia menghambat penyembuhan luka dan cegah hipoglikemia)',
          'Tanda-tanda hipoglikemia (keringat dingin, takikardia, tremor, penurunan kesadaran)',
        ],
        pex: [
          'Edukasi kepatuhan jadwal puasa operasi dan pemberitahuan segera jika merasa gemetar/lemas dingin.',
        ],
      };
    },
  },

  // 2. GINJAL & HIPERTENSI (NEFROLOGI)
  {
    division: 'ginjal',
    keywords:
      /\b(hipertensi|ht\b|tekanan darah tinggi|krisis hipertensi|urgensi|emergensi|gagal ginjal|aki\b|acute kidney injury|ckd\b|pgk\b|hemodialisis|cuci darah|ureum|kreatinin|edema tungkai|oliguria|anuria|hipokalemia|hiperkalemia|hiponatremia|hipernatremia|bph|retensi urin)\b/i,
    generateProblem: (_matches, vitals, labs, fullText) => {
      const crLab = labs.find((l) => l.name.includes('Kreatinin'));
      const kLab = labs.find((l) => l.name.includes('Kalium'));
      const isHypoK = kLab && kLab.flag === 'critical' && kLab.value < 3.0;
      const isHyperK = kLab && kLab.flag === 'critical' && kLab.value > 5.5;
      const isHighBp =
        (vitals.systolic && vitals.systolic >= 180) ||
        (vitals.diastolic && vitals.diastolic >= 110);
      const isAki =
        /\b(aki|acute kidney injury|oliguria|anuria)\b/i.test(fullText) ||
        (crLab && crLab.flag === 'critical');
      const isCkd = /\b(ckd|pgk|hemodialisis|cuci darah|hd rutin)\b/i.test(fullText);

      let title = 'Hipertensi Stage 2 Terkontrol';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isHypoK) {
        title = `Hipokalemia Berat Simptomatik (K: ${kLab.value} mEq/L) — Risiko Aritmia Ventrikel & Ileus Paralitik`;
        criticality = 'critical';
      } else if (isHyperK) {
        title = `Hiperkalemia Berat (K: ${kLab.value} mEq/L) — Risiko Aritmia Letal / Cardiac Arrest`;
        criticality = 'critical';
      } else if (isHighBp) {
        title = 'Hipertensi Urgensi / Krisis Hipertensi (TD ≥ 180/110 mmHg)';
        criticality = 'critical';
      } else if (isAki) {
        title = 'Acute Kidney Injury (AKI) on Evaluation — Disfungsi Ginjal Akut';
        criticality = 'high';
      } else if (isCkd) {
        title = 'Chronic Kidney Disease (CKD) on Hemodialysis / Konservatif';
        criticality = 'high';
      }

      return {
        order: 2,
        title,
        division: 'ginjal',
        divisionName: PAPDI_DIVISIONS.ginjal.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi keseimbangan cairan, hemodinamik, dan toleransi nefrotoksik.`,
        sEvidence: [
          'Keluhan pusing berputar, riwayat darah tinggi lama, penurunan produksi urine, diare/muntah berulang, atau riwayat cuci darah.',
        ],
        oEvidence: [
          vitals.rawMatched.bp ? `Tekanan Darah: ${vitals.rawMatched.bp}` : 'TD tercatat.',
          ...(crLab ? [crLab.rawString] : []),
          ...(kLab ? [kLab.rawString] : []),
        ],
        pdx: [
          'Pemeriksaan fungsi ginjal serial: Ureum, Kreatinin, eGFR, dan Elektrolit lengkap (Na, K, Cl)',
          'Urinalisis lengkap (silinder eritrosit, proteinuria kuantitatif)',
          'Monitoring balance cairan harian dan diuresis ketat (target urin > 0.5 cc/kgBB/jam)',
          ...(isHypoK
            ? [
                'Pemeriksaan Kalium serial post-drip (2-4 jam pasca koreksi)',
                'Cek Magnesium (Mg) dan Kalsium serum (koreksi hipomagnesemia refrakter)',
                'EKG 12 sadapan (evaluasi gelombang U, pemanjangan QT, dan aritmia ventrikel)',
              ]
            : []),
        ],
        ptx: [
          isHypoK
            ? 'Koreksi Kalium Intravena CITO: Drip KCl 20 - 40 mEq dalam 500 mL NaCl 0.9% (HINDARI pelarut dextrose/glukosa pada awal koreksi karena menstimulasi insulin endogen yang memasukkan kalium ke intrasel dan memperburuk hipokalemia). Laju infus maksimal 10-20 mEq/jam via syringe/infusion pump di bawah continuous ECG monitoring.'
            : isHyperK
              ? 'Protokol Hiperkalemia: Ca Glukonas 10% 10 mL IV pelan (stabilisasi membran miokard), D40% 50 mL + Regular Insulin 10 IU drip, Nebulisasi Salbutamol 5 mg, dan evaluasi Hemodialisis Cito bila K > 6.5 mEq/L atau terdapat perubahan EKG.'
              : isHighBp
                ? 'Kendali tekanan darah segera dengan antihipertensi oral (Amlodipin / Klonidin) atau titrasi IV (Nicardipine drip). Tunda operasi elektif jika TD ≥ 180/110 mmHg.'
                : 'Lanjutkan antihipertensi pemeliharaan (Calcium Channel Blocker seperti Amlodipin aman dilanjutkan pagi operasi).',
          'Pagi hari operasi: Tunda golongan ACE-inhibitor (Captopril/Ramipril) atau ARB (Candesartan/Valsartan) untuk mencegah risiko hipotensi refrakter saat induksi anestesi.',
          'Hindari pemberian obat-obatan berpotensi nefrotoksik (NSAID seperti Ketorolac/Ketoprofen, Aminoglikosida, dan agen radiokontras tanpa hidrasi).',
        ],
        pmx: [
          'Target Tekanan Darah perioperatif: < 160/100 mmHg (optimal < 140/90 mmHg)',
          'Produksi urin kateter per jam, balans cairan masuk vs keluar',
          'Elektrolit pasca-tindakan terutama Kalium',
        ],
        pex: [
          'Edukasi pembatasan asupan garam dan kepatuhan minum obat antihipertensi atau koreksi elektrolit.',
        ],
      };
    },
  },

  // 3. TROPIK & INFEKSI
  {
    division: 'tropik',
    keywords:
      /\b(demam|febris|infeksi|sepsis|septik|shock septic|syok septik|dbd|dhf|dengue|tifoid|typhoid|malaria|leptospirosis|isk|infeksi saluran kemih|pneumonia|covid|hiv|aids|prokalsitonin|pct|crp|meningoensefalitis|ventrikulitis|corynebacterium|mrse|analisa lcs|cairan otak)\b/i,
    generateProblem: (_matches, vitals, labs, fullText) => {
      const isNeuroInf =
        /\b(meningoensefalitis|ventrikulitis|corynebacterium|mrse|analisa lcs|cairan otak)\b/i.test(
          fullText,
        ) || Boolean(labs.find((l) => l.specimen === 'lcs' && l.flag === 'critical'));
      const isSepsis = /\b(sepsis|septik|shock septic|syok septik|sofa)\b/i.test(fullText);
      const isDengue = /\b(dbd|dhf|dengue|trombositopenia|ns1)\b/i.test(fullText);
      const isFever =
        (vitals.temperature && vitals.temperature >= 38.0) || /\b(demam|febris)\b/i.test(fullText);
      const wbcLab = labs.find((l) => l.name.includes('Leukosit'));
      const lcsKultur = labs.find((l) => l.name.includes('Kultur Cairan Otak'));
      const bloodKultur = labs.find((l) => l.name.includes('Kultur Darah'));

      let title = 'Sindrom Infeksi Akut on Evaluation';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isNeuroInf) {
        title =
          'Meningoensefalitis & Ventrikulitis Bakterial (Susp. Corynebacterium striatum / MRSE) + Sepsis';
        criticality = 'critical';
      } else if (isSepsis) {
        title = 'Sepsis / Severe Sepsis — Sindrom Disfungsi Organ Terkait Infeksi';
        criticality = 'critical';
      } else if (isDengue) {
        title = 'Dengue Hemorrhagic Fever (DHF / DBD) Fase Kritis / Permeabilitas Kapiler';
        criticality = 'high';
      } else if (isFever) {
        title = 'Febris Akut / Demam Aktif — Evaluasi Fokus Infeksi Sistemik';
        criticality = 'high';
      }

      return {
        order: 3,
        title,
        division: 'tropik',
        divisionName: PAPDI_DIVISIONS.tropik.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi qSOFA / SIRS, fokus infeksi sistemik/SSP, dan stabilitas hemodinamik.`,
        sEvidence: [
          'Riwayat demam tinggi menggigil, lemas, penurunan nafsu makan, penurunan kesadaran, atau batuk.',
        ],
        oEvidence: [
          vitals.rawMatched.temp ? `Suhu Badan: ${vitals.rawMatched.temp}` : 'Suhu dievaluasi.',
          ...(wbcLab ? [wbcLab.rawString] : []),
          ...(lcsKultur ? [lcsKultur.rawString] : []),
          ...(bloodKultur ? [bloodKultur.rawString] : []),
        ],
        pdx: [
          'Kultur darah 2 set serial sebelum inisiasi antibiotik dan evaluasi klirens bakteremia',
          'Kultur cairan LCS serial via drain eksternal EVD sebelum penanaman shunt permanen',
          'Pemeriksaan penanda infeksi: Darah Lengkap, CRP kuantitatif, Prokalsitonin (PCT), AGD, dan Laktat',
        ],
        ptx: [
          isNeuroInf
            ? 'Lanjutkan terapi antibiotik bertarget SSP: Inj. Vancomycin 1000 mg tiap 8 jam IV dengan pemantauan trough level serum (target 15-20 mcg/mL).'
            : isSepsis
              ? 'Inisiasi 1-hour Sepsis Bundle: Resusitasi kristaloid cepat 30 mL/kgBB bila hipotensi/laktat ≥ 4 mmol/L, antibiotik spektrum luas empiris dalam 1 jam pertama, vasopresor (Norepinefrin) bila MAP < 65 mmHg.'
              : 'Pemberian antibiotik empiris rasional sesuai dugaan fokus infeksi.',
          'Antipiretik Parasetamol 1000 mg IV / Oral tiap 6-8 jam bila suhu ≥ 38.0°C.',
          'Toleransi Bedah Saraf: Tunda konversi EVD to VP Shunt permanen hingga kultur LCS steril minimal 3x berturut-turut untuk mencegah infeksi shunt permanen.',
        ],
        pmx: [
          'Kurva suhu tubuh, frekuensi nadi, laju nafas, dan tekanan darah berkala',
          'Mean Arterial Pressure (MAP) target ≥ 65 mmHg',
          'Produksi, warna, dan undulasi cairan drain EVD',
        ],
        pex: [
          'Edukasi pentingnya sterilisasi infeksi intrakranial sebelum implantasi shunt permanen dan kepatuhan pemberian antibiotik tepat waktu.',
        ],
      };
    },
  },

  // 4. KARDIOVASKULAR
  {
    division: 'kardio',
    keywords:
      /\b(jantung|pjk|cad|koroner|stemi|nstemi|uap|angina|infark|serangan jantung|gagal jantung|heart failure|chf|adhf|nyha|aritmia|af\b|atrial fibrilasi|svt|vt\b|pacemaker|troponin|ckmb|clopidogrel|aspirin|ticagrelor|warfarin|aspilet)\b/i,
    generateProblem: (_matches, vitals, _labs, fullText) => {
      const isAcs = /\b(stemi|nstemi|uap|infark miokard|troponin\s*\+)\b/i.test(fullText);
      const isHf = /\b(gagal jantung|heart failure|chf|adhf|edema paru|ronki basah)\b/i.test(
        fullText,
      );
      const isAntiplatelet = /\b(clopidogrel|aspirin|ticagrelor|warfarin|aspilet)\b/i.test(
        fullText,
      );

      let title = 'Penyakit Jantung Koroner (PJK) / Ischemic Heart Disease Terkontrol';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isAcs) {
        title =
          'Acute Coronary Syndrome (ACS / Sindrom Koroner Akut) — KONTRAINDIKASI OPERASI ELEKTIF';
        criticality = 'critical';
      } else if (isHf) {
        title =
          'Gagal Jantung Kongestif (CHF / ADHF NYHA II-III) — Evaluasi Kompensasi Hemodinamik';
        criticality = 'high';
      }

      return {
        order: 4,
        title,
        division: 'kardio',
        divisionName: PAPDI_DIVISIONS.kardio.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi Revised Cardiac Risk Index (RCRI Lee), toleransi fungsional (METs), dan hemostasis perioperatif.`,
        sEvidence: [
          'Riwayat nyeri dada tipikal substernal, sesak saat beraktivitas (dyspnea on exertion), orthopnea, atau riwayat pasang stent koroner.',
        ],
        oEvidence: [
          vitals.rawMatched.hr ? `Laju Nadi: ${vitals.rawMatched.hr}` : 'HR dievaluasi.',
          vitals.rawMatched.bp ? `Tekanan Darah: ${vitals.rawMatched.bp}` : 'TD dievaluasi.',
        ],
        pdx: [
          'Rekam EKG 12 lead pre-operatif terbaru (evaluasi iskemia, hipertrofi LV, atau aritmia)',
          'Echocardiography terkini (evaluasi fraksi ejeksi LVEF, disfungsi katup, kelainan kinetik dinding ventrikel)',
          'Biomarker jantung: Troponin I/T dan NT-proBNP bila terdapat keluhan sesak akut / nyeri dada baru',
        ],
        ptx: [
          isAcs
            ? 'KONTRAINDIKASI OPERASI ELEKTIF: Tunda operasi elektif, transfer ke perawatan intermediet/ICCU, berikan Dual Antiplatelet Therapy (DAPT), antikoagulan, dan konsul cito Kardiologi.'
            : 'Optimalisasi terapi kardioprotektif: Beta-blocker (Bisoprolol) lanjutkan untuk target HR istirahat 60-80 bpm.',
          isAntiplatelet
            ? 'Regulasi Antiplatelet/Antikoagulan Pre-Op: Aspirin dosis rendah (80-100 mg) umumnya aman dilanjutkan kecuali bedah saraf/okular; Clopidogrel dihentikan 5-7 hari pre-op pada bedah berisiko perdarahan tinggi setelah konfirmasi dengan dokter spesialis jantung.'
            : 'Pertahankan hemodinamik stabil intraoperatif, hindari takikardia dan hipotensi berat.',
          isHf
            ? 'Restriksi cairan terukur, berikan diuretik loop (Furosemid) bila tanda kongesti basah.'
            : 'Hidrasi kristaloid terkontrol dengan monitoring CVP / klinis.',
        ],
        pmx: [
          'Monitoring EKG kontinu intraoperatif dan tanda iskemia miokard perioperatif',
          'Target Heart Rate: 60 - 80 bpm, hindari takiaritmia yang meningkatkan konsumsi oksigen miokard',
          'Keseimbangan cairan ketat (cegah overload cairan memicu dekompensasi kordis pasca-operasi)',
        ],
        pex: [
          'Edukasi pembatasan aktivitas fisik berlebih dan pelaporan segera jika timbul nyeri dada atau sesak nafas mendadak.',
        ],
      };
    },
  },

  // 5. PULMONOLOGI
  {
    division: 'pulmo',
    keywords:
      /\b(paru|batuk|sesak|pneumonia|cap\b|hap\b|ppok|copd|asma|asthma|tb\b|tbc|tuberkulosis|efusi pleura|infiltrat|ronki|wheezing|bta\b|spo2|inhaler|nebul|combivent)\b/i,
    generateProblem: (_matches, vitals, _labs, fullText) => {
      const isPneumonia = /\b(pneumonia|cap|hap|infiltrat|ronki)\b/i.test(fullText);
      const isCopd = /\b(ppok|copd|asma|asthma|wheezing)\b/i.test(fullText);
      const isTb = /\b(tb|tbc|tuberkulosis|bta|oat)\b/i.test(fullText);
      const isHypox = vitals.spO2 && vitals.spO2 < 93;

      let title = 'Penyakit Paru Obstruktif / Gangguan Respirasi Terkontrol';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isPneumonia || isHypox) {
        title = 'Community-Acquired Pneumonia (CAP) / Infeksi Saluran Nafas Bawah Akut';
        criticality = 'high';
      } else if (isCopd) {
        title = 'PPOK / Asma Bronkial Eksaserbasi Akut — Risiko Komplikasi Paru Pasca-Bedah (PPC)';
        criticality = 'high';
      } else if (isTb) {
        title = 'Tuberkulosis Paru (Evaluasi Status Penularan & Efek Samping OAT)';
        criticality = 'medium';
      }

      return {
        order: 5,
        title,
        division: 'pulmo',
        divisionName: PAPDI_DIVISIONS.pulmo.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi risiko Pulmonary Postoperative Complications (PPC), kebutuhan bronkodilator, dan adekuasi oksigenasi.`,
        sEvidence: [
          'Riwayat batuk berdahak, sesak nafas saat berbaring, riwayat merokok lama, atau penggunaan inhaler rutin.',
        ],
        oEvidence: [
          vitals.rawMatched.spo2
            ? `Saturasi Oksigen: ${vitals.rawMatched.spo2}`
            : 'SpO2 dievaluasi.',
          vitals.rawMatched.rr ? `Frekuensi Nafas: ${vitals.rawMatched.rr}` : 'RR dievaluasi.',
        ],
        pdx: [
          'Foto Thorax PA/AP terbaru (evaluasi infiltrat, kardiomegali, emfisema, atau efusi pleura)',
          'Pemeriksaan Analisa Gas Darah (AGD) bila SpO2 < 92% atau terdapat kecurigaan retensi CO2',
          'Spirometri pre-operatif bila prosedur bedah toraks / abdomen atas pada penderita PPOK',
        ],
        ptx: [
          'Optimalkan bronkodilator pre-operatif: Nebulisasi SABA + SAMA (Salbutamol + Ipratropium Bromida) 1 jam sebelum operasi dan pasca-ekstubasi.',
          'Kortikosteroid sistemik (Metilprednisolon 62.5 - 125 mg IV) bila terdapat bronkospasme aktif / riwayat asma eksaserbasi.',
          'Terapi oksigen titrasi untuk target SpO2 94 - 98% (atau target 88 - 92% pada pasien PPOK kronis retensi CO2).',
          'Fisioterapi dada, latihan batuk efektif, dan mobilisasi dini pasca-operasi.',
        ],
        pmx: [
          'Monitoring saturasi oksigen kontinu pasca-operasi',
          'Auskultasi suara nafas berkala (pantau wheezing atau ronki basah pasca-ekstubasi)',
        ],
        pex: [
          'Edukasi latihan pernapasan dalam (incentive spirometry) dan penghentian total merokok.',
        ],
      };
    },
  },

  // 6. GASTROENTEROHEPATOLOGI
  {
    division: 'gastro',
    keywords:
      /\b(lambung|maag|gerd|dispepsia|mual|muntah|melena|hematemesis|perdarahan saluran cerna|scba|ugib|sirosis|hati|hepar|hepatitis|ikterus|kuning|ascites|asites|sgot|sgpt|bilirubin|albumin|omeprazole|pantoprazole|sucralfate|diare|bab cair|mencret)\b/i,
    generateProblem: (_matches, _vitals, labs, fullText) => {
      const isBleed = /\b(melena|hematemesis|perdarahan saluran cerna|scba|ugib)\b/i.test(fullText);
      const isCirrhosis = /\b(sirosis|cirrhosis|ascites|asites|varises)\b/i.test(fullText);
      const isDiarrhea = /\b(diare|bab cair|mencret|muntah)\b/i.test(fullText);
      const transLab = labs.find((l) => l.name.includes('Transaminase'));
      const albLab = labs.find((l) => l.name.includes('Albumin'));

      let title = 'Sindrom Dispepsia / GERD Terkontrol';
      let criticality: SpPdProblem['criticality'] = 'low';

      if (isBleed) {
        title = 'Perdarahan Saluran Cerna Bagian Atas (SCBA / UGIB) Akut — Kegawatan Saluran Cerna';
        criticality = 'critical';
      } else if (isCirrhosis) {
        title = 'Sirosis Hepatis Dekompensata (Evaluasi Child-Pugh & MELD Score)';
        criticality = 'high';
      } else if (isDiarrhea || transLab) {
        title = isDiarrhea
          ? `Diare Akut Tanpa Dehidrasi ec Susp Viral dd Laktosa Intoleran ${transLab ? '+ Peningkatan Transaminase Hepar' : ''}`
          : 'Peningkatan Transaminase Hepar (Hepatocellular Injury) — Evaluasi DILI / Hepatitis / Sepsis';
        criticality = 'medium';
      }

      return {
        order: 6,
        title,
        division: 'gastro',
        divisionName: PAPDI_DIVISIONS.gastro.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi risiko dehidrasi/gangguan elektrolit, toleransi nutrisi enteral, fungsi hepar, dan profilaksis mukosa lambung.`,
        sEvidence: [
          'Keluhan BAB cair, muntah, perut kembung, nyeri ulu hati, mual, atau perut membesar.',
        ],
        oEvidence: [
          albLab ? albLab.rawString : 'Parameter hepar dievaluasi.',
          ...(transLab ? [transLab.rawString] : []),
        ],
        pdx: [
          'Profil fungsi hepar lengkap: SGOT, SGPT, Bilirubin Total/Direk, Albumin, Globulin',
          'Faal hemostasis: PT, aPTT, INR (evaluasi sintesis faktor koagulasi hati)',
          'Analisis elektrolit serial (pantau risiko kehilangan kalium via gastrointestinal)',
        ],
        ptx: [
          isBleed
            ? 'Puasakan, pasang NGT dekompresi, resusitasi cairan kristaloid, PPI dosis tinggi (Omeprazole 80 mg bolus dilanjutkan 8 mg/jam drip), vasokonstriktor splanknik (Octreotide/Somatostatin) bila curiga varises, transfusi PRC target Hb > 7-8 g/dL.'
            : isDiarrhea
              ? 'Rehidrasi cairan kristaloid IVFD NaCl 0.9% 1500 cc/24 jam, ganti diet enteral via NGT menjadi formula bebas laktosa (lactose-free diet), dan berikan Attapulgite 2 tablet tiap BAB cair (maksimal 8 tab/hari).'
              : 'Profilaksis stres ulcer perioperatif: Inj. Omeprazole 40 mg IV q12-24h.',
          albLab && albLab.value < 2.8
            ? 'Koreksi Hipoalbuminemia: Transfusi Human Albumin 20% / 25% 100 mL pre-op untuk menaikkan tekanan onkotik dan mempercepat penyembuhan luka operasi.'
            : 'Pertahankan asupan nutrisi enteral/parenteral yang memadai.',
          'Hindari obat-obatan hepatotoksik dan evaluasi penyesuaian dosis antibiotik.',
        ],
        pmx: [
          'Monitoring frekuensi dan konsistensi BAB, balans cairan harian',
          'Tanda-tanda ensefalopati hepatikum (flapping tremor, disorientasi, somnolen)',
        ],
        pex: [
          'Edukasi diet enteral bebas laktosa bertahap dan menghindari makanan yang merangsang motilitas usus.',
        ],
      };
    },
  },

  // 7. HEMATOLOGI & ONKOLOGI MEDIK
  {
    division: 'hemato',
    keywords:
      /\b(anemia|hb\s*\d+|pucat|transfusi|trombositopenia|trombosit|plt|leukemia|limfoma|kanker|kemoterapi|dvt|emboli|koagulopati|pt\b|aptt|inr|fibrinogen|d-dimer)\b/i,
    generateProblem: (_matches, _vitals, labs, _fullText) => {
      const hbLab = labs.find((l) => l.name.includes('Hemoglobin'));
      const pltLab = labs.find((l) => l.name.includes('Trombosit'));
      const inrLab = labs.find((l) => l.name.includes('INR'));
      const isSevereAnemia = hbLab && hbLab.value < 8.0;
      const isSeverePlt = pltLab && pltLab.value < 100000;
      const isCoagulopathy = inrLab && inrLab.value > 1.4;

      let title = 'Anemia Normositik Normokromik Ringan-Sedang';
      let criticality: SpPdProblem['criticality'] = 'medium';

      if (isSeverePlt || isCoagulopathy) {
        title = `Trombositopenia Signifikan (PLT: ${pltLab ? pltLab.value.toLocaleString('id-ID') : '-'} /uL) ${isCoagulopathy ? `& Koagulopati (INR ${inrLab?.value})` : ''} — Waspada Risiko Perdarahan Prosedur Neurobedah`;
        criticality = 'high';
      } else if (isSevereAnemia) {
        title = `Sitopenia Signifikan (Anemia Berat) — Risiko Hipoksia Jaringan & Perdarahan`;
        criticality = 'high';
      }

      return {
        order: 7,
        title,
        division: 'hemato',
        divisionName: PAPDI_DIVISIONS.hemato.nameIndonesian,
        criticality,
        assessment: `${title}. Evaluasi cadangan hemostasis primer/sekunder, risiko perdarahan intrakranial, dan kesiapan komponen darah pre-prosedur.`,
        sEvidence: [
          'Riwayat perdarahan intrakranial (sSAH, ICH, IVH), mudah memar, mimisan, atau gusi berdarah.',
        ],
        oEvidence: [
          ...(hbLab ? [hbLab.rawString] : []),
          ...(pltLab ? [pltLab.rawString] : []),
          ...(inrLab ? [inrLab.rawString] : []),
        ],
        pdx: [
          'Pemeriksaan Darah Lengkap dengan indeks eritrosit (MCV, MCH, MCHC) serial',
          'Faal hemostasis lengkap: PT, aPTT, INR, Fibrinogen pre-operatif',
          'Hitung trombosit konfirmasi tabung sitrat bila kecurigaan pseudotrombositopenia',
        ],
        ptx: [
          isSeverePlt
            ? 'Koreksi Trombositopenia: Persiapkan transfusi Thrombocyte Concentrate (TC) target trombosit perioperatif ≥ 100.000 /uL untuk prosedur bedah saraf (konversi EVD to VP Shunt).'
            : 'Pantau hitung trombosit serial.',
          isCoagulopathy
            ? 'Pertimbangkan koreksi faal hemostasis dengan Fresh Frozen Plasma (FFP) atau Vitamin K bila INR tetap memanjang pre-operatif.'
            : 'Profilaksis hemostasis terkontrol.',
          isSevereAnemia
            ? 'Koreksi Anemia: Transfusi Packed Red Cell (PRC) target Hb ≥ 10 g/dL untuk bedah mayor.'
            : 'Suplementasi hematinik sesuai indikasi.',
        ],
        pmx: [
          'Hitung darah lengkap serial pasca-operasi (pantau perdarahan tersembunyi)',
          'Tanda-tanda perdarahan aktif pada drain bedah / EVD atau luka insisi',
        ],
        pex: [
          'Edukasi pentingnya persiapan komponen darah transfusi sebelum tindakan bedah invasif.',
        ],
      };
    },
  },

  // 8. REUMATOLOGI
  {
    division: 'reuma',
    keywords:
      /\b(asam urat|gout|artritis|arthritis|osteoarthritis|oa\b|ra\b|rheumatoid|sle\b|lupus|bengkak sendi|kaku sendi|allopurinol|kolkisin|colchicine|metilprednisolon|steroid)\b/i,
    generateProblem: (_matches, _vitals, _labs, fullText) => {
      const isLupus = /\b(sle|lupus)\b/i.test(fullText);
      const isGout = /\b(gout|asam urat|tofus|podagra)\b/i.test(fullText);

      const title = isLupus
        ? 'Systemic Lupus Erythematosus (SLE) — Evaluasi Keterlibatan Organ Sistemik'
        : isGout
          ? 'Artritis Gout Akut / Hiperurisemia'
          : 'Osteoarthritis (OA) / Gangguan Muskuloskeletal Kronis';

      return {
        order: 8,
        title,
        division: 'reuma',
        divisionName: PAPDI_DIVISIONS.reuma.nameIndonesian,
        criticality: isLupus ? 'high' : 'medium',
        assessment: `${title}. Evaluasi aktivitas penyakit inflamasi, proteksi sendi, dan regulasi steroid perioperatif.`,
        sEvidence: [
          'Riwayat nyeri sendi hebat, pembengkakan sendi, kaku pagi hari, atau konsumsi obat steroid rutin.',
        ],
        oEvidence: ['Tanda inflamasi sendi atau tofus pada pemeriksaan fisik.'],
        pdx: [
          'Kadar Asam Urat serum, LED (Laju Endap Darah), CRP kuantitatif',
          isLupus
            ? 'ANA profile, Anti-dsDNA, C3, C4 komplemen, dan urinalisis evaluasi nefritis lupus'
            : 'Foto rontgen sendi artikular terkait',
        ],
        ptx: [
          isGout
            ? 'Pada serangan gout akut: Berikan Kolkisin 0.5 mg PO bid atau Metilprednisolon dosis rendah. JANGAN menghentikan atau memulai Allopurinol baru pada fase akut; bila sudah rutin, lanjutkan dosis pemeliharaan.'
            : 'Analgetik aman ginjal (Parasetamol). Hindari NSAID dosis tinggi bila ada risiko gagal ginjal / gastritis.',
          /\b(steroid|metilprednisolon|prednison)\b/i.test(fullText)
            ? 'Stress-Dose Steroid Perioperatif: Pada pasien pemakai steroid kronis (> 5 mg prednison > 3 minggu), berikan Hidrokortison 50 - 100 mg IV saat induksi dilanjutkan 50 mg q8h selama 24 jam untuk mencegah Krisis Adrenal pasca-bedah.'
            : 'Terapi suportif sesuai indikasi.',
        ],
        pmx: [
          'Evaluasi nyeri sendi dan mobilisasi aktif pasca-bedah',
          'Tanda-tanda supresi adrenal (hipotensi refrakter, hipoglikemia, hiponatremia)',
        ],
        pex: ['Edukasi diet rendah purin dan hidrasi cairan minimal 2 liter per hari.'],
      };
    },
  },

  // 9. ALERGI & IMUNOLOGI KLINIS
  {
    division: 'alergi',
    keywords:
      /\b(alergi|alergi obat|urtikaria|angioedema|anafilaksis|syok anafilaktik|sjs|ten\b|dress\b|gatal|ruam|biduran|eosinofil|ige)\b/i,
    generateProblem: (_matches, _vitals, _labs, fullText) => {
      const isAnaphylaxis = /\b(anafilaksis|syok anafilaktik|angioedema)\b/i.test(fullText);
      const isSevereDrug = /\b(sjs|ten|dress)\b/i.test(fullText);

      const title = isAnaphylaxis
        ? 'Reaksi Anafilaksis / Hipersensitivitas Berat — Kegawatan Imunologi'
        : isSevereDrug
          ? 'Severe Cutaneous Adverse Reaction (SCAR / SJS / TEN)'
          : 'Hipersensitivitas / Alergi Obat & Makanan';

      return {
        order: 9,
        title,
        division: 'alergi',
        divisionName: PAPDI_DIVISIONS.alergi.nameIndonesian,
        criticality: isAnaphylaxis || isSevereDrug ? 'critical' : 'medium',
        assessment: `${title}. Identifikasi alergen pemicu dan kewaspadaan reaksi silang obat anestesi / antibiotik.`,
        sEvidence: [
          'Riwayat alergi obat antibiotik (penisilin, sefalosporin), NSAID, atau makanan laut.',
        ],
        oEvidence: ['Ruam kulit eritematosa, urtika, atau tanda edema laring.'],
        pdx: [
          'Pencatatan riwayat alergi obat secara detail (nama obat, bentuk reaksi, tahun kejadian)',
          'Pemeriksaan Eosinofil absolut dan IgE spesifik bila diindikasikan',
        ],
        ptx: [
          isAnaphylaxis
            ? 'Tatalaksana Anafilaksis Cito: Epinefrin / Adrenalin 1:1000 0.3 - 0.5 mg Intramuskular pada paha anterolateral segera, ulangi tiap 5-15 menit bila belum respon. Berikan oksigenasi, loading cairan kristaloid cepat, Difenhidramin 50 mg IV, dan Metilprednisolon 125 mg IV.'
            : 'Pasang gelang penanda ALERGI MERAH pada pergelangan tangan pasien dan cantumkan dengan jelas pada rekam medis.',
          'Pilihan antibiotik profilaksis bedah: Bila alergi penisilin/sefalosporin tipe berat, gunakan Vankomisin atau Klindamisin sesuai panduan PPI.',
          'Hindari obat-obatan pembebas histamin non-imunologik bila riwayat urtikaria berulang.',
        ],
        pmx: [
          'Observasi tanda vital dan kepatenan jalan nafas saat pemberian obat parenteral baru',
          'Perkembangan ruam kulit atau edema mukosa',
        ],
        pex: [
          'Edukasi kartu alergi obat untuk selalu dibawa oleh pasien pada setiap kunjungan medis.',
        ],
      };
    },
  },

  // 10. GERIATRI (KEDOKTERAN LANSIA)
  {
    division: 'geriatri',
    keywords:
      /\b(geriatri|lansia|usia\s*(?:6[5-9]|[7-9]\d)\s*th|delirium|demensia|frailty|jatuh|inkontinensia|polifarmasi|dekubitus|malnutrisi)\b/i,
    generateProblem: (_matches, _vitals, _labs, fullText) => {
      const isDelirium = /\b(delirium|disorientasi|gelisah akut)\b/i.test(fullText);

      const title = isDelirium
        ? 'Delirium Hipoaktif / Hiperaktif pada Sindrom Geriatri'
        : 'Sindrom Geriatri (Frailty, Polifarmasi & Risiko Jatuh)';

      return {
        order: 10,
        title,
        division: 'geriatri',
        divisionName: PAPDI_DIVISIONS.geriatri.nameIndonesian,
        criticality: isDelirium ? 'high' : 'medium',
        assessment: `${title}. Evaluasi cadangan fungsional (Comprehensive Geriatric Assessment), kriteria Beers, dan pencegahan komplikasi imobilitas.`,
        sEvidence: [
          'Pasien usia lanjut dengan multipatologi komorbid, penurunan daya ingat, atau gangguan kemandirian ADL.',
        ],
        oEvidence: [
          'Penilaian Barthel Index, status kognitif, dan kondisi kulit area penonjolan tulang.',
        ],
        pdx: [
          'Skrining Delirium (Confusion Assessment Method / CAM)',
          'Evaluasi Barthel Index (kemandirian fungsional) dan skrining status nutrisi (MNA)',
          'Review polifarmasi berkala (kriteria STOPP/START dan kriteria Beers)',
        ],
        ptx: [
          'Prinsip farmakoterapi geriatri: "Start Low, Go Slow". Sesuaikan seluruh dosis obat dengan perkiraan eGFR geriatri.',
          'Pencegahan Delirium Perioperatif: Reorientasi ruangan/waktu, pertahankan siklus tidur alami, hidrasi adekuat, hindari restrain fisik, minimalkan obat antikolinergik dan benzodiazepin sedatif.',
          'Pencegahan Ulkus Dekubitus: Alih baring miring kanan-kiri berkala tiap 2 jam dan gunakan kasur antidekubitus bila imobilisasi total.',
          'Mobilisasi bertahap pasca-operasi sedini mungkin didampingi fisioterapis.',
        ],
        pmx: [
          'Status orientasi waktu, tempat, dan orang setiap pergantian shift',
          'Integritas kulit sacrum/tumit dan fungsi eliminasi BAK/BAB',
        ],
        pex: [
          'Edukasi pendampingan keluarga untuk mencegah risiko jatuh (bed rail terpasang, pencahayaan cukup).',
        ],
      };
    },
  },

  // 11. PSIKOSOMATIK & KEDOKTERAN HOLISTIK
  {
    division: 'psikosomatik',
    keywords:
      /\b(psikosomatik|ansietas|cemas|panik|depresi|somatoform|nyeri kronik|insomnia|jantung berdebar fungsional|hiperventilasi)\b/i,
    generateProblem: (_matches, _vitals, _labs, _fullText) => {
      const title = 'Gangguan Psikosomatik / Ansietas Terkait Penyakit Medis Organik';

      return {
        order: 11,
        title,
        division: 'psikosomatik',
        divisionName: PAPDI_DIVISIONS.psikosomatik.nameIndonesian,
        criticality: 'low',
        assessment: `${title}. Pendekatan biopsikososial holistik terhadap keluhan fisik yang dipengaruhi faktor emosional.`,
        sEvidence: [
          'Keluhan rasa cemas berlebihan, dada berdebar-debar tanpa kelainan struktural, atau sulit tidur menjelang operasi.',
        ],
        oEvidence: [
          'Pemeriksaan organik dalam batas normal / keluhan fisik berulang yang tidak proporsional.',
        ],
        pdx: [
          'Skrining kecemasan dan depresi (HADS / DASS-21)',
          'Identifikasi stresor psikososial dan ekspektasi terhadap prosedur medis',
        ],
        ptx: [
          'Komunikasi terapeutik, penjelasan rasional mengenai prosedur operasi untuk meredakan kecemasan pra-bedah.',
          'Terapi relaksasi napas dalam (deep breathing exercise) dan edukasi coping mechanism.',
          'Bila kecemasan berat mengganggu tidur: Pertimbangkan antiansietas dosis rendah kerja singkat (mis. Alprazolam 0.25 - 0.5 mg malam hari) dengan evaluasi ketat.',
        ],
        pmx: [
          'Tingkat kecemasan dan kualitas tidur pre/post-operasi',
          'Stabilitas tanda vital yang dipengaruhi respons adrenergik kecemasan',
        ],
        pex: [
          'Edukasi bahwa rasa cemas adalah respons alami dan keluarga dianjurkan memberikan dukungan emosional suportif.',
        ],
      };
    },
  },
];

/**
 * Identifies and generates active problem lists mapped to 11 Divisi IPD PAPDI.
 */
export function identifySpPdProblems(
  text: string,
  vitals: ParsedVitals,
  labs: ParsedLabItem[],
): SpPdProblem[] {
  const clean = text ? text.trim() : '';
  const foundProblems: SpPdProblem[] = [];
  let orderCounter = 1;

  if (clean.length > 0) {
    for (const rule of DIVISION_RULES) {
      const matches = clean.match(rule.keywords);
      // Also trigger if labs match that division
      const divisionLabs = labs.filter((l) => l.division === rule.division);

      if (matches || divisionLabs.length > 0) {
        const problem = rule.generateProblem(matches || [], vitals, labs, clean);
        if (problem) {
          problem.order = orderCounter++;
          foundProblems.push(problem);
        }
      }
    }
  }

  // Fallback if no specific division matched or empty input
  if (foundProblems.length === 0) {
    foundProblems.push({
      order: 1,
      title: 'Pemeriksaan Klinis Umum Bidang Ilmu Penyakit Dalam',
      division: 'endokrin',
      divisionName: PAPDI_DIVISIONS.endokrin.nameIndonesian,
      criticality: 'low',
      assessment:
        'Status klinis penyakit dalam dalam batas terkontrol. Tidak ditemukan kegawatan aktif.',
      sEvidence: [clean ? clean.slice(0, 120) : 'Pasien dalam evaluasi klinis umum.'],
      oEvidence: [
        vitals.rawMatched.bp
          ? `Tekanan Darah: ${vitals.rawMatched.bp}`
          : 'Tanda vital dalam evaluasi.',
      ],
      pdx: [
        'Pemeriksaan laboratorium skrining rutin pre-prosedur (Darah Lengkap, GDS, Ureum, Kreatinin, EKG)',
      ],
      ptx: ['Pertahankan status nutrisi dan hidrasi normal.', 'Lanjutkan terapi rutin bila ada.'],
      pmx: ['Monitoring tanda vital berkala.'],
      pex: ['Edukasi rencana tindakan dan pola hidup sehat.'],
    });
  }

  return foundProblems;
}

// ──────────────────────────────────────────────────────────────────────────────
// MODE 1: Jawab Konsul TS (Konsul Bedah, Obsgyn, TS Lain)
// ──────────────────────────────────────────────────────────────────────────────

export function generateConsultationAnswer(
  inputText: string,
  urgencyOrPreset: SurgicalUrgencyType | 'preop' | 'raber' | 'akut' = 'elektif',
): SpPdConsultResult {
  const vitals = extractVitals(inputText);
  const { abnormalLabs: labs, labTrends } = extractLabTrendsAndAbnormal(inputText);
  const problems = identifySpPdProblems(inputText, vitals, labs);

  // Normalize Urgency: binary dichotomy ('elektif' vs 'life_saving')
  const isLifeSaving = urgencyOrPreset === 'life_saving' || urgencyOrPreset === 'akut';
  const urgencyType: SurgicalUrgencyType = isLifeSaving ? 'life_saving' : 'elektif';
  const isEmergencySurgery = isLifeSaving;
  const urgencyLevel: 'CITO / Emergensi' | 'Elektif Terjadwal' = isLifeSaving
    ? 'CITO / Emergensi'
    : 'Elektif Terjadwal';

  // Detect requesting specialty
  let requestingSpecialty = 'TS Bedah / Obsgyn / Pemohon Konsul';
  if (/obsgyn|kandungan|kebidanan|caesar|sc\b|preeklamsia/i.test(inputText)) {
    requestingSpecialty = 'TS Obstetri & Ginekologi (Obsgyn)';
  } else if (
    /bedah saraf|craniotomy|kraniotomi|sdh|edh|evd|vp\s*shunt|aneurysma|aneurysm|ventrikulitis|meningoensefalitis/i.test(
      inputText,
    )
  ) {
    requestingSpecialty = 'TS Bedah Saraf';
  } else if (/ortopedi|orthopedi|fraktur|orif/i.test(inputText)) {
    requestingSpecialty = 'TS Bedah Ortopedi & Traumatologi';
  } else if (/urologi|bph|turp|dj\s*stent|nefrolitiasis/i.test(inputText)) {
    requestingSpecialty = 'TS Bedah Urologi';
  } else if (/bedah umum|laparotomi|apendisitis|hernia|kolesistektomi/i.test(inputText)) {
    requestingSpecialty = 'TS Bedah Umum / Digestif';
  }

  // 1. Evaluate Operative Tolerance Status
  // Red flag conditions requiring Tunda Operasi for elective procedures:
  const severeBp = (vitals.systolic && vitals.systolic >= 180) || (vitals.diastolic && vitals.diastolic >= 110);
  const criticalK = labs.find(
    (l) => l.name.includes('Kalium') && (l.value < 2.5 || l.value >= 6.0 || l.flag === 'critical'),
  );
  const criticalGds = labs.find(
    (l) =>
      l.name.includes('Gula') &&
      (l.value >= 350 || l.interpretation.includes('KAD') || l.interpretation.includes('HHS')),
  );
  const activeSepsis = problems.some(
    (p) =>
      p.title.includes('Sepsis') ||
      p.title.includes('KAD') ||
      p.title.includes('Meningoensefalitis') ||
      /bakteremia|sepsis/i.test(inputText),
  );
  const activeAcs = problems.some((p) => p.title.includes('Acute Coronary Syndrome'));
  const criticalHb = labs.find((l) => l.name.includes('Hemoglobin') && l.value < 7.5);
  const isNeurosurgery = /bedah saraf|craniotomy|kraniotomi|sdh|edh|evd|vp\s*shunt|aneurysma|aneurysm/i.test(
    inputText,
  );
  const pltLab = labs.find((l) => l.name.includes('Trombosit'));
  const criticalPlt = pltLab && (isNeurosurgery ? pltLab.value < 100000 : pltLab.value < 50000);

  let toleranceStatus: OperativeToleranceStatus = 'LAIK OPERASI';
  let toleranceReason =
    'Kondisi klinis penyakit dalam stabil, komorbiditas terkendali dengan baik.';

  if (!isEmergencySurgery) {
    // ── KASUS: OPERASI ELEKTIF TERENCANA ──
    if (severeBp || criticalK || criticalGds || activeSepsis || activeAcs || criticalHb || criticalPlt) {
      toleranceStatus = 'TUNDA OPERASI ELEKTIF';
      const reasons: string[] = [];
      if (severeBp)
        reasons.push(`Tekanan darah krisis (${vitals.systolic}/${vitals.diastolic} mmHg)`);
      if (criticalK)
        reasons.push(`Gangguan elektrolit berbahaya (${criticalK.rawString || `${criticalK.value} mEq/L`})`);
      if (criticalGds)
        reasons.push(`Hiperglikemia berat (${criticalGds.rawString || `${criticalGds.value} mg/dL`})`);
      if (activeAcs) reasons.push('Sindrom Koroner Akut (Injury Miokard Aktif)');
      if (activeSepsis) reasons.push('Sepsis / Infeksi Intrakranial / Bakteremia Aktif');
      if (criticalHb)
        reasons.push(`Anemia berat belum terkoreksi (${criticalHb.rawString || `${criticalHb.value} g/dL`})`);
      if (criticalPlt)
        reasons.push(
          `Trombositopenia signifikan (${pltLab ? pltLab.rawString || `${pltLab.value.toLocaleString('id-ID')} /uL` : ''}${
            isNeurosurgery
              ? ' - ambang aman bedah saraf ≥ 100.000 /uL'
              : ' - ambang aman bedah umum ≥ 50.000 /uL'
          })`,
        );
      toleranceReason = `Ditemukan parameter kritis kontraindikasi operasi elektif yang memerlukan stabilisasi cito: ${reasons.join(', ')}. Disarankan TUNDA OPERASI ELEKTIF hingga target hemodinamik, metabolik, dan hematologi tercapai.`;
    } else if (problems.some((p) => p.criticality === 'high' || p.criticality === 'critical')) {
      toleranceStatus = 'LAIK OPERASI DENGAN CATATAN';
      toleranceReason =
        'Terdapat komorbiditas penyakit dalam yang memerlukan kewaspadaan perioperatif ketat, penyesuaian obat anestesi, serta monitoring hemodinamik berkala.';
    }
  } else {
    // ── KASUS: OPERASI CITO / LIFE-SAVING EMERGENSI ──
    // Prinsip Utama: TIDAK ADA ISTILAH "TUNDA OPERASI" karena penundaan berisiko fatalitas langsung.
    toleranceStatus = 'PROSEDUR DAPAT BERJALAN DENGAN PENDAMPINGAN & STABILISASI CITO PARALEL';
    toleranceReason =
      'Operasi CITO / Emergensi / Life-Saving tidak boleh ditunda karena penundaan berisiko fatalitas langsung. Penanganan penyakit dalam bergeser total ke penyelamatan paralel: stabilisasi CITO, proteksi organ vital, dan koreksi simultan pre-, intra-, dan post-operatif.';
  }

  // 2. RCRI Lee Score Calculation
  let rcriScore = 0;
  // High-risk surgery (intraperitoneal, intrathoracic, suprainguinal vascular)
  if (/laparotomi|torakotomi|aneurisma|vaskular|kolesistektomi/i.test(inputText)) rcriScore += 1;
  // Ischemic heart disease (history of CAD, MI, angina, stemi, nstemi)
  if (/\b(pjk|cad|koroner|stemi|nstemi|uap|angina|infark|old mi|stent|cabg)\b/i.test(inputText))
    rcriScore += 1;
  // History of CHF
  if (/gagal jantung|heart failure|chf|edema paru/i.test(inputText)) rcriScore += 1;
  // Cerebrovascular disease
  if (/stroke|tia|infark serebri/i.test(inputText)) rcriScore += 1;
  // Diabetes on insulin
  if (/insulin|novorapid|lantus/i.test(inputText)) rcriScore += 1;
  // Renal insufficiency (Cr > 2.0)
  const highCr = labs.find((l) => l.name.includes('Kreatinin') && l.value > 2.0);
  if (highCr) rcriScore += 1;

  let rcriClass = 'Kelas I (Risiko Kardiovaskular Sangat Rendah: ~0.4% risiko MACE)';
  if (rcriScore === 1) rcriClass = 'Kelas II (Risiko Kardiovaskular Rendah: ~0.9% risiko MACE)';
  else if (rcriScore === 2)
    rcriClass = 'Kelas III (Risiko Kardiovaskular Sedang: ~6.6% risiko MACE)';
  else if (rcriScore >= 3) rcriClass = 'Kelas IV (Risiko Kardiovaskular Tinggi: >11% risiko MACE)';

  // 3. Additional Evidence-Based Pre-Op Risk Scores (Sp.PD Training Center Standards)
  const matchedProtocols = matchProtocols(inputText);
  const ariscatRes = calculateARISCAT(inputText, vitals, labs);
  const capriniRes = calculateCaprini(inputText, vitals, labs);
  const improveRes = calculateImprove(inputText, vitals, labs);
  const isGeriatric = /geriatri|lansia|usia\s*(?:6[5-9]|[7-9]\d)\s*th/i.test(inputText);
  const deliriumRes = isGeriatric ? calculateDeliriumPAPDI(inputText, vitals, labs) : null;
  const morseRes = isGeriatric ? calculateMorse(inputText, vitals, labs) : null;

  // Compile Advis
  const preOpAdvis: string[] = [];
  const intraOpAdvis: string[] = [];
  const postOpAdvis: string[] = [];
  const jointCareAdvis: string[] = [];

  if (isEmergencySurgery) {
    // ── EMERGENCY / LIFE-SAVING ADVIS (PARALLEL RESCUE) ──
    preOpAdvis.push(
      'Jalur Akses CITO: Pasang Central Venous Catheter (CVC) atau 2 jalur infus perifer kaliber besar (16G/18G) untuk resusitasi dan koreksi simultan.',
      'Standby Darah di Kamar Operasi: Siapkan PRC, Thrombocyte Concentrate (TC), dan FFP langsung di meja operasi tanpa menunda induksi anestesi.',
      'Inisiasi koreksi cito simultan pre-induksi: jangan tunda tindakan operasi untuk menunggu koreksi selesai di bangsal rawat.',
    );
    if (criticalK) {
      preOpAdvis.push(
        `Koreksi CITO Kalium (${criticalK.value} mEq/L): Pasang syringe pump KCl via akses vena sentral, hindari bolus cepat.`,
      );
    }
    if (criticalPlt) {
      preOpAdvis.push(
        `Transfusi TC CITO: Pasang transfusi platelet perioperatif target trombosit ${
          isNeurosurgery ? '≥ 100.000 /uL (Bedah Saraf)' : '≥ 50.000 /uL'
        }.`,
      );
    }

    intraOpAdvis.push(
      'Koreksi Simultan Intraoperatif: Lanjutkan infus lambat KCl via syringe pump (kecepatan 10-20 mEq/jam via CVC) dengan monitoring ketat di meja operasi.',
      'Monitoring EKG Kontinu: Pantau ketat ritme terhadap aritmia letal (Ventricular Tachycardia, Ventricular Fibrillation, asistol) selama manipulasi bedah.',
      'Proteksi Hemodinamik & Organ: Pertahankan Mean Arterial Pressure (MAP) ≥ 65-80 mmHg dan cegah fluktuasi hemodinamik ekstrem untuk preservasi perfusi organ vital.',
    );

    postOpAdvis.push(
      'Mandatory Alih Rawat Intensif: Pasien wajib dirawat pasca-bedah di Intensive Care Unit (ICU / HCU) dengan kesiapan ventilator support bila diperlukan.',
      'Serial Lab Monitoring CITO: Evaluasi ulang serial elektrolit (K, Na), analisa gas darah (AGD), dan darah lengkap tiap 2-4 jam pasca-operasi.',
      'Rawat Bersama Aktif Sp.PD: Tim Penyakit Dalam mendampingi tatalaksana komorbiditas, titrasi cairan, dan keseimbangan asam-basa pasca-bedah.',
    );
    jointCareAdvis.push('Alih rawat bersama ICU / HCU pasca-bedah cito dengan tim Bedah dan Anestesi.');
  } else {
    // ── ELECTIVE ADVIS (PROCEDURAL SAFETY & OPTIMIZATION) ──
    for (const prob of problems) {
      preOpAdvis.push(
        ...prob.ptx.filter(
          (x) =>
            x.toLowerCase().includes('pre-op') ||
            x.toLowerCase().includes('pagi') ||
            x.toLowerCase().includes('stop') ||
            x.toLowerCase().includes('transfusi') ||
            x.toLowerCase().includes('koreksi'),
        ),
      );
      intraOpAdvis.push(
        ...prob.pmx.filter(
          (x) =>
            x.toLowerCase().includes('intraoperatif') ||
            x.toLowerCase().includes('target') ||
            x.toLowerCase().includes('monitoring'),
        ),
      );
      postOpAdvis.push(
        ...prob.pmx.filter(
          (x) =>
            x.toLowerCase().includes('pasca') ||
            x.toLowerCase().includes('post') ||
            x.toLowerCase().includes('target'),
        ),
      );
      jointCareAdvis.push(...prob.pdx);
    }

    // Fallbacks if empty
    if (preOpAdvis.length === 0) {
      preOpAdvis.push(
        'Puasakan pasien 6-8 jam sebelum operasi elektif.',
        'Obat rutin antihipertensi (selain ACEi/ARB) dapat diminum pagi hari dengan sedikit air.',
      );
    }
    if (intraOpAdvis.length === 0) {
      intraOpAdvis.push(
        'Monitoring EKG kontinu, tekanan darah, dan saturasi oksigen intraoperatif.',
        'Pertahankan Mean Arterial Pressure (MAP) ≥ 65 mmHg dan normovolemia.',
      );
    }
    if (postOpAdvis.length === 0) {
      postOpAdvis.push(
        'Monitoring tanda vital dan produksi urin pasca-anestesi di ruang pemulihan (RR).',
        'Analgetik pasca-bedah yang aman bagi lambung dan fungsi ginjal.',
      );
    }
  }

  // Format Full Indonesian Medical Letter for TS
  const presetTitle =
    urgencyType === 'life_saving'
      ? 'JAWABAN KONSUL TS: EVALUASI OPERASI CITO / LIFE-SAVING EMERGENSI'
      : urgencyOrPreset === 'raber'
        ? 'JAWABAN KONSUL TS: KESEPAKATAN RAWAT BERSAMA (CO-MANAGEMENT)'
        : 'JAWABAN KONSUL TS: EVALUASI TOLERANSI OPERASI ELEKTIF TERENCANA';

  const fullDraftText = [
    `=== ${presetTitle} ===`,
    `Kepada Yth. : ${requestingSpecialty}`,
    'Dari        : Tim Medik Penyakit Dalam (Sp.PD)',
    `Sifat       : ${urgencyLevel}`,
    `Tanggal     : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    'Terima kasih atas kepercayaan teman sejawat telah mengonsultasikan pasien ini.',
    'Berdasarkan anamnesis, pemeriksaan fisik, dan evaluasi data penunjang terkini:',
    '',
    'I. DAFTAR MASALAH PENYAKIT DALAM AKTIF:',
    ...problems.map((p) => `  #${p.order}. ${p.title} [Divisi: ${p.divisionName}]`),
    '',
    'II. RINGKASAN DATA VITAL & PENUNJANG ABNORMAL:',
    vitals.rawMatched.bp
      ? `  - Tanda Vital: TD ${vitals.rawMatched.bp}; HR ${vitals.rawMatched.hr || '-'}; RR ${vitals.rawMatched.rr || '-'}; Suhu ${vitals.rawMatched.temp || '-'}; SpO2 ${vitals.rawMatched.spo2 || '-'}`
      : '  - Tanda Vital: Dalam batas evaluasi.',
    ...(labs.length > 0
      ? labs.map(
          (l) =>
            `  - ${l.name}: ${l.value} ${l.unit} [${l.flag.toUpperCase()}] — ${l.interpretation}`,
        )
      : ['  - Parameter laboratorium utama dalam batas rujukan aman.']),
    '',
    'III. STRATIFIKASI RISIKO PERIOPERATIF:',
    `  - Indeks Risiko Jantung (RCRI Lee): Skor ${rcriScore} &bull; ${rcriClass}`,
    `  - Risiko Komplikasi Paru (ARISCAT): ${ariscatRes.score !== null ? `${ariscatRes.score} points (${ariscatRes.interpretation})` : '___ points (___% risk of in-hospital post-op pulmonary complication)'}`,
    `  - Risiko Perdarahan (Improve Score): ${improveRes.score !== null ? `${improveRes.score} points (${improveRes.interpretation})` : '___ points (No increased risk of bleeding)'}`,
    `  - Risiko Tromboemboli Vena (Caprini VTE): ${capriniRes.score !== null ? `${capriniRes.score} points (${capriniRes.interpretation})` : '___ points (___% VTE risk)'}`,
    ...(isGeriatric && deliriumRes
      ? [`  - Risiko Delirium Geriatri (PAPDI): ${deliriumRes.score !== null ? `${deliriumRes.score} points (${deliriumRes.interpretation})` : '___ points (___% risk delirium post-op)'}`]
      : []),
    ...(isGeriatric && morseRes
      ? [`  - Risiko Jatuh Geriatri (Morse Fall Risk): ${morseRes.score !== null ? `${morseRes.score} points (${morseRes.interpretation})` : '___ points (___)'}`]
      : []),
    `  - Kontrol Hemodinamik & Metabolik: ${toleranceReason}`,
    '',
    `IV. KESIMPULAN STATUS TOLERANSI OPERASI: [ ${toleranceStatus} ]`,
    `  Catatan: ${toleranceReason}`,
    '',
    urgencyType === 'elektif'
      ? [
          '  Optimal dilakukan tindakan elektif apabila:',
          '  • TD < 160/90 mmHg',
          '  • BS < 200 mg/dL',
          '  • SC < 7 gr/dL',
          '  • HB > 10 gr/dL',
          '  • K 3.5 - 5.5 mmol/L',
          '  • Eutiroid / Subklinis',
          '',
        ].join('\n')
      : '',
    'V. SARAN & REKOMENDASI SP.PD:',
    '  A. RENCANA PRE-OPERATIF:',
    ...preOpAdvis.slice(0, 4).map((a) => `     &bull; ${a}`),
    '',
    '  B. RENCANA INTRA-OPERATIF:',
    ...intraOpAdvis.slice(0, 3).map((a) => `     &bull; ${a}`),
    '',
    '  C. RENCANA POST-OPERATIF & MONITORING:',
    ...postOpAdvis.slice(0, 3).map((a) => `     &bull; ${a}`),
    '',
    urgencyType === 'life_saving' || urgencyOrPreset === 'raber' || urgencyOrPreset === 'akut'
      ? 'VI. RENCANA RAWAT BERSAMA:\n  Kami bersedia rawat bersama untuk tatalaksana komorbiditas penyakit dalam. Tim Sp.PD akan visitasi rutin.'
      : 'VI. TINDAK LANJUT:\n  Bila terjadi perubahan hemodinamik bermakna atau perburukan akut, mohon hubungi kami kembali.',
    '',
    'Salam Sejawat,',
    'Tim Dokter Spesialis Penyakit Dalam (Sp.PD)',
  ].filter(Boolean).join('\n');

  return {
    urgencyType,
    consultType: urgencyOrPreset === 'raber' ? 'raber' : isLifeSaving ? 'akut' : 'preop',
    presetLabel: presetTitle,
    requestingSpecialty,
    toleranceStatus,
    toleranceReason,
    urgencyLevel,
    riskStratification: {
      rcriLeeScore: rcriScore,
      rcriLeeClass: rcriClass,
      cardiacRiskNotes: problems.some((p) => p.division === 'kardio')
        ? 'Terdapat komorbid kardiovaskular; pantau perfusi koroner.'
        : 'Risiko kardiak dasar rendah.',
      bleedingRiskNotes: labs.some((l) => l.name.includes('Trombosit') && l.flag !== 'normal')
        ? 'Perhatian hitung trombosit & faal koagulasi.'
        : 'Risiko hemostasis terkontrol.',
      glycemicRiskNotes: labs.some((l) => l.name.includes('Gula'))
        ? 'Pertahankan target GDS 140-180 mg/dL perioperatif.'
        : 'Status metabolik normal.',
      renalRiskNotes: labs.some((l) => l.name.includes('Kreatinin'))
        ? 'Waspada nefrotoksik; hidrasi cukup.'
        : 'Faal ginjal terjaga.',
      pulmonaryRiskNotes: problems.some((p) => p.division === 'pulmo')
        ? 'Optimalisasi bronkodilator pre/post ekstubasi.'
        : 'Risiko paru minimal.',
      ariscatScore: ariscatRes.score,
      capriniScore: capriniRes.score,
      improveBleedingScore: improveRes.score,
    },
    abnormalLabs: labs,
    labTrends,
    problems,
    preOpAdvis,
    intraOpAdvis,
    postOpAdvis,
    jointCareAdvis,
    fullDraftText,
    matchedProtocols,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// MODE 2: Periksa Pasien (SOAP Bangsal & Poliklinik format POMR)
// ──────────────────────────────────────────────────────────────────────────────

export function generatePomrNote(inputText: string): SpPdPomrResult {
  const vitals = extractVitals(inputText);
  const { abnormalLabs: labs, labTrends } = extractLabTrendsAndAbnormal(inputText);
  const problems = identifySpPdProblems(inputText, vitals, labs);

  const cleanText = inputText.trim();
  const generalSubjective: string[] = [];
  const generalObjective: string[] = [];

  // Subjective lines
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (!/^(td|bp|hr|rr|suhu|temp|lab|leukosit|hb|gds|usg|rontgen)/i.test(line)) {
      generalSubjective.push(line);
    }
  }
  if (generalSubjective.length === 0) {
    generalSubjective.push(
      'Pasien dalam evaluasi visite harian ruang rawat / poliklinik penyakit dalam.',
    );
  }

  // Objective lines
  if (vitals.rawMatched.bp) generalObjective.push(`Tekanan Darah: ${vitals.rawMatched.bp}`);
  if (vitals.rawMatched.hr) generalObjective.push(`Frekuensi Nadi: ${vitals.rawMatched.hr}`);
  if (vitals.rawMatched.rr) generalObjective.push(`Laju Pernapasan: ${vitals.rawMatched.rr}`);
  if (vitals.rawMatched.temp) generalObjective.push(`Suhu Tubuh: ${vitals.rawMatched.temp}`);
  if (vitals.rawMatched.spo2) generalObjective.push(`SpO2: ${vitals.rawMatched.spo2}`);
  for (const lab of labs) {
    generalObjective.push(`${lab.name}: ${lab.value} ${lab.unit} (${lab.interpretation})`);
  }

  const patientOverview = `Pasien evaluasi internal medicine dengan ${problems.length} masalah aktif teridentifikasi.`;

  // Build POMR Full Draft Text
  const pomrLines: string[] = [
    '=== CATATAN PERKEMBANGAN PASIEN TERINTEGRASI (CPPT / POMR SP.PD) ===',
    `Tanggal / Waktu: ${new Date().toLocaleString('id-ID')}`,
    'DPJP           : Dokter Spesialis Penyakit Dalam (Sp.PD)',
    '',
    '--- SUBJECTIVE (S) ---',
    ...generalSubjective.map((s) => `• ${s}`),
    '',
    '--- OBJECTIVE (O) ---',
    'Tanda Vital & Pemeriksaan Fisik:',
    ...generalObjective.map((o) => `• ${o}`),
    '',
    '--- ASSESSMENT / DAFTAR MASALAH (A) ---',
    ...problems.map((p) => `#${p.order}. ${p.title} [Divisi: ${p.divisionName}]`),
    '',
    '--- PLAN OF MANAGEMENT (P) BERDASARKAN MASALAH (POMR) ---',
  ];

  for (const p of problems) {
    pomrLines.push(`[ MASALAH #${p.order}: ${p.title} ]`);
    pomrLines.push('  1. Rencana Diagnostik (Pdx):');
    for (const dx of p.pdx) pomrLines.push(`     - ${dx}`);
    pomrLines.push('  2. Rencana Terapi (Ptx):');
    for (const tx of p.ptx) pomrLines.push(`     - ${tx}`);
    pomrLines.push('  3. Rencana Monitoring (Pmx):');
    for (const mx of p.pmx) pomrLines.push(`     - ${mx}`);
    pomrLines.push('  4. Rencana Edukasi (Pex):');
    for (const ex of p.pex) pomrLines.push(`     - ${ex}`);
    pomrLines.push('');
  }

  pomrLines.push('Tanda Tangan DPJP: dr. Sp.PD');

  return {
    patientOverview,
    vitals,
    abnormalLabs: labs,
    labTrends,
    problems,
    generalSubjective,
    generalObjective,
    fullDraftText: pomrLines.join('\n'),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// MODE 3: Ringkas Kasus (Resume Medis / Case Summary)
// ──────────────────────────────────────────────────────────────────────────────

export function generateCaseSummary(inputText: string): SpPdSummaryResult {
  const vitals = extractVitals(inputText);
  const { abnormalLabs: labs, labTrends } = extractLabTrendsAndAbnormal(inputText);
  const problems = identifySpPdProblems(inputText, vitals, labs);

  // Group problems by division
  const divisionMap = new Map<string, string[]>();
  for (const p of problems) {
    const arr = divisionMap.get(p.divisionName) || [];
    arr.push(p.title);
    divisionMap.set(p.divisionName, arr);
  }
  const activeProblemList: Array<{ division: string; problems: string[] }> = [];
  for (const [division, probs] of divisionMap.entries()) {
    activeProblemList.push({ division, problems: probs });
  }

  // Extract RPD & RPO from text
  const rpdMatch = inputText.match(
    /(?:rpd|riwayat penyakit dahulu|riwayat sakit)\s*[:=]([^\n\r.]+)/i,
  );
  const pastHistory: string[] = rpdMatch
    ? [rpdMatch[1].trim()]
    : ['Tidak terdokumentasi riwayat penyakit dahulu spesifik.'];

  const rpoMatch = inputText.match(
    /(?:rpo|riwayat pengobatan|obat rutin|th\/|terapi sebelumnya)\s*[:=]([^\n\r.]+)/i,
  );
  const currentMedications: string[] = rpoMatch
    ? [rpoMatch[1].trim()]
    : ['Tidak tercatat obat rutin harian sebelumnya.'];

  // Ongoing therapy compiled from problems
  const ongoingTherapy: string[] = [];
  for (const p of problems) {
    ongoingTherapy.push(...p.ptx.slice(0, 2));
  }

  // Internist advice
  const internistAdvice: string[] = [
    'Lanjutkan pemantauan klinis tanda vital dan keluhan subjektif.',
    'Evaluasi perbaikan laboratorium abnormal pada pemeriksaan ulang berkala.',
    'Konsultasikan kembali bila timbul perburukan hemodinamik atau kegawatan akut.',
  ];

  const summaryLines: string[] = [
    '=== RESUME MEDIS & RINGKASAN KASUS PENYAKIT DALAM (Sp.PD) ===',
    `Tanggal Ringkasan: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    'I. IDENTITAS / STATUS PASIEN:',
    `  ${inputText.slice(0, 160).trim()}...`,
    '',
    'II. DAFTAR MASALAH AKTIF BERDASARKAN DIVISI PAPDI:',
    ...activeProblemList.map(
      (d) => `  [${d.division}]\n${d.problems.map((p) => `    &bull; ${p}`).join('\n')}`,
    ),
    '',
    'III. TANDA VITAL TERAKHIR:',
    vitals.rawMatched.bp
      ? `  TD: ${vitals.rawMatched.bp} | HR: ${vitals.rawMatched.hr || '-'} | RR: ${vitals.rawMatched.rr || '-'} | Suhu: ${vitals.rawMatched.temp || '-'} | SpO2: ${vitals.rawMatched.spo2 || '-'}`
      : '  Tanda vital dalam evaluasi.',
    '',
    'IV. RANGKUMAN PENUNJANG & LABORATORIUM KRITIS / ABNORMAL:',
    ...(labs.length > 0
      ? labs.map((l) => `  &bull; ${l.name}: ${l.value} ${l.unit} (${l.interpretation})`)
      : ['  &bull; Tidak ditemukan hasil laboratorium dengan nilai kritis pada cuplikan teks.']),
    '',
    'V. RIWAYAT PENYAKIT DAHULU & RIWAYAT PENGOBATAN:',
    `  - RPD: ${pastHistory.join('; ')}`,
    `  - RPO: ${currentMedications.join('; ')}`,
    '',
    'VI. RANGKUMAN TERAPI AKTIF & TARGET MONITORING:',
    ...ongoingTherapy.slice(0, 5).map((t) => `  &bull; ${t}`),
    '',
    'VII. SARAN KLINIS DPJP PENYAKIT DALAM:',
    ...internistAdvice.map((a) => `  &bull; ${a}`),
  ];

  return {
    patientBrief: inputText.slice(0, 160),
    chiefComplaint: 'Keluhan dan kondisi dalam perawatan penyakit dalam.',
    activeProblemList,
    criticalAbnormalLabs: labs,
    labTrends,
    pastHistory,
    currentMedications,
    ongoingTherapy,
    internistAdvice,
    fullDraftText: summaryLines.join('\n'),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// MODE 4 / GUARD: Drug Safety, Renal/Hepatic Dosing Guard & Organ Risk Tracker
// ──────────────────────────────────────────────────────────────────────────────

export function evaluateClinicalSafetyGuard(
  inputText: string,
  vitals?: ParsedVitals,
  labs?: ParsedLabItem[],
  labTrends?: LabTrendSeries[],
): ClinicalSafetyReport {
  const effectiveVitals = vitals || extractVitals(inputText);
  let effectiveLabs = labs;
  let effectiveTrends = labTrends;
  if (!effectiveLabs || !effectiveTrends) {
    const extracted = extractLabTrendsAndAbnormal(inputText);
    if (!effectiveLabs) effectiveLabs = extracted.abnormalLabs;
    if (!effectiveTrends) effectiveTrends = extracted.labTrends;
  }

  // 1. Patient Demographics for Renal Calculation
  const ageMatch = inputText.match(/(?:usia|umur)\s*[:=]?\s*(\d{1,3})|(\d{1,3})\s*(?:th|tahun)/i);
  const age = ageMatch ? Number.parseInt(ageMatch[1] || ageMatch[2], 10) : 60;
  const isFemale = /\b(wanita|perempuan|ny\.|ibu|female|f)\b/i.test(inputText);
  const weightMatch = inputText.match(/(?:bb|berat badan)\s*[:=]?\s*(\d{2,3})\s*(?:kg)?/i);
  const weight = weightMatch ? Number.parseInt(weightMatch[1], 10) : isFemale ? 55 : 65;

  const crLab = effectiveLabs.find((l) => l.name.toLowerCase().includes('kreatinin'));
  const scr = crLab ? crLab.value : null;

  let eGfr: number | null = null;
  let crCl: number | null = null;
  let stage = 'Belum Ada Data Kreatinin';
  let isRenalImpaired = false;

  if (scr !== null && scr > 0) {
    // Cockcroft-Gault CrCl
    crCl = Math.round((((140 - age) * weight) / (72 * scr)) * (isFemale ? 0.85 : 1.0));

    // CKD-EPI 2021 eGFR
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    eGfr = Math.round(
      142 *
        Math.pow(Math.min(scr / kappa, 1), alpha) *
        Math.pow(Math.max(scr / kappa, 1), -1.2) *
        Math.pow(0.9938, age) *
        (isFemale ? 1.012 : 1.0),
    );

    if (eGfr >= 90) stage = 'Stage G1: Normal / High (eGFR ≥ 90 mL/min/1.73m²)';
    else if (eGfr >= 60) stage = 'Stage G2: Penurunan Ringan (eGFR 60-89 mL/min/1.73m²)';
    else if (eGfr >= 45) stage = 'Stage G3a: Penurunan Ringan-Sedang (eGFR 45-59 mL/min/1.73m²)';
    else if (eGfr >= 30) stage = 'Stage G3b: Penurunan Sedang-Berat (eGFR 30-44 mL/min/1.73m²)';
    else if (eGfr >= 15) stage = 'Stage G4: Penurunan Berat / Insufisiensi Lanjut (eGFR 15-29 mL/min/1.73m²)';
    else stage = 'Stage G5: Gagal Ginjal Terminal (eGFR < 15 mL/min/1.73m²)';

    isRenalImpaired = scr > 1.3 || eGfr < 60 || (crCl !== null && crCl < 60);
  }

  // Flagged Nephrotoxic Medications
  const flaggedRenalDrugs: FlaggedSafetyDrug[] = [];
  const textLower = inputText.toLowerCase();

  if (/\b(metformin|glikuidon|glibenklamid)\b/i.test(textLower)) {
    flaggedRenalDrugs.push({
      drug: 'Metformin',
      category: 'OAD / Biguanide',
      warning:
        isRenalImpaired && (eGfr ? eGfr < 30 : scr && scr > 2.0)
          ? 'KONTRAINDIKASI: Risiko Lactic Acidosis fatal pada eGFR < 30 mL/min.'
          : 'Waspada asidosis laktat perioperatif atau bila dehidrasi.',
      action:
        'Stop Metformin 24-48 jam pre-operasi atau sebelum zat kontras IV; titrasi insulin jika hiperglikemia.',
      severity: eGfr && eGfr < 30 ? 'critical' : 'warning',
    });
  }

  if (/\b(vancomycin|vankomisin)\b/i.test(textLower)) {
    flaggedRenalDrugs.push({
      drug: 'Vancomycin',
      category: 'Glikopeptida',
      warning: 'Nefrotoksisitas tubular akut & akumulasi obat pada penurunan laju filtrasi glomerulus.',
      action: 'Sesuaikan interval pemberian berdasarkan CrCl, pantau kadar serum trough target 15-20 mcg/mL.',
      severity: isRenalImpaired ? 'critical' : 'high',
    });
  }

  if (/\b(gentamicin|gentamisin|amikacin|amikasin|tobramycin)\b/i.test(textLower)) {
    flaggedRenalDrugs.push({
      drug: 'Aminoglikosida',
      category: 'Antibiotik Nefrotoksik Tinggi',
      warning: 'Nekrosis tubular akut toksik & ototoksisitas ireversibel.',
      action: 'Hindari kombinasi dengan nefrotoksik lain; terapkan extended-interval dosing; monitor kadar serial.',
      severity: 'critical',
    });
  }

  if (/\b(captopril|lisinopril|ramipril|candesartan|valsartan|telmisartan|losartan)\b/i.test(textLower)) {
    flaggedRenalDrugs.push({
      drug: 'ACEi / ARB',
      category: 'Renin-Angiotensin Blocker',
      warning: 'Memicu penurunan laju filtrasi glomerulus mendadak (efek dilatasi arteriol eferen) dan hiperkalemia.',
      action: 'Tunda/Stop 24 jam pre-operasi; hold bila dijumpai AKI atau dehidrasi akut.',
      severity: isRenalImpaired ? 'high' : 'warning',
    });
  }

  if (/\b(ketorolac|ketoprofen|ibuprofen|meloxicam|diklofenak|diclofenac|asam mefenamat|aspirin|piroxicam)\b/i.test(textLower)) {
    flaggedRenalDrugs.push({
      drug: 'NSAID',
      category: 'Anti-Inflamasi Non-Steroid',
      warning: 'Menghambat sintesis prostaglandin renal pelindung aliran darah ginjal, memicu AKI hemodinamik.',
      action: isRenalImpaired
        ? 'KONTRAINDIKASI RELATIF: Hindari sepenuhnya pada gangguan fungsi ginjal / perioperatif mayor.'
        : 'Gunakan dosis terendah dengan durasi tersingkat, pertimbangkan beralih ke Paracetamol.',
      severity: isRenalImpaired ? 'critical' : 'warning',
    });
  }

  const renalStatus: RenalSafetyStatus = {
    eGfr,
    crCl,
    stage,
    isImpaired: isRenalImpaired,
    creatinineValue: scr,
    flaggedDrugs: flaggedRenalDrugs,
  };

  // 2. Hepatic Impairment Check
  const astLab = effectiveLabs.find((l) => /\b(sgot|ast)\b/i.test(l.name));
  const altLab = effectiveLabs.find((l) => /\b(sgpt|alt)\b/i.test(l.name));
  const astVal = astLab ? astLab.value : null;
  const altVal = altLab ? altLab.value : null;
  const maxTrans = Math.max(astVal ?? 0, altVal ?? 0);
  const isHepaticImpaired = maxTrans >= 120 || (astLab?.flag === 'critical' || altLab?.flag === 'critical');

  const flaggedHepaticDrugs: FlaggedSafetyDrug[] = [];
  if (/\b(paracetamol|pct|panadol|sanmol|acetaminophen)\b/i.test(textLower)) {
    flaggedHepaticDrugs.push({
      drug: 'Paracetamol',
      category: 'Analgesik / Antipiretik',
      warning: isHepaticImpaired
        ? 'Beban metabolit NAPQI meningkat pada insufisiensi hepar / peningkatan transaminase > 3x ULN.'
        : 'Aman bila tidak melebihi dosis harian maksimal.',
      action: isHepaticImpaired
        ? 'Batasi dosis harian total < 2 g/24 jam; pertimbangkan stop bila terjadi kegawatan hepar akut.'
        : 'Dosis maksimal 4 g/24 jam (hati-hati pada malnutrisi).',
      severity: isHepaticImpaired ? 'critical' : 'info',
    });
  }

  if (/\b(atorvastatin|simvastatin|rosuvastatin)\b/i.test(textLower)) {
    flaggedHepaticDrugs.push({
      drug: 'Statin',
      category: 'Lipid-Lowering Agent',
      warning: isHepaticImpaired
        ? 'Peningkatan transaminase hepar > 3x ULN merupakan indikasi penundaan atau penurunan dosis statin.'
        : 'Dosis aman sesuai profil lipid.',
      action: isHepaticImpaired ? 'Tunda sementara terapi statin dan evaluasi fungsi hepar serial.' : 'Lanjutkan dosis rumatan.',
      severity: isHepaticImpaired ? 'high' : 'info',
    });
  }

  if (/\b(fluconazole|flukonazol|voriconazole|ketoconazole|itraconazole)\b/i.test(textLower)) {
    flaggedHepaticDrugs.push({
      drug: 'Antijamur Azole',
      category: 'Antifungal',
      warning: 'Potensi hepatotoksisitas intrinsik dan inhibitor kuat enzim mikrosomal hepar CYP3A4.',
      action: 'Evaluasi enzim hepar serial, sesuaikan dosis bila terdapat disfungsi hepar sedang-berat.',
      severity: isHepaticImpaired ? 'critical' : 'warning',
    });
  }

  if (/\b(rifampisin|rifampin|isoniazid|inh|pirazinamid|pza)\b/i.test(textLower)) {
    flaggedHepaticDrugs.push({
      drug: 'OAT (Rifampisin/INH/PZA)',
      category: 'Antituberkulosis',
      warning: 'Risiko Drug-Induced Liver Injury (DILI) bermakna.',
      action: isHepaticImpaired
        ? 'Bila transaminase > 3x ULN dengan gejala ikterik/mual atau > 5x ULN asimtomatik, hentikan OAT hepatotoksik dan beri hepatoprotektor.'
        : 'Lanjutkan pengawasan enzim transaminase berkala.',
      severity: isHepaticImpaired ? 'critical' : 'warning',
    });
  }

  const hepaticStatus: HepaticSafetyStatus = {
    isImpaired: isHepaticImpaired,
    astValue: astVal,
    altValue: altVal,
    warning: isHepaticImpaired
      ? `Transaminase Hepar Meningkat Bermakna (> 3x ULN: AST ${astVal ?? '-'} / ALT ${altVal ?? '-'} U/L). Waspada hepatotoksisitas obat.`
      : null,
    flaggedDrugs: flaggedHepaticDrugs,
  };

  // 3. Critical Drug Interactions & Electrolyte Hazards
  const hazards: DrugElectrolyteHazard[] = [];

  // A. QTc Prolongation Arrhythmia Hazard
  const qtcDrugsFound: string[] = [];
  const qtcPatterns = [
    { name: 'Levofloxacin', regex: /\b(levofloxacin|levofloksasin)\b/i },
    { name: 'Ciprofloxacin', regex: /\b(ciprofloxacin|ciprofloksasin)\b/i },
    { name: 'Moxifloxacin', regex: /\b(moxifloxacin|moksifloksasin)\b/i },
    { name: 'Azithromycin', regex: /\b(azithromycin|azitromisin)\b/i },
    { name: 'Erythromycin', regex: /\b(erythromycin|eritromisin)\b/i },
    { name: 'Ondansetron', regex: /\b(ondansetron)\b/i },
    { name: 'Domperidone', regex: /\b(domperidone|domperidon)\b/i },
    { name: 'Haloperidol', regex: /\b(haloperidol)\b/i },
    { name: 'Amiodarone', regex: /\b(amiodarone|amiodaron)\b/i },
  ];
  for (const q of qtcPatterns) {
    if (q.regex.test(textLower)) qtcDrugsFound.push(q.name);
  }

  const kLab = effectiveLabs.find((l) => l.name.toLowerCase().includes('kalium'));
  const mgLab = effectiveLabs.find((l) => l.name.toLowerCase().includes('magnesium'));
  const isHypoK = (kLab && (kLab.value < 3.5 || kLab.flag === 'low' || kLab.flag === 'critical')) || /\bhipokalemia\b/i.test(textLower);
  const isHypoMg = (mgLab && (mgLab.value < 1.8 || mgLab.flag === 'low' || mgLab.flag === 'critical')) || /\bhipomagnesemia\b/i.test(textLower);

  if (qtcDrugsFound.length > 0 && (isHypoK || isHypoMg)) {
    hazards.push({
      id: 'hazard-qtc-arrhythmia',
      category: 'qtc_arrhythmia',
      title: 'PERINGATAN ARITMIA LETAL (Pemanjangan Interval QTc & Torsades de Pointes)',
      severity: 'critical',
      description: `Kombinasi obat pemanjang interval QTc (${qtcDrugsFound.join(', ')}) dengan kondisi ${isHypoK ? `Hipokalemia (${kLab ? `${kLab.value} mEq/L` : 'signifikan'})` : ''}${isHypoMg ? ` dan Hipomagnesemia (${mgLab ? `${mgLab.value} mg/dL` : ''})` : ''} sangat meningkatkan risiko Aritmia Ventrikel Letal (Torsades de Pointes / VT Polimorfik / Fibrilasi Ventrikel).`,
      recommendation:
        'Koreksi agresif Kalium target ≥ 4.0 mEq/L dan Magnesium target ≥ 2.0 mg/dL. Monitor EKG ritme kontinu di HCU/ICU/OK. Pertimbangkan penggantian antiemetik/antibiotik alternatif non-QT prolonging.',
      involvedItems: [
        ...qtcDrugsFound,
        ...(kLab ? [`Kalium: ${kLab.value} mEq/L`] : []),
        ...(mgLab ? [`Magnesium: ${mgLab.value} mg/dL`] : []),
      ],
    });
  } else if (kLab && kLab.value < 2.5) {
    hazards.push({
      id: 'hazard-severe-hypokalemia',
      category: 'qtc_arrhythmia',
      title: 'KEGAWATAN ELEKTROLIT: Hipokalemia Ekstrem (< 2.5 mEq/L)',
      severity: 'critical',
      description: `Kalium serum ${kLab.value} mEq/L menimbulkan bahaya henti jantung (cardiac arrest), aritmia letal gelombang U/depresi ST, serta ileus paralitik usus dan kelemahan otot pernafasan.`,
      recommendation:
        'Koreksi CITO infus KCl via akses vena sentral (kecepatan 10-20 mEq/jam dengan syringe pump) di bawah monitoring EKG kontinu.',
      involvedItems: [`Kalium: ${kLab.value} mEq/L`],
    });
  }

  // B. Hemostasis & Bleeding Hazard
  const antithromboticDrugs: string[] = [];
  const bleedPatterns = [
    { name: 'Heparin / LMWH', regex: /\b(heparin|enoxaparin|innohep|fondaparinux)\b/i },
    { name: 'Warfarin', regex: /\b(warfarin|simarc)\b/i },
    { name: 'DOAC / NOAC', regex: /\b(rivaroxaban|dabigatran|apixaban)\b/i },
    { name: 'Aspirin / Aspilet', regex: /\b(aspirin|aspilet|asetosal)\b/i },
    { name: 'Clopidogrel / P2Y12', regex: /\b(clopidogrel|plavix|ticagrelor|brilinta)\b/i },
  ];
  for (const b of bleedPatterns) {
    if (b.regex.test(textLower)) antithromboticDrugs.push(b.name);
  }

  const pltLab = effectiveLabs.find((l) => l.name.toLowerCase().includes('trombosit'));
  const isNeurosurg = /bedah saraf|craniotomy|kraniotomi|sdh|edh|evd|vp\s*shunt|aneurysma|aneurysm/i.test(textLower);
  const isThrombocytopenic = (pltLab && (isNeurosurg ? pltLab.value < 100000 : pltLab.value < 50000)) || /\btrombositopenia\b/i.test(textLower);

  if (antithromboticDrugs.length > 0 && isThrombocytopenic) {
    hazards.push({
      id: 'hazard-hemostasis-bleeding',
      category: 'hemostasis_bleeding',
      title: 'PERINGATAN HEMOSTASIS & RISIKO PERDARAHAN PROSEDURAL',
      severity: 'critical',
      description: `Penggunaan obat antitrombotik (${antithromboticDrugs.join(', ')}) bersamaan dengan trombositopenia ${pltLab ? `(${pltLab.value.toLocaleString('id-ID')} /uL)` : ''}${isNeurosurg ? ' pada kasus Bedah Saraf' : ''} berisiko tinggi memicu hematoma masif dan perdarahan intraoperatif tak terkontrol.`,
      recommendation: `Tunda/stop segera agen antitrombotik. Siapkan transfusi Thrombocyte Concentrate (TC) dan FFP di meja operasi dengan target trombosit ${isNeurosurg ? '≥ 100.000 /uL' : '≥ 50.000 /uL'}.`,
      involvedItems: [
        ...antithromboticDrugs,
        ...(pltLab ? [`Trombosit: ${pltLab.value.toLocaleString('id-ID')} /uL`] : []),
      ],
    });
  }

  // C. Nephrotoxic Multiple Drug Hazard
  if (flaggedRenalDrugs.length >= 2 && isRenalImpaired) {
    hazards.push({
      id: 'hazard-poly-nephrotoxic',
      category: 'nephrotoxic',
      title: 'PERINGATAN BEBAN POLIFARMASI NEFROTOKSIK GANDA',
      severity: 'high',
      description: `Pasien dengan gangguan faal ginjal menerima kombinasi multipel obat nefrotoksik (${flaggedRenalDrugs.map((d) => d.drug).join(', ')}). Risiko percepatan disfungsi ginjal ke arah gagal ginjal stadium akhir atau AKI-on-CKD.`,
      recommendation:
        'Evaluasi rasionalitas polifarmasi nefrotoksik, terapkan hidrasi isotonik adekuat, dan de-eskalasi regimen obat sesegera mungkin.',
      involvedItems: flaggedRenalDrugs.map((d) => d.drug),
    });
  }

  // D. Hemodynamic & Hypertensive Emergency Hazard
  if (
    (effectiveVitals.systolic && effectiveVitals.systolic >= 180) ||
    (effectiveVitals.diastolic && effectiveVitals.diastolic >= 110)
  ) {
    hazards.push({
      id: 'hazard-hypertensive-crisis',
      category: 'other',
      title: 'PERINGATAN KRISIS HIPERTENSI & RISIKO KERUSAKAN ORGAN TARGET',
      severity: 'critical',
      description: `Tekanan darah ${effectiveVitals.systolic}/${effectiveVitals.diastolic} mmHg berada pada rentang krisis hipertensi, berisiko memicu perdarahan intrakranial, iskemia miokard, dan perburukan ginjal akut.`,
      recommendation:
        'Kendalikan tekanan darah perioperatif bertahap dengan antihipertensi parenteral (misal Nicardipine / NTG drip), target penurunan MAP 20-25% pada jam-jam awal.',
      involvedItems: [`TD: ${effectiveVitals.systolic}/${effectiveVitals.diastolic} mmHg`],
    });
  }

  return {
    renal: renalStatus,
    hepatic: hepaticStatus,
    hazards,
    labTrends: effectiveTrends || [],
  };
}

export const InternalMedicineEngine = {
  extractVitals,
  extractAbnormalLabs,
  extractLabTrends,
  extractLabTrendsAndAbnormal,
  parseIndoNumber,
  identifySpPdProblems,
  generateConsultationAnswer,
  generatePomrNote,
  generateCaseSummary,
  evaluateClinicalSafetyGuard,
  PAPDI_DIVISIONS,
};

export default InternalMedicineEngine;
