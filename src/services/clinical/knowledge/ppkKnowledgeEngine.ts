/**
 * internize.ai — Unified PPK Knowledge Engine (Milestone 3)
 *
 * 100% on-device, zero-egress clinical intelligence engine powered by
 * 121 PAPDI clinical documents across 9 divisions.
 *
 * Facade implementing IPpkKnowledgeEngine:
 * - Sub-2ms in-memory indexed lookup (PpkInvertedIndex)
 * - Deterministic out-of-scope refusal (PpkOutOfScope)
 * - Patient parameter & dosing adaptation (PpkDosingEngine)
 * - Multi-problem cross-division conflict arbitration (PpkArbitrator)
 * - Canonical citation formatter (PpkCitationFormatter)
 */

import type {
  InternalMedicineDivision,
  ParsedLabItem,
  ParsedVitals,
  SpPdProblem,
} from '../internalMedicineEngine';
import type {
  DoseAdjustmentResult,
  IPpkKnowledgeEngine,
  MultiProblemArbitrationResult,
  OutOfScopeEvaluationResult,
  PapdiDivision,
  PpkMatchedGuideline,
} from './ppkTypes';
import { PpkInvertedIndex, type SearchMatchResult } from './ppkInvertedIndex';
import { evaluateOutOfScopeQuery } from './ppkOutOfScope';
import { PpkDosingEngine } from './ppkDosingEngine';
import { PpkArbitrator } from './ppkArbitrator';
import { PpkCitationFormatter } from './ppkCitationFormatter';

const INTERNAL_DIV_TO_PAPDI_MAP: Partial<Record<InternalMedicineDivision, PapdiDivision>> = {
  endokrin: 'ENDOKRIN',
  gastro: 'GASTRO',
  geriatri: 'GERIATRI',
  hemato: 'HOM',
  alergi: 'IMUN',
  ginjal: 'NEFRO',
  pulmo: 'PARU',
  reuma: 'REMATO',
  tropik: 'TROPIK',
};

export class PpkKnowledgeEngine implements IPpkKnowledgeEngine {
  private static instance: PpkKnowledgeEngine | null = null;
  private readonly index: PpkInvertedIndex;
  private readonly dosingEngine: PpkDosingEngine;
  private readonly arbitrator: PpkArbitrator;
  private readonly citationFormatter: PpkCitationFormatter;

  private constructor() {
    this.index = PpkInvertedIndex.getInstance();
    this.dosingEngine = PpkDosingEngine.getInstance();
    this.arbitrator = PpkArbitrator.getInstance();
    this.citationFormatter = PpkCitationFormatter.getInstance();
  }

  public static getInstance(): PpkKnowledgeEngine {
    if (!PpkKnowledgeEngine.instance) {
      PpkKnowledgeEngine.instance = new PpkKnowledgeEngine();
    }
    return PpkKnowledgeEngine.instance;
  }

  private convertToMatchedGuideline(topMatch: SearchMatchResult): PpkMatchedGuideline {
    const doc = topMatch.doc;
    const sourceFile = this.index.getSourceFileName(doc.id);

    const guideline: PpkMatchedGuideline = {
      documentId: doc.id,
      documentTitle: doc.title,
      division: doc.division,
      docType: doc.docType,
      sourceFile,
      icd10: doc.icd10,
      matchedKeywords: topMatch.matchedKeywords,
      matchScore: topMatch.score,
      definisi: doc.definisi,
      anamnesis: doc.anamnesis,
      physicalSigns: doc.pemeriksaanFisik?.physicalSigns || [],
      kriteriaDiagnosis: doc.kriteriaDiagnosis?.criteriaList || [],
      pdx: {
        laboratorium: doc.pdx?.laboratorium || [],
        radiologi: doc.pdx?.radiologi || [],
        prosedurDiagnostik: doc.pdx?.prosedurDiagnostik || [],
      },
      ptx: {
        nonMedikamentosa: doc.ptx?.nonMedikamentosa || [],
        lini1: doc.ptx?.medikamentosa?.lini1 || [],
        lini2: doc.ptx?.medikamentosa?.lini2 || [],
        titrasiProtocols: doc.ptx?.titrasiProtocols,
        penyesuaianDosis: doc.ptx?.penyesuaianDosis,
        kontraindikasiDanRedFlags: doc.ptx?.kontraindikasiDanRedFlags || [],
      },
      pmx: {
        targetKlinis: doc.pmx?.targetKlinis || [],
        targetLab: doc.pmx?.targetLab || [],
        targetLamaRawatHari: doc.pmx?.targetLamaRawatHari,
      },
      pex: {
        konselingPenyakit: doc.pex?.konselingPenyakit || [],
        kepatuhanObatDanDiet: doc.pex?.kepatuhanObatDanDiet || [],
        tandaBahayaEmergency: doc.pex?.tandaBahayaEmergency || [],
      },
      kegawatanDanRujukan: doc.kegawatanDanRujukan,
      scoringSystems: doc.scoringSystems || [],
      citations: [],
    };

    // Format citations
    guideline.citations = this.citationFormatter.buildFullCitationArray(guideline);

    return guideline;
  }

