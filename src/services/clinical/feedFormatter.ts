/**
 * Multi-Source Clinical Feed Normalizer & Prompt Formatter
 * 
 * Compiles scattered patient data sources (external referrals, specialist consultations,
 * recent lab investigations, current progress notes) into an explicit, structured
 * clinical feed for hybrid on-device synthesis (SLM + CROGE).
 * 
 * Cleans anomalous control characters and normalizes common Indonesian clinical abbreviations.
 */

export interface ClinicalSources {
  /** a. Data Rujukan Luar / Faskes Sebelumnya (faskes primer, RS rujukan, riwayat terapi luar) */
  externalReferral?: string;
  /** b. Catatan Konsul Antar-Spesialis / Jawaban Konsul (rekomendasi sejawat, advis) */
  specialistConsultation?: string;
  /** c. Hasil Lab & Penunjang Terkini (hematologi, kimia darah, rontgen, USG, EKG) */
  labResults?: string;
  /** d. Anamnesis & Catatan Perjalanan Pasien Saat Ini (keluhan IGD/rawat, CPPT terkini) */
  currentEncounter?: string;
  [key: string]: string | undefined;
}

export const FEED_BLOCK_HEADERS = {
  externalReferral: '=== SUMBER RUJUKAN LUAR ===',
  specialistConsultation: '=== JAWABAN KONSULAN SEJAWAT ===',
  labResults: '=== HASIL LAB & PENUNJANG ===',
  currentEncounter: '=== KONDISI & KELUHAN SAAT INI ===',
} as const;

export type ClinicalSourceCategoryKey = keyof typeof FEED_BLOCK_HEADERS;

export interface CategoryMetadata {
  key: ClinicalSourceCategoryKey;
  label: string;
  header: string;
  description: string;
  placeholder: string;
}

export const SOURCE_CATEGORIES: CategoryMetadata[] = [
  {
    key: 'externalReferral',
    label: 'Rujukan Luar / Faskes Sebelumnya',
    header: FEED_BLOCK_HEADERS.externalReferral,
    description: 'Surat rujukan Puskesmas/Klinik/RS lain, riwayat diagnosis lalu, terapi dari faskes asal',
    placeholder: 'Contoh: Pasien rujukan dari RS Daerah dengan diagnosis CHF NYHA III. Terapi asal: Furosemide 1x40mg PO, Candesartan 1x16mg. Alasan rujukan: evaluasi penurunan fungsi ginjal progresif...',
  },
  {
    key: 'specialistConsultation',
    label: 'Catatan & Jawaban Konsul Spesialis',
    header: FEED_BLOCK_HEADERS.specialistConsultation,
    description: 'Lembar konsulan antar-departemen/spesialis, advis klinis, acc tindakan',
    placeholder: 'Contoh: Jawaban konsul Sp.JP: Kesan Acute Decompensated Heart Failure wet & warm. Advis: Rawat CVCU, Titrasi Furosemide IV 10mg/jam, tunda ACE-i/ARB sementara waktu, evaluasi intake-output ketat...',
  },
  {
    key: 'labResults',
    label: 'Hasil Lab & Penunjang Terkini',
    header: FEED_BLOCK_HEADERS.labResults,
    description: 'Darah lengkap, fungsi ginjal/hati, biomarker, EKG, Ro Thorax, USG',
    placeholder: 'Contoh: Hb 11.2 g/dL, Leukosit 9.800, Trombosit 245.000. Ureum 78 mg/dL, Kreatinin 2.4 mg/dL, eGFR 28 mL/min. K+ 4.8 mEq/L, Na+ 136 mEq/L. Ro Thorax: Kardiomegali CTR 62%, bendungan paru basal...',
  },
  {
    key: 'currentEncounter',
    label: 'Anamnesis & Perjalanan Saat Ini',
    header: FEED_BLOCK_HEADERS.currentEncounter,
    description: 'Keluhan utama pasien saat ini, vital sign terkini, pemeriksaan fisik perawat/dokter',
    placeholder: 'Contoh: Pasien mengeluh sesak bertambah sejak 2 hari yang lalu, tidur perlu 3 bantal (ortopnea). TD: 150/90 mmHg, HR: 98 bpm regular, RR: 26 x/menit, SpO2: 94% room air, T: 36.8°C. Edema pretibial +/+',
  },
];

/**
 * Clean invisible unicode control characters, foreign non-breaking spaces,
 * and normalize line breaks and quotes.
 */
