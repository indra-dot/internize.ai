/**
 * internize.ai — In-Memory Inverted Index for PPK Knowledge Store
 *
 * Provides sub-2ms multi-dimensional search over 121 PPK clinical documents
 * across 9 PAPDI divisions:
 * - Title match (weight 100)
 * - ICD-10 exact match (weight 90)
 * - Curated Clinical Synonym / Acronym match (weight 75)
 * - Diagnostic Criteria / Key Protocol Match (weight 40)
 * - General Symptom / Medication Token Match (weight 10)
 */

import type {
  PapdiDivision,
  PpkStoredDocument,
  PpkStoreRoot,
} from './ppkTypes';
import ppkRawStore from './ppkStore.json';
import ppkSourceFilesMap from './ppkSourceFiles.json';

export interface SearchMatchResult {
  docId: string;
  score: number;
  matchedKeywords: string[];
  doc: PpkStoredDocument;
}

export interface SearchOptions {
  division?: PapdiDivision;
  limit?: number;
  minScore?: number;
}

interface IndexPosting {
  docId: string;
  weight: number;
  term: string;
}

interface AcronymRule {
  pattern: RegExp;
  docIds: string[];
  canonicalTerm: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PpkInvertedIndex {
  private static instance: PpkInvertedIndex | null = null;
  private readonly store: PpkStoreRoot;
  private readonly sourceFiles: Record<string, string>;
  private readonly exactTermIndex: Map<string, IndexPosting[]> = new Map();
  private readonly icd10Index: Map<string, string[]> = new Map();
  private readonly titleIndex: Map<string, string[]> = new Map();
  private readonly titleRules: Array<{ regex: RegExp; docIds: string[]; token: string }> = [];
  private readonly acronymRules: AcronymRule[] = [];

  private constructor() {
    this.store = ppkRawStore as unknown as PpkStoreRoot;
    this.sourceFiles = ppkSourceFilesMap as Record<string, string>;
    this.buildIndex();
  }

  public static getInstance(): PpkInvertedIndex {
    if (!PpkInvertedIndex.instance) {
      PpkInvertedIndex.instance = new PpkInvertedIndex();
    }
    return PpkInvertedIndex.instance;
  }

  public getDocument(docId: string): PpkStoredDocument | undefined {
    return this.store.documents[docId];
  }

  public getAllDocuments(): PpkStoredDocument[] {
    return Object.values(this.store.documents);
  }

  public getSourceFileName(docId: string): string {
    if (this.sourceFiles[docId]) {
      return this.sourceFiles[docId];
    }
    const doc = this.getDocument(docId);
    if (doc) {
      const prefix = doc.docType === 'CLINICAL_PATHWAY' ? 'CPW' : 'PPK';
      return `${prefix}_(${doc.title})_(${doc.editionYear}).pdf`;
    }
    return `${docId}.pdf`;
  }

  /**
   * Fast query executing in < 0.2ms.
   */
  public search(query: string, options?: SearchOptions): SearchMatchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const tLower = query.toLowerCase();
    const scores = new Map<string, number>();
    const matchedTermsMap = new Map<string, Set<string>>();

    const addScore = (docId: string, weight: number, term: string) => {
      const cur = scores.get(docId) ?? 0;
      scores.set(docId, cur + weight);

      let termSet = matchedTermsMap.get(docId);
      if (!termSet) {
        termSet = new Set<string>();
        matchedTermsMap.set(docId, termSet);
      }
      termSet.add(term);
    };

    // 1. Curated Acronym & Synonym Matching (weight 75)
    for (const rule of this.acronymRules) {
      if (rule.pattern.test(query)) {
        for (const docId of rule.docIds) {
          addScore(docId, 75, rule.canonicalTerm);
        }
      }
    }

    // 2. Exact ICD-10 Code Matching (weight 90)
    const icdMatches = query.match(/\b[A-Z]\d{2}(?:\.\d{1,3})?\b/gi);
    if (icdMatches) {
      for (const icd of icdMatches) {
        const icdNorm = icd.toUpperCase();
        const docs = this.icd10Index.get(icdNorm);
        if (docs) {
          for (const docId of docs) {
            addScore(docId, 90, `ICD-10:${icdNorm}`);
          }
        }
        // Also check prefix without dot (e.g. E11 from E11.1)
        const prefix = icdNorm.split('.')[0];
        const prefixDocs = this.icd10Index.get(prefix);
        if (prefixDocs) {
          for (const docId of prefixDocs) {
            addScore(docId, 45, `ICD-10:${prefix}`);
          }
        }
      }
    }

    // 3. Document Title Exact / Substring Matching (weight 100)
    for (const rule of this.titleRules) {
      if (rule.regex.test(tLower)) {
        for (const docId of rule.docIds) {
          addScore(docId, 100, rule.token);
        }
      }
    }

    // 4. Token & Inverted Term Matching (weights 40 & 10)
    const tokens = this.tokenize(query);
    for (const token of tokens) {
      const postings = this.exactTermIndex.get(token);
      if (postings) {
        for (const p of postings) {
          addScore(p.docId, p.weight, p.term);
        }
      }
    }

    // Filter, sort and format results
    const results: SearchMatchResult[] = [];
    const minScore = options?.minScore ?? 15;
    const targetDiv = options?.division;

    for (const [docId, score] of scores.entries()) {
      if (score < minScore) continue;
      const doc = this.getDocument(docId);
      if (!doc) continue;

      if (targetDiv && doc.division !== targetDiv) {
        continue;
      }

      results.push({
        docId,
        score,
        matchedKeywords: Array.from(matchedTermsMap.get(docId) ?? []),
        doc,
      });
    }

    results.sort((a, b) => b.score - a.score);

    if (options?.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  private static readonly STOP_WORDS = new Set([
    'dan',
    'atau',
    'pada',
    'dengan',
    'dari',
    'yang',
    'untuk',
    'oleh',
    'dalam',
    'serta',
    'pasien',
    'kasus',
    'klinis',
    'terhadap',
    'tentang',
    'sesuai',
    'rawat',
    'inap',
    'jalan',
    'rajal',
    'ranap',
    'ipd',
    'ppk',
    'cpw',
    'cp',
    // Generic sub-words extracted from titles (Reviewer 2 Finding 1)
    'and',
    'get',
    'ver',
    'non',
    'atas',
    'ibu',
    'tes',
    // Non-specific temporal & measurement units
    'hari',
    'minggu',
    'bulan',
    'tahun',
    'detik',
    'menit',
    'jam',
    'mmhg',
    'darah',
  ]);

  private static readonly GENERIC_TITLE_WORDS = new Set([
    'berat',
    'sedang',
    'ringan',
    'akut',
    'kronis',
    'prosedur',
    'tatalaksana',
    'penatalaksanaan',
    'prioritas',
    'komdik',
    'pedoman',
    'panduan',
    'protokol',
    'tindakan',
    'terapi',
    'evaluasi',
    'manajemen',
    'stadium',
    'grade',
    'tipe',
    'pada',
    'pasien',
    'dewasa',
    'lansia',
    'geriatri',
    'umum',
    'khusus',
    'ranap',
    'rajal',
    'rawat',
    'inap',
    'jalan',
    'bagian',
    'sistem',
    'sistim',
  ]);

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !PpkInvertedIndex.STOP_WORDS.has(t));
  }

