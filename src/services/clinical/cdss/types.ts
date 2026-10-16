/**
 * internize.ai — Clinical Decision Support System (CDSS) Types
 *
 * Sourced & aligned with the 7-suite CDSS ecosystem by dr. Ida Bagus Indra Wibawa Putrawan, S.Ked
 * (https://sites.google.com/view/drguswib).
 *
 * 100% on-device, zero-egress, deterministic.
 */

export type CdssSuiteId =
  | 'HOM'         // AdjustrHOM: Hematologi & Onkologi Medik (19 tools)
  | 'GEH'         // adjustr-GEH v2.2: Gastroentero-Hepatologi (32 tools)
  | 'CALC_MED'    // Calc-Med Pro: Critical Care Vasopressor, Inotrope & ABG (8 tools)
  | 'FLUID'       // adjustr-fluid Pro: Kinetika Cairan, Elektrolit & AKI (9 tools)
  | 'ADJUSTR_IO'  // ADJUSTR.IO: Antimicrobial Renal Dosing Engine (36 obat)
  | 'EMD'         // adjustrEMD Pro: Endokrin & Metabolik Emergency (18 tools)
  | 'RHEUMA'      // RheumaTools: Reumatologi IRA Decision Companion (16 tools)
  | 'PREOP';      // Pre-Operative Clearance & Geriatri Risk Systems

export interface CdssSuiteInfo {
  id: CdssSuiteId;
  name: string;
  badge: string;
  color: string;
  toolCount: number;
  description: string;
}

export type RiskLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'critical'
  | 'normal'
  | 'abnormal'
  | 'unknown';

export interface GuardrailAlert {
  severity: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  actionGuideline?: string;
  evidenceSource?: string;
}

export interface CdssCalculatorMeta {
  id: string;
  name: string;
  shortName: string;
  suite: CdssSuiteId;
  category: string;
  description: string;
  keywords: string[];
  evidenceSource?: string;
  requiredInputs: string[];
  optionalInputs?: string[];
  guardrails?: string[];
}

export interface CdssCalculationResult {
  calculatorId: string;
  calculatorName: string;
  suite: CdssSuiteId;
  score: number | null;
  scoreDisplay: string;
  interpretation: string;
  riskLevel: RiskLevel;
  isPartial: boolean;
  missingParams: string[];
  extractedParams: Record<string, any>;
  cpptText: string;
  guardrailAlerts?: GuardrailAlert[];
  recommendations?: string[];
}