export function cleanClinicalText(raw: string): string {
  if (!raw) return '';

  return (
    raw
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove zero-width spaces and invisible control characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Convert non-breaking spaces to standard space
      .replace(/[\u00A0\u202F]/g, ' ')
      // Convert typographer curly quotes to standard ASCII
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      // Convert en/em dashes to standard hyphen
      .replace(/[\u2013\u2014]/g, '-')
      // Strip control chars (excluding tab and newline)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Collapse trailing whitespace on lines
      .replace(/[ \t]+$/gm, '')
      // Collapse excessive blank lines (more than 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Normalizes common Indonesian medical abbreviations found in doctor referral notes,
 * CPPT (Catatan Perkembangan Pasien Terintegrasi), and consultation replies.
 */
export function normalizeClinicalAbbreviations(text: string): string {
  if (!text) return '';

  let res = text;

  // 1. Explicit prescription and therapy markers
  res = res.replace(/\bth\s*\/\s*[:]?\s*/gi, 'terapi: ');
  res = res.replace(/\btx\s*\/\s*[:]?\s*/gi, 'terapi: ');
  res = res.replace(/\bdx\s*\/\s*[:]?\s*/gi, 'diagnosis: ');
  res = res.replace(/\bdiag\s*\/\s*[:]?\s*/gi, 'diagnosis: ');
  res = res.replace(/\brx\s*\/\s*[:]?\s*/gi, 'resep: ');
  res = res.replace(/\bsx\s*\/\s*[:]?\s*/gi, 'gejala: ');
  res = res.replace(/\bhx\s*\/\s*[:]?\s*/gi, 'riwayat: ');
  res = res.replace(/\bmx\s*\/\s*[:]?\s*/gi, 'monitoring: ');
  res = res.replace(/\bdd\s*\/\s*[:]?\s*/gi, 'diagnosis banding: ');
  res = res.replace(/\badv\s*\/\s*[:]?\s*/gi, 'anjuran: ');
  res = res.replace(/\beval\s*\/\s*[:]?\s*/gi, 'evaluasi: ');

  // 2. Patient & Consultation terminology
  // "os" / "OS" standalone -> "pasien"
  res = res.replace(/\bos\b/gi, 'pasien');
  // "acc" / "ACC" -> "disetujui"
  res = res.replace(/\bacc\b/gi, 'disetujui');
  // "pro" -> "untuk" (e.g. pro rawat, pro USG)
  res = res.replace(/\bpro\b/gi, 'untuk');
  // "ts" / "TS" -> "teman sejawat"
  res = res.replace(/\bkonsul\s+ts\b/gi, 'konsultasi teman sejawat');
  res = res.replace(/\bts\b/gi, 'teman sejawat');
  // "ybs" -> "yang bersangkutan"
  res = res.replace(/\bybs\b/gi, 'yang bersangkutan');

  // 3. Clinical headings & vital signs
  res = res.replace(/\bku\s*:\s*/gi, 'keadaan umum: ');
  res = res.replace(/\btd\s*:\s*/gi, 'tekanan darah: ');
  res = res.replace(/\bhr\s*:\s*/gi, 'denyut jantung: ');
  res = res.replace(/\brr\s*:\s*/gi, 'laju napas: ');
  res = res.replace(/\bt\s*:\s*(?=\d)/gi, 'suhu: ');
  res = res.replace(/\bbb\s*:\s*/gi, 'berat badan: ');
  res = res.replace(/\btb\s*:\s*/gi, 'tinggi badan: ');

  // 4. Clinical notes abbreviations
  res = res.replace(/\bk\/p\b/gi, 'kalau perlu');
  res = res.replace(/\bs\.d\.\b/gi, 'sampai dengan');
  res = res.replace(/\bs\/d\b/gi, 'sampai dengan');
  res = res.replace(/\brpd\s*:\s*/gi, 'riwayat penyakit dahulu: ');
  res = res.replace(/\brps\s*:\s*/gi, 'riwayat penyakit sekarang: ');
  res = res.replace(/\brpk\s*:\s*/gi, 'riwayat penyakit keluarga: ');
  res = res.replace(/\brpo\s*:\s*/gi, 'riwayat pengobatan: ');

  return res;
}

/**
 * Checks if at least one category contains non-empty clinical text.
 */
export function hasAnySourceContent(sources: ClinicalSources): boolean {
  if (!sources) return false;
  return SOURCE_CATEGORIES.some((cat) => {
    const val = sources[cat.key];
    return typeof val === 'string' && val.trim().length > 0;
  });
}

/**
 * Compiles all provided clinical sources into a single coherent narrative
 * with explicit clinical block banners.
 *
 * Output format:
 * === SUMBER RUJUKAN LUAR ===
 * ...
 * === JAWABAN KONSULAN SEJAWAT ===
 * ...
 * === HASIL LAB & PENUNJANG ===
 * ...
 * === KONDISI & KELUHAN SAAT INI ===
 * ...
 */
export function formatMultiSourceFeed(sources: ClinicalSources): string {
  if (!sources) return '';

  const blocks: string[] = [];

  for (const cat of SOURCE_CATEGORIES) {
    const rawVal = sources[cat.key];
    if (typeof rawVal === 'string' && rawVal.trim().length > 0) {
      const cleaned = cleanClinicalText(rawVal);
      const normalized = normalizeClinicalAbbreviations(cleaned);
      if (normalized.trim().length > 0) {
        blocks.push(`${cat.header}\n${normalized}`);
      }
    }
  }

  return blocks.join('\n\n');
}

/**
 * Parses an already formatted multi-source feed back into individual category fields.
 * Useful if the user switches back and forth between Single Note and Multi-Source.
 */
export function parseMultiSourceFeed(formattedFeed: string): ClinicalSources {
  const result: ClinicalSources = {
    externalReferral: '',
    specialistConsultation: '',
    labResults: '',
    currentEncounter: '',
  };

  if (!formattedFeed) return result;

  const headerMap: Record<string, ClinicalSourceCategoryKey> = {
    [FEED_BLOCK_HEADERS.externalReferral]: 'externalReferral',
    [FEED_BLOCK_HEADERS.specialistConsultation]: 'specialistConsultation',
    [FEED_BLOCK_HEADERS.labResults]: 'labResults',
    [FEED_BLOCK_HEADERS.currentEncounter]: 'currentEncounter',
  };

  const headerRegex = /^(=== [^=\n]+ ===)\s*$/gm;
  const matches: Array<{ header: string; index: number; length: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = headerRegex.exec(formattedFeed)) !== null) {
    matches.push({ header: m[1], index: m.index, length: m[0].length });
  }

  if (matches.length === 0) {
    // If no explicit markers found, place everything in currentEncounter as fallback
    result.currentEncounter = formattedFeed.trim();
    return result;
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const key = headerMap[cur.header];
    const startContent = cur.index + cur.length;
    const endContent = i + 1 < matches.length ? matches[i + 1].index : formattedFeed.length;
    const content = formattedFeed.slice(startContent, endContent).trim();

    if (key) {
      result[key] = content;
    }
  }

  return result;
}

/**
 * Curated realistic Indonesian Multi-Source Clinical Ingestion sample scenario.
 */
export const SAMPLE_MULTI_SOURCE_FEED: ClinicalSources = {
  externalReferral:
    'Surat Rujukan dari Puskesmas Sukamaju (Dr. Hendra, Sp.KKLP):\n' +
    'Mohon evaluasi TS Sp.PD. Pasien Ny. Siti (58 th) rujukan dengan riwayat Hipertensi stage II dan DM Tipe 2 tidak terkontrol. ' +
    'th/ sebelumnya: Amlodipine 10mg 1x1, Metformin 500mg 3x1. OS mengeluh pusing berputar dan kencing sering di malam hari.',

  specialistConsultation:
    'Lembar Konsul TS Sp.JP (Dr. Maya, Sp.JP):\n' +
    'Kesan: Hypertensive Heart Disease (HHD) dengan LVH terkompensasi, tanpa tanda dekompensasi akut. ' +
    'Advis: Tambahkan ACE Inhibitor Lisinopril 10mg 1x1 pagi hari. Target TD < 130/80 mmHg. Evaluasi fungsi ginjal dan kalium 2 minggu lagi. acc untuk penanganan poliklinik terpadu.',

  labResults:
    'Pemeriksaan Laboratorium & Penunjang RS (26 September 2026):\n' +
    'GDS: 240 mg/dL (tinggi), HbA1c: 8.9% (tidak terkontrol).\n' +
    'Ureum: 38 mg/dL, Kreatinin: 1.1 mg/dL, eGFR: 62 mL/min/1.73m².\n' +
    'Kolesterol Total: 228 mg/dL, Trigliserida: 195 mg/dL, LDL: 142 mg/dL.\n' +
    'EKG: Sinus rhythm 78 bpm, Sokolow-Lyon criteria (+), T inverted di V5-V6.\n' +
    'Foto Ro Thorax: Kardiomegali ringan CTR 53%, pulmo tenang.',

  currentEncounter:
    'Anamnesis & Catatan Kunjungan Hari Ini:\n' +
    'Pasien datang untuk kontrol rutin poli interna. Mengaku sering lupa minum metformin jika tidak diingatkan keluarga. ' +
    'Pusing sudah berkurang, keluhan lemas kadang dirasakan. Tidak ada nyeri dada khas angina, tidak ada sesak saat jalan datar.\n' +
    'Pemeriksaan Fisik:\n' +
    'Keadaan umum: Tampak sakit sedang, kesadaran kompos mentis.\n' +
    'TD: 145/88 mmHg, HR: 80 bpm regular, RR: 18 x/menit, Suhu: 36.6°C, SpO2: 98% udara ruangan.\n' +
    'BB: 68 kg, TB: 156 cm (BMI: 27.9 kg/m² - Overweight).\n' +
    'Cor: BJ I-II regular, bising (-). Pulmo: Vesikuler +/+, ronkhi -/-, wheezing -/-. Abdomen: Supel, bising usus normal, hepar/lien tidak teraba. Ekstremitas: Edema pretibial -/-.',
};