  private buildIndex(): void {
    // Canonical title aliases for acronym documents
    const TITLE_ALIASES: Record<string, string[]> = {
      'ppk-paru-cap-2024': ['pneumonia komunitas', 'community acquired pneumonia', 'pneumonia'],
      'ppk-paru-hap-2022': ['hospital acquired pneumonia', 'pneumonia nosokomial'],
      'ppk-paru-vap-2026': ['ventilator associated pneumonia'],
      'ppk-paru-ppok-eksaserbasi-akut-2018': ['penyakit paru obstruktif kronik', 'ppok'],
      'cp-paru-tb-sensitif-obat-2022': ['tuberkulosis paru', 'tb sensitif obat', 'tbc'],
      'ppk-remato-sle-2018': ['lupus eritematosus sistemik', 'systemic lupus erythematosus'],
      'ppk-remato-artritis-reumatoid-2022': ['rheumatoid arthritis', 'artritis reumatoid'],
    };

    // 1. Build document index
    for (const doc of Object.values(this.store.documents)) {
      // Title indexing
      const titleClean = doc.title.toLowerCase();
      const titleTokens = this.tokenize(titleClean);
      for (const tok of titleTokens) {
        if (!PpkInvertedIndex.GENERIC_TITLE_WORDS.has(tok)) {
          if (!this.titleIndex.has(tok)) {
            this.titleIndex.set(tok, []);
          }
          this.titleIndex.get(tok)!.push(doc.id);
        }
      }
      // Index full title phrase
      if (!this.titleIndex.has(titleClean)) {
        this.titleIndex.set(titleClean, []);
      }
      this.titleIndex.get(titleClean)!.push(doc.id);

      // Title aliases
      const aliases = TITLE_ALIASES[doc.id];
      if (aliases) {
        for (const alias of aliases) {
          const aClean = alias.toLowerCase();
          if (!this.titleIndex.has(aClean)) {
            this.titleIndex.set(aClean, []);
          }
          this.titleIndex.get(aClean)!.push(doc.id);
          for (const aTok of this.tokenize(aClean)) {
            if (!PpkInvertedIndex.GENERIC_TITLE_WORDS.has(aTok)) {
              if (!this.titleIndex.has(aTok)) {
                this.titleIndex.set(aTok, []);
              }
              this.titleIndex.get(aTok)!.push(doc.id);
            }
          }
        }
      }

      // ICD-10 indexing
      if (doc.icd10?.primary) {
        const icd = doc.icd10.primary.toUpperCase();
        if (!this.icd10Index.has(icd)) {
          this.icd10Index.set(icd, []);
        }
        this.icd10Index.get(icd)!.push(doc.id);

        const prefix = icd.split('.')[0];
        if (!this.icd10Index.has(prefix)) {
          this.icd10Index.set(prefix, []);
        }
        this.icd10Index.get(prefix)!.push(doc.id);
      }

      // Index Criteria / Protocols / Regimens (weight 40)
      const criteriaList = doc.kriteriaDiagnosis?.criteriaList || [];
      for (const crit of criteriaList) {
        for (const tok of this.tokenize(crit)) {
          this.addPosting(tok, doc.id, 40, tok);
        }
      }

      const lini1 = doc.ptx?.medikamentosa?.lini1 || [];
      for (const reg of lini1) {
        for (const tok of this.tokenize(reg.drugName)) {
          this.addPosting(tok, doc.id, 40, reg.drugName);
        }
      }

      const titrasi = doc.ptx?.titrasiProtocols || [];
      for (const tit of titrasi) {
        for (const tok of this.tokenize(tit.protocolName)) {
          this.addPosting(tok, doc.id, 40, tit.protocolName);
        }
      }

      // Index General Tokens (weight 10)
      const pdxLab = doc.pdx?.laboratorium || [];
      for (const lab of pdxLab) {
        for (const tok of this.tokenize(lab)) {
          this.addPosting(tok, doc.id, 10, lab);
        }
      }
    }

    // Pre-compile title regex rules with word boundaries for sub-millisecond search
    for (const [titleToken, docIds] of this.titleIndex.entries()) {
      if (titleToken.length >= 3 && !PpkInvertedIndex.GENERIC_TITLE_WORDS.has(titleToken)) {
        this.titleRules.push({
          regex: new RegExp(`\\b${escapeRegExp(titleToken)}\\b`, 'i'),
          docIds,
          token: titleToken,
        });
      }
    }

    // 2. Register Curated Indonesian Clinical Acronyms & Synonyms Registry
    this.registerCuratedAcronymRules();
  }