  /**
   * Matches an active problem (or query string) against the indexed PPK documents.
   * Executes in < 1ms on local runtime.
   */
  public matchKnowledge(
    problem: SpPdProblem | string,
    _vitals?: ParsedVitals,
    _labs?: ParsedLabItem[],
  ): PpkMatchedGuideline | null {
    let query = '';
    let targetDivision: PapdiDivision | undefined;

    if (typeof problem === 'string') {
      query = problem;
    } else {
      query = `${problem.title} ${problem.assessment || ''} ${problem.sEvidence?.join(' ') || ''}`;
      if (problem.division) {
        targetDivision = INTERNAL_DIV_TO_PAPDI_MAP[problem.division];
      }
    }

    if (!query || query.trim().length === 0) {
      return null;
    }

    // Try search with target division first if available
    let matches = targetDivision
      ? this.index.search(query, { division: targetDivision, limit: 1 })
      : [];

    // Fallback search across all 9 divisions if no match found within division
    if (matches.length === 0) {
      matches = this.index.search(query, { limit: 1 });
    }

    if (matches.length === 0) {
      return null;
    }

    return this.convertToMatchedGuideline(matches[0]);
  }

  /**
   * Searches multiple guidelines matching a free-text clinical query or vignette.
   */
  public searchGuidelines(query: string, limit = 3): PpkMatchedGuideline[] {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const matches = this.index.search(query, { limit });
    return matches.map((m) => this.convertToMatchedGuideline(m));
  }

  /**
   * Deterministic out-of-scope evaluation.
   * Returns structured refusal containing the exact phrase: "tidak tercakup PPK".
   */
  public evaluateOutOfScope(queryText: string): OutOfScopeEvaluationResult {
    return evaluateOutOfScopeQuery(queryText);
  }

  /**
   * Generates a canonical citation string:
   * `PPK PAPDI 2024 — Divisi [Divisi]: [Penyakit] (Ref: [filename]) § [Bagian]`
   */
  public formatCitation(guideline: PpkMatchedGuideline, section = 'Rekomendasi Terapi'): string {
    return this.citationFormatter.formatCitation(guideline, section);
  }

  /**
   * Patient parameter adaptation & dosing safety guardrails.
   */
  public getAdjustedDosing(
    drugName: string,
    standardDose: string,
    eGfr?: number,
    astAltRatio?: number,
    age?: number,
    labContext?: { kalium?: number; magnesium?: number },
  ): DoseAdjustmentResult {
    return this.dosingEngine.getAdjustedDosing(drugName, standardDose, eGfr, astAltRatio, age, labContext);
  }

  /**
   * Multi-problem cross-division priority sequencing and conflict arbitration.
   */
  public arbitrateMultiProblem(
    problems: SpPdProblem[],
    vitals?: ParsedVitals,
    labs?: ParsedLabItem[],
  ): MultiProblemArbitrationResult {
    return this.arbitrator.arbitrateMultiProblem(problems, vitals, labs);
  }
}

// Export singleton instance and class
export const ppkKnowledgeEngine = PpkKnowledgeEngine.getInstance();
export default ppkKnowledgeEngine;
