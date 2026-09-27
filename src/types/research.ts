export interface DeidEntity {
  text: string;
  category: string; // 'NAME' | 'DATE' | 'MRN' | 'PHONE' | etc.
  replacement: string;
  start: number;
  end: number;
}

export type ResidualRiskLevel = 'low' | 'moderate' | 'high';

export interface HipaaComplianceResult {
  compliant: boolean;
  safeHarborMet: boolean;
  residualRisk: ResidualRiskLevel;
  redactedCount: number;
  unredactedSuspects: number;
  timestamp: string;
}

export type LabFlag = 'low' | 'normal' | 'high' | 'critical';

export interface LoincLabRecord {
  testName: string; // e.g. "Triglycerides"
  loincCode: string; // e.g. "2571-8"
  value: number; // e.g. 210
  unit: string; // e.g. "mg/dL"
  referenceRange?: string; // e.g. "< 150 mg/dL"
  flag?: LabFlag;
}

export interface FhirBundleExportResult {
  bundle: Record<string, unknown>; // HL7 FHIR R4 Transaction Bundle JSON
  resourceCount: number;
  generatedAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName?: string; // defaults to 'fhir_bundles'
}