  private addPosting(token: string, docId: string, weight: number, term: string): void {
    if (token.length < 3) return;
    let list = this.exactTermIndex.get(token);
    if (!list) {
      list = [];
      this.exactTermIndex.set(token, list);
    }
    // Prevent duplicate postings for the same docId and token
    if (!list.some((p) => p.docId === docId)) {
      list.push({ docId, weight, term });
    }
  }

  private registerCuratedAcronymRules(): void {
    const rules: Array<{ pattern: RegExp; docIds: string[]; term: string }> = [
      // ENDOKRIN
      {
        pattern: /\b(?:kad|dka|ketoasidosis\s*diabetik|asidosis\s*diabetik|asidosis\s*laktat|koma\s*asidosis|asidosis\s*metabolik|asidosis\s*berat)\b/i,
        docIds: [
          'cp-endokrin-kad-prioritas-komdik-kad-infeksi-pneumonia-non-sev-2023',
          'cp-endokrin-tatalaksana-kad-endokrin-2022',
        ],
        term: 'Ketoasidosis Diabetik (KAD)',
      },
      {
        pattern: /\b(?:dm\s*tipe\s*[12]|dm\b|diabetes\s*melitus|diabetes|hiperglikemia|gds\s*(?:>|>=|\d{2,3})|gula\s*darah|polidipsia|poliuria)\b/i,
        docIds: [
          'cp-endokrin-tatalaksana-kad-endokrin-2022',
          'cp-endokrin-tatalaksana-shh-endokrin-2022',
          'cp-endokrin-kad-prioritas-komdik-kad-infeksi-pneumonia-non-sev-2023',
        ],
        term: 'Diabetes Melitus / Hiperglikemia (DM)',
      },
      {
        pattern: /\b(?:shh|hhs|status\s*hiperosmolar|hiperosmolar\s*hiperglikemik)\b/i,
        docIds: ['cp-endokrin-tatalaksana-shh-endokrin-2022'],
        term: 'Status Hiperosmolar Hiperglikemik (SHH)',
      },
      {
        pattern: /\b(?:hipoglikemia|koma\s*hipoglikemik|drop\s*gds|gds\s*<\s*70)\b/i,
        docIds: [
          'ppk-endokrin-hipoglikemia-ranap-ipd-2024',
          'ppk-endokrin-hipoglikemia-2024',
          'ppk-endokrin-hipoglikemia-rawat-jalan-2024',
        ],
        term: 'Hipoglikemia',
      },
      {
        pattern: /\b(?:krisis\s*tiroid|thyroid\s*storm|burch\s*wartofsky|tirotoksikosis\s*krisis)\b/i,
        docIds: ['ppk-endokrin-krisis-tiroid-2024'],
        term: 'Krisis Tiroid',
      },
      {
        pattern: /\b(?:kaki\s*diabetik|ulkus\s*diabetikum|gangren\s*diabetik|wagner)\b/i,
        docIds: [
          'ppk-endokrin-kaki-diabetik-rawat-inap-2024',
          'ppk-endokrin-kaki-diabetik-rajal-2024',
        ],
        term: 'Kaki Diabetik',
      },

      // GASTRO
      {
        pattern: /\b(?:gerd|refluks\s*gastroesofageal|heartburn|refluks\s*asam)\b/i,
        docIds: ['ppk-gastro-gerd-2021'],
        term: 'GERD',
      },
      {
        pattern: /\b(?:perdarahan\s*varises|ruptur\s*varises|varises\s*esofagus|variceal\s*bleed)\b/i,
        docIds: ['ppk-gastro-perdarahan-varises-2021'],
        term: 'Perdarahan Varises Esofagus',
      },
      {
        pattern: /\b(?:hematemesis\s*melena|scba|perdarahan\s*saluran\s*cerna\s*atas|melena)\b/i,
        docIds: [
          'ppk-gastro-hematemesis-melena-2021',
          'ppk-gastro-perdarahan-varises-2021',
        ],
        term: 'Hematemesis Melena (SCBA)',
      },
      {
        pattern: /\b(?:hematokezia|scbb|perdarahan\s*saluran\s*cerna\s*bawah)\b/i,
        docIds: ['ppk-gastro-hematokezia-2021'],
        term: 'Hematokezia (SCBB)',
      },
      {
        pattern: /\b(?:sirosis\s*hati|sirosis\s*hepatis|child\s*pugh|hipertensi\s*portal|ensefalopati\s*hepatikum)\b/i,
        docIds: ['ppk-gastro-sirosis-hati-2021'],
        term: 'Sirosis Hati',
      },
      {
        pattern: /\b(?:pankreatitis|pankreatitis\s*akut|balthazar|amilase\s*lipase\s*meningkat)\b/i,
        docIds: ['ppk-gastro-pankreatitis-akut-2021'],
        term: 'Pankreatitis Akut',
      },
      {
        pattern: /\b(?:abses\s*hati|abses\s*hepar|abses\s*amuba|abses\s*piogenik)\b/i,
        docIds: ['ppk-gastro-abses-hati-2021'],
        term: 'Abses Hati',
      },
      {
        pattern: /\b(?:batu\s*bilier|batu\s*empedu|kolelitiasis|koledokolitiasis|kolangitis)\b/i,
        docIds: ['ppk-gastro-batu-sistim-bilier-2021'],
        term: 'Batu Sistem Bilier',
      },
      {
        pattern: /\b(?:dispepsia|ulkus\s*peptikum|sindrom\s*dispepsia|gastritis\s*erosif)\b/i,
        docIds: ['ppk-gastro-dispepsia-2021'],
        term: 'Dispepsia',
      },
      {
        pattern: /\b(?:hepatitis\s*kronis|hepatitis\s*b\s*kronis|hepatitis\s*c\s*kronis)\b/i,
        docIds: ['ppk-gastro-hepatitis-kronis-2021'],
        term: 'Hepatitis Kronis',
      },
      {
        pattern: /\b(?:hepatoma|karsinoma\s*hepatoseluler|hcc|kanker\s*hati)\b/i,
        docIds: ['ppk-gastro-hepatoma-2021'],
        term: 'Hepatoma',
      },
      {
        pattern: /\b(?:ileus|ileus\s*paralitik|subileus)\b/i,
        docIds: ['ppk-gastro-ileus-paralitik-2021'],
        term: 'Ileus Paralitik',
      },
      {
        pattern: /\b(?:kanker\s*kolorektal|karsinoma\s*kolon|tumor\s*kolon)\b/i,
        docIds: ['ppk-gastro-kanker-kolorektal-2021'],
        term: 'Kanker Kolorektal',
      },
      {
        pattern: /\b(?:kolangiokarsinoma|kanker\s*saluran\s*empedu)\b/i,
        docIds: ['ppk-gastro-kolangiokarsinoma-2021'],
        term: 'Kolangiokarsinoma',
      },
      {
        pattern: /\b(?:tumor\s*pankreas|kanker\s*pankreas)\b/i,
        docIds: ['ppk-gastro-tumor-pankreas-2021'],
        term: 'Tumor Pankreas',
      },

      // GERIATRI
      {
        pattern: /\b(?:delirium|sindrom\s*delirium\s*akut|cam\b|bingung\s*akut\s*pada\s*lansia)\b/i,
        docIds: [
          'ppk-geriatri-delirium-ranap-2022',
          'ppk-geriatri-sindrom-delirium-akut-pada-pasien-geriatri-2022',
        ],
        term: 'Delirium Geriatri',
      },
      {
        pattern: /\b(?:dehidrasi\s*pada\s*pasien\s*geriatri|dehidrasi\s*geriatri|dehidrasi\s*lansia)\b/i,
        docIds: ['ppk-geriatri-dehidrasi-pada-pasien-geriatri-2022'],
        term: 'Dehidrasi Geriatri',
      },
      {
        pattern: /\b(?:frailty|sindrom\s*kerapuhan|clinical\s*frailty\s*scale|cfs\b|lansia\s*rapuh)\b/i,
        docIds: ['ppk-geriatri-frailty-pada-pasien-geriatri-2021'],
        term: 'Frailty (Sindrom Kerapuhan Geriatri)',
      },
      {
        pattern: /\b(?:gangguan\s*elektrolit\s*pada\s*pasien\s*geriatri|elektrolit\s*geriatri)\b/i,
        docIds: ['ppk-geriatri-gangguan-elektrolit-pada-pasien-geriatri-2022'],
        term: 'Gangguan Elektrolit Geriatri',
      },
      {
        pattern: /\b(?:gangguan\s*kognitif\s*geriatri|mci\b|demensia\s*pada\s*geriatri)\b/i,
        docIds: ['ppk-geriatri-gangguan-kognitif-pada-pasien-geriatri-2022'],
        term: 'Gangguan Kognitif Geriatri',
      },
      {
        pattern: /\b(?:imobilisasi\s*geriatri|sindrom\s*imobilisasi|pasien\s*tirah\s*baring\s*lama)\b/i,
        docIds: ['ppk-geriatri-imobilisasi-pada-pasien-geriatri-2021'],
        term: 'Imobilisasi Geriatri',
      },
      {
        pattern: /\b(?:malnutrisi\s*geriatri|malnutrisi\s*lansia|mna\b|malnutrisi\s*berat\s*geriatri)\b/i,
        docIds: [
          'ppk-geriatri-malnutrisi-berat-geriatri-2025',
          'ppk-geriatri-malnutrisi-pada-pasien-geriatri-2021',
          'ppk-geriatri-malnutrisi-sedang-geriatri-2025',
        ],
        term: 'Malnutrisi Geriatri',
      },
      {
        pattern: /\b(?:hallpike\s*dix|nylen\s*barany|manuver\s*hallpike|tes\s*keseimbangan\s*geriatri)\b/i,
        docIds: ['ppk-geriatri-manuver-hall-pike-dix-tes-nylen-barany-2021'],
        term: 'Manuver Hallpike Dix Geriatri',
      },
      {
        pattern: /\b(?:osteosarkopenia|sarkopenia\s*dan\s*osteoporosis)\b/i,
        docIds: ['ppk-geriatri-osteosarkopenia-2022'],
        term: 'Osteosarkopenia',
      },
      {
        pattern: /\b(?:sarkopenia|penurunan\s*massa\s*otot\s*lansia)\b/i,
        docIds: ['ppk-geriatri-sarkopenia-pada-pasien-geriatri-2021'],
        term: 'Sarkopenia Geriatri',
      },
      {
        pattern: /\b(?:get\s*up\s*and\s*go|tug\s*test|tes\s*berdiri\s*berjalan)\b/i,
        docIds: ['ppk-geriatri-prosedur-tes-get-up-and-go-berdiri-dan-2021'],
        term: 'Prosedur Tes Get Up And Go',
      },
      {
        pattern: /\b(?:vaksinasi\s*geriatri|imunisasi\s*pada\s*lansia|vaksin\s*influenza\s*lansia)\b/i,
        docIds: ['ppk-geriatri-vaksinasi-pada-geriatri-2021'],
        term: 'Vaksinasi Geriatri',
      },

      // HOM
      {
        pattern: /\b(?:febrile\s*neutropenia|neutropenia\s*febris|fn\b|anc\s*<\s*500)\b/i,
        docIds: ['ppk-hom-febrile-neutropenia-2018-2018'],
        term: 'Febrile Neutropenia',
      },
      {
        pattern: /\b(?:dic\b|koagulasi\s*intravaskular\s*diseminata|disseminated\s*intravascular)\b/i,
        docIds: [
          'ppk-hom-dic-2021-2021',
          'ppk-hom-koagulasi-intravaskular-diseminata-2018',
        ],
        term: 'Disseminated Intravascular Coagulation (DIC)',
      },
      {
        pattern: /\b(?:dvt\b|trombosis\s*vena\s*dalam|deep\s*vein\s*thrombosis|vte\b|tromboemboli\s*vena)\b/i,
        docIds: [
          'ppk-hom-dvt-trombosis-vena-dalam-2021-2021',
          'ppk-hom-tromboeboli-vena-2018',
        ],
        term: 'DVT / Tromboemboli Vena',
      },
      {
        pattern: /\b(?:multiple\s*myeloma|mieloma\s*multipel|protein\s*bence\s*jones|crab\b)\b/i,
        docIds: [
          'ppk-hom-multiple-myeloma-2021-2021',
          'ppk-hom-mieloma-multipel-2018',
        ],
        term: 'Multiple Myeloma',
      },
      {
        pattern: /\b(?:anemia\s*aplastik|pansitopenia\s*berat|hipoplasia\s*sumsum)\b/i,
        docIds: [
          'ppk-hom-anemia-aplastik-2021-2021',
          'ppk-hom-anemia-aplastik-2018',
        ],
        term: 'Anemia Aplastik',
      },
      {
        pattern: /\b(?:anemia\s*defisiensi\s*besi|adb\b|feritin\s*rendah|mikrositik\s*hipokrom)\b/i,
        docIds: [
          'ppk-hom-anemia-defisiensi-besi-2021-2021',
          'ppk-hom-anemia-defisiensi-besi-2018',
        ],
        term: 'Anemia Defisiensi Besi',
      },
      {
        pattern: /\b(?:hemofilia|hemofilia\s*a|hemofilia\s*b|defisiensi\s*faktor\s*viii)\b/i,
        docIds: [
          'ppk-hom-hemofilia-2021-2021',
          'ppk-hom-hemofilia-2018',
        ],
        term: 'Hemofilia',
      },
      {
        pattern: /\b(?:aml\b|leukemia\s*mieloblastik\s*akut|mieloblas\s*>\s*20%)\b/i,
        docIds: [
          'ppk-hom-aml-leukemia-mieloblastik-akut-2021-2021',
          'ppk-hom-leukemia-meloblastik-akut-2018',
        ],
        term: 'Acute Myeloid Leukemia (AML)',
      },
      {
        pattern: /\b(?:limfoma\s*hodgkin|hodgkin\s*lymphoma|reed\s*sternberg)\b/i,
        docIds: [
          'ppk-hom-limfoma-hodgkin-2021-2021',
          'ppk-hom-limfoma-hodgkin-2018',
        ],
        term: 'Limfoma Hodgkin',
      },
      {
        pattern: /\b(?:limfoma\s*non\s*hodgkin|lnh\b|dlbcl\b)\b/i,
        docIds: ['ppk-hom-limfoma-non-hodgkin-2018'],
        term: 'Limfoma Non-Hodgkin',
      },
      {
        pattern: /\b(?:aps\b|sindrom\s*antifosfolipid|antiphospholipid|antikoagulan\s*lupus)\b/i,
        docIds: ['ppk-hom-sindrom-antifosfolipid-aps-2021-2021'],
        term: 'Sindrom Antifosfolipid (APS)',
      },

      // IMUN
      {
        pattern: /\b(?:anafilaksis|syok\s*anafilaktik|reaksi\s*anafilaksis|epinefrin\s*im)\b/i,
        docIds: ['ppk-imun-anafilaksis-2016'],
        term: 'Anafilaksis',
      },

      // NEFRO
      {
        pattern: /\b(?:hipertensi|krisis\s*hipertensi|hipertensi\s*emergensi|hipertensi\s*urgensi)\b/i,
        docIds: ['ppk-nefro-hipertensi-2016'],
        term: 'Hipertensi',
      },
      {
        pattern: /\b(?:hiponatremia|hiponatremia\s*hipoosmolar|siadh\b|kadar\s*na\s*<\s*135)\b/i,
        docIds: [
          'ppk-nefro-hiponatremia-2016',
          'ppk-nefro-hiponatremia-2016-pdf',
        ],
        term: 'Hiponatremia',
      },
      {
        pattern: /\b(?:batu\s*saluran\s*kemih|nefrolitiasis|urolitiasis|kolik\s*renal)\b/i,
        docIds: ['ppk-nefro-batu-saluran-kemih-2016'],
        term: 'Batu Saluran Kemih',
      },
      {
        pattern: /\b(?:isk\s*jamur|kandiduria|infeksi\s*jamur\s*saluran\s*kemih)\b/i,
        docIds: ['ppk-nefro-isk-jamur-2016'],
        term: 'ISK Jamur',
      },
      {
        pattern: /\b(?:isk\s*pada\s*ibu\s*hamil|isk\s*kehamilan|bakteriuria\s*asimtomatik\s*hamil)\b/i,
        docIds: ['ppk-nefro-isk-pada-ibu-hamil-2016'],
        term: 'ISK pada Ibu Hamil',
      },

      // PARU
      {
        pattern: /\b(?:cap\b|pneumonia\s*komunitas|community\s*acquired\s*pneumonia|bronkopneumonia)\b/i,
        docIds: ['ppk-paru-cap-2024'],
        term: 'Community-Acquired Pneumonia (CAP)',
      },
      {
        pattern: /\b(?:hap\b|hospital\s*acquired\s*pneumonia|pneumonia\s*nosokomial)\b/i,
        docIds: ['ppk-paru-hap-2022'],
        term: 'Hospital-Acquired Pneumonia (HAP)',
      },
      {
        pattern: /\b(?:vap\b|ventilator\s*associated\s*pneumonia|pneumonia\s*ventilator)\b/i,
        docIds: ['ppk-paru-vap-2026'],
        term: 'Ventilator-Associated Pneumonia (VAP)',
      },
      {
        pattern: /\b(?:asma\s*akut\s*berat|status\s*asmatikus|serangan\s*asma\s*berat)\b/i,
        docIds: ['ppk-paru-asma-akut-berat-2018'],
        term: 'Asma Akut Berat',
      },
      {
        pattern: /\b(?:ppok|ppok\s*eksaserbasi|copd\b|ae\s*copd)\b/i,
        docIds: ['ppk-paru-ppok-eksaserbasi-akut-2018'],
        term: 'PPOK Eksaserbasi Akut',
      },
      {
        pattern: /\b(?:tb\b(?!\s*[:=]?\s*\d|\s*\/\s*bb|\s*cm\b)|tbc\b|tuberkulosis|tb\s*paru|oat\b|tb\s*sensitif\s*obat|bta\b|bta\s*sputum|bta\s*positif|tcm\s*tb|tes\s*cepat\s*molekuler)\b/i,
        docIds: [
          'cp-paru-tb-sensitif-obat-2022',
          'ppk-paru-tb-ranap-2024',
          'ppk-paru-tb-paru-rajal-2024',
        ],
        term: 'Tuberkulosis Paru (TB)',
      },
      {
        pattern: /\b(?:tb\s*ro|mdr\s*tb|tuberkulosis\s*resistan\s*obat|tb\s*mdr)\b/i,
        docIds: [
          'ppk-paru-tb-ro-rawat-inap-2024',
          'ppk-paru-tb-ro-rawat-jalan-2024',
        ],
        term: 'TB Resistan Obat (TB-RO)',
      },
      {
        pattern: /\b(?:abses\s*paru|lung\s*abscess)\b/i,
        docIds: ['ppk-paru-abses-paru-rawat-inap-2024'],
        term: 'Abses Paru',
      },
      {
        pattern: /\b(?:bronkiektasis|bronchiectasis)\b/i,
        docIds: ['ppk-paru-bronkiektasis-2021'],
        term: 'Bronkiektasis',
      },
      {
        pattern: /\b(?:efusi\s*pleura|efusi\s*pleura\s*masif|torakosentesis)\b/i,
        docIds: ['ppk-paru-efusi-pleura-masif-2018'],
        term: 'Efusi Pleura Masif',
      },
      {
        pattern: /\b(?:kanker\s*paru|karsinoma\s*paru|karsinoma\s*bronkogenik)\b/i,
        docIds: ['ppk-paru-kanker-paru-dengan-komplikasi-2018'],
        term: 'Kanker Paru',
      },

      // REMATO
      {
        pattern: /\b(?:artritis\s*gout|gout\s*akut|podagra|flare\s*gout|artritis\s*pirai)\b/i,
        docIds: ['ppk-remato-artritis-gout-akut-2018'],
        term: 'Artritis Gout Akut',
      },
      {
        pattern: /\b(?:artritis\s*reumatoid|ra\b|rheumatoid\s*arthritis|anti\s*ccp)\b/i,
        docIds: ['ppk-remato-artritis-reumatoid-2022'],
        term: 'Artritis Reumatoid (RA)',
      },
      {
        pattern: /\b(?:sle\b|lupus|lupus\s*eritematosus\s*sistemik|lupus\s*nefritis|ana\s*if)\b/i,
        docIds: ['ppk-remato-sle-2018'],
        term: 'Systemic Lupus Erythematosus (SLE)',
      },
      {
        pattern: /\b(?:osteoartritis|oa\s*genu|gonartrosis|nyeri\s*lutut\s*degeneratif)\b/i,
        docIds: ['ppk-remato-osteoartritis-2018'],
        term: 'Osteoartritis',
      },
      {
        pattern: /\b(?:osteoporosis|t\s*score\s*<=\s*-2\.5|bisfosfonat)\b/i,
        docIds: ['ppk-remato-osteoporosis-2018'],
        term: 'Osteoporosis',
      },
      {
        pattern: /\b(?:septik\s*artritis|artritis\s*septik|artritis\s*infeksi|artritis\s*bakterial)\b/i,
        docIds: ['ppk-remato-septik-artritis-2018'],
        term: 'Septik Artritis',
      },
      {
        pattern: /\b(?:ankilosing\s*spondilitis|spondilitis\s*ankilosa|hla\s*b27)\b/i,
        docIds: ['ppk-remato-ankilosing-spondilitis-2022'],
        term: 'Ankilosing Spondilitis',
      },
      {
        pattern: /\b(?:artritis\s*psoriatik|psoriatic\s*arthritis)\b/i,
        docIds: ['ppk-remato-artritis-psoriatik-2018'],
        term: 'Artritis Psoriatik',
      },
      {
        pattern: /\b(?:artritis\s*reaktif|reiter)\b/i,
        docIds: ['ppk-remato-artritis-reaktif-2021'],
        term: 'Artritis Reaktif',
      },
      {
        pattern: /\b(?:sistemik\s*sklerosis|skleroderma|crest)\b/i,
        docIds: ['ppk-remato-sistemik-sklerosis-2021'],
        term: 'Sistemik Sklerosis',
      },

      // TROPIK
      {
        pattern: /\b(?:demam\s*tifoid|tifoid|thypoid|typhoid|tubex|salmonella\s*typhi)\b/i,
        docIds: ['ppk-tropik-demam-tifoid-2021'],
        term: 'Demam Tifoid',
      },
      {
        pattern: /\b(?:dhf\b|dbd\b|dengue\s*hemorrhagic|demam\s*berdarah\s*dengue|dss\b)\b/i,
        docIds: [
          'ppk-tropik-dhf-ver-1-2022',
          'ppk-tropik-dhf-ver-2-2022',
        ],
        term: 'Dengue Hemorrhagic Fever (DHF)',
      },
      {
        pattern: /\b(?:diare\s*akut|gastroenteritis\s*akut|gea\b)\b/i,
        docIds: ['ppk-tropik-diare-akut-2022'],
        term: 'Diare Akut',
      },
      {
        pattern: /\b(?:disenteri|diare\s*inflamasi|shigella|entamoeba)\b/i,
        docIds: ['ppk-tropik-diare-inflamasi-disenteri-2021'],
        term: 'Diare Inflamasi (Disenteri)',
      },
      {
        pattern: /\b(?:hiv\b|aids\b|antiretroviral|cd4\b|arv\b)\b/i,
        docIds: [
          'ppk-tropik-infeksi-hiv-simtomatik-2022',
          'ppk-tropik-infeksi-hiv-asimtomatik-2022',
          'ppk-tropik-inisiasi-antiretroviral-pada-infeksi-hiv-2015',
        ],
        term: 'Infeksi HIV / AIDS',
      },
      {
        pattern: /\b(?:kandidiasis\s*esofageal|esofagitis\s*kandida)\b/i,
        docIds: ['ppk-tropik-kandidiasis-esofageal-pada-infeksi-hiv-2022'],
        term: 'Kandidiasis Esofageal',
      },
      {
        pattern: /\b(?:kandidiasis\s*invasif|kandidemia)\b/i,
        docIds: ['ppk-tropik-kandidiasis-invasif-2022'],
        term: 'Kandidiasis Invasif',
      },
      {
        pattern: /\b(?:kandidiasis\s*oral|oral\s*thrush)\b/i,
        docIds: ['ppk-tropik-kandidiasis-oral-pada-infeksi-hiv-2022'],
        term: 'Kandidiasis Oral',
      },
      {
        pattern: /\b(?:leptospirosis|weil\s*disease|leptospira|mat\b)\b/i,
        docIds: ['ppk-tropik-leptospirosis-2022'],
        term: 'Leptospirosis',
      },
      {
        pattern: /\b(?:malaria|plasmodium\s*falciparum|plasmodium\s*vivax|act\b)\b/i,
        docIds: ['ppk-tropik-malaria-tanpa-komplikasi-2016'],
        term: 'Malaria Tanpa Komplikasi',
      },
      {
        pattern: /\b(?:pcp\b|pneumocystis\s*pneumonia|pneumocystis\s*jirovecii)\b/i,
        docIds: ['ppk-tropik-pneumocystis-pneumonia-2022'],
        term: 'Pneumocystis Pneumonia (PCP)',
      },
      {
        pattern: /\b(?:sepsis|syok\s*sepsis|renjatan\s*sepsis|qsofa|sofa\s*score)\b/i,
        docIds: ['ppk-tropik-sepsis-dan-renjatan-sepsis-2016'],
        term: 'Sepsis dan Renjatan Sepsis',
      },
    ];

    for (const r of rules) {
      this.acronymRules.push({
        pattern: r.pattern,
        docIds: r.docIds,
        canonicalTerm: r.term,
      });
    }
  }
}
