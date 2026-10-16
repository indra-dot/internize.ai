/**
 * internize.ai — PPK Knowledge Engine Type Definitions
 *
 * Strongly-typed interfaces for the 9-division PAPDI Knowledge Engine,
 * Inverted Index, Dosing Engine, Multi-Problem Arbitrator, and OOS Refusal.
 */

import type {
  InternalMedicineDivision,
  ParsedLabItem,
  ParsedVitals,
  SpPdProblem,
} from '../internalMedicineEngine';

export type PapdiDivision =
  | 'ENDOKRIN'
  | 'GASTRO'
  | 'GERIATRI'
  | 'HOM'
  | 'IMUN'
  | 'NEFRO'
  | 'PARU'
  | 'REMATO'
  | 'TROPIK';

export interface PpkDrugRegimen {
  drugName: string;
  dose: string;
  route: 'IV' | 'PO' | 'SC' | 'IM' | 'Inhalasi' | 'Topikal' | 'Rectal';
  frequency: string;
  duration?: string;
  notes?: string;
}

export interface PpkTitrationStep {
  condition: string;
  rateAdjustment: string;
}

export interface PpkTitrationProtocol {
  protocolName: string;
  targetEndpoint: string;
  startingRate: string;
  steps: PpkTitrationStep[];
  subqTransitionCriteria?: string[];
}

export interface PpkDoseAdjustmentRule {
  drugName: string;
  organ: 'renal' | 'hepatic' | 'geriatric' | 'electrolytes';
  threshold: string;
  action: 'contraindicated' | 'reduce_dose' | 'extend_interval' | 'caution' | 'hold';
  recommendation: string;
}

export interface PpkMatchedGuideline {
  documentId: string;
  documentTitle: string;
  division: PapdiDivision;
  docType: 'PPK' | 'CLINICAL_PATHWAY' | 'CHEMO_PROTOCOL';
  sourceFile: string;
  icd10: {
    primary: string;
    description?: string;
  };
  matchedKeywords: string[];
  matchScore: number;
  definisi: string;
  anamnesis: string[];
  physicalSigns: string[];
  kriteriaDiagnosis: string[];
  pdx: {
    laboratorium: string[];
    radiologi: string[];
    prosedurDiagnostik: string[];
  };
  ptx: {
    nonMedikamentosa: string[];
    lini1: PpkDrugRegimen[];
    lini2: PpkDrugRegimen[];
    titrasiProtocols?: PpkTitrationProtocol[];
    penyesuaianDosis?: PpkDoseAdjustmentRule[];
    kontraindikasiDanRedFlags: string[];
  };
  pmx: {
    targetKlinis: string[];
    targetLab: string[];
    targetLamaRawatHari?: number | string;
  };
  pex: {
    konselingPenyakit: string[];
    kepatuhanObatDanDiet: string[];
    tandaBahayaEmergency: string[];
  };
  kegawatanDanRujukan?: {
    kriteriaIcu?: string[];
    kriteriaRujukan?: string[];
    kriteriaPulang?: string[];
    emergencyFlags?: string[];
  };
  scoringSystems?: string[];
  citations: string[];
}

export interface OutOfScopeEvaluationResult {
  isOutOfScope: boolean;
  specialtyCode?: string;
  specialtyName?: string;
  refusalMessage?: string;
}

export interface DoseAdjustmentResult {
  drugName: string;
  standardDose: string;
  adjustedDose?: string;
  status: 'safe' | 'adjusted' | 'caution' | 'contraindicated' | 'hold';
  organImpairment?: 'renal' | 'hepatic' | 'geriatric' | 'electrolytes';
  thresholdTriggered?: string;
  recommendation: string;
  warningAlert?: string;
}

export interface MultiProblemArbitrationResult {
  prioritizedProblems: SpPdProblem[];
  identifiedConflicts: Array<{
    conflictId: string;
    title: string;
    divisionsInvolved: InternalMedicineDivision[];
    rationale: string;
    mandatorySequentialDirectives: string[];
    redFlagPrevented: string;
  }>;
  emergencyFirstHourAdvis: string[];
  contraindicatedActions: string[];
}

export interface IPpkKnowledgeEngine {
  matchKnowledge(
    problem: SpPdProblem | string,
    vitals?: ParsedVitals,
    labs?: ParsedLabItem[],
  ): PpkMatchedGuideline | null;

  searchGuidelines(query: string, limit?: number): PpkMatchedGuideline[];

  evaluateOutOfScope(queryText: string): OutOfScopeEvaluationResult;

  formatCitation(guideline: PpkMatchedGuideline, section: string): string;

  /**
   * Patient parameter adaptation & dosing safety guardrails.
   *
   * @param drugName Standard or generic medication name
   * @param standardDose Standard unadjusted dosing regimen
   * @param eGfr Estimated GFR in mL/min/1.73m2
   * @param astAltRatio Transaminase elevation multiple over ULN (transaminaseXUln, e.g. 3.0 = 3x ULN).
   *                    Aliased to astAltRatio for backwards compatibility.
   * @param age Patient age in years
   * @param labContext Optional electrolyte lab values (Kalium, Magnesium)
   */
  getAdjustedDosing(
    drugName: string,
    standardDose: string,
    eGfr?: number,
    astAltRatio?: number,
    age?: number,
    labContext?: { kalium?: number; magnesium?: number },
  ): DoseAdjustmentResult;

  arbitrateMultiProblem(
    problems: SpPdProblem[],
    vitals?: ParsedVitals,
    labs?: ParsedLabItem[],
  ): MultiProblemArbitrationResult;
}

// In-store document contract from ppkStore.json
export interface PpkStoredDocument {
  id: string;
  title: string;
  division: PapdiDivision;
  docType: 'PPK' | 'CLINICAL_PATHWAY' | 'CHEMO_PROTOCOL';
  editionYear: number;
  icd10: {
    primary: string;
    description?: string;
  };
  definisi: string;
  anamnesis: string[];
  pemeriksaanFisik: {
    physicalSigns: string[];
    vitalsSignificance?: string[];
  };
  kriteriaDiagnosis: {
    systemName?: string;
    criteriaList: string[];
  };
  diagnosisBanding: string[];
  pdx: {
    laboratorium: string[];
    radiologi: string[];
    prosedurDiagnostik: string[];
  };
  ptx: {
    nonMedikamentosa: string[];
    medikamentosa: {
      lini1: PpkDrugRegimen[];
      lini2: PpkDrugRegimen[];
    };
    titrasiProtocols?: PpkTitrationProtocol[];
    penyesuaianDosis?: PpkDoseAdjustmentRule[];
    kontraindikasiDanRedFlags: string[];
  };
  pmx: {
    targetKlinis: string[];
    targetLab: string[];
    targetLamaRawatHari?: number | string;
  };
  pex: {
    konselingPenyakit: string[];
    kepatuhanObatDanDiet: string[];
    tandaBahayaEmergency: string[];
  };
  prognosis?: {
    adVitam?: string;
    adFunctionam?: string;
    adSanationam?: string;
    clinicalNotes?: string;
  };
  kegawatanDanRujukan?: {
    kriteriaIcu?: string[];
    kriteriaRujukan?: string[];
    kriteriaPulang?: string[];
    emergencyFlags?: string[];
  };
  scoringSystems?: string[];
  tingkatEvidens?: string;
  kepustakaan: string[];
}

export interface PpkStoreRoot {
  metadata: {
    version: string;
    generatedAt: string;
    totalDocuments: number;
    totalIngestedFiles: number;
    coveragePercentage: number;
    divisions: PapdiDivision[];
  };
  documents: Record<string, PpkStoredDocument>;
}
